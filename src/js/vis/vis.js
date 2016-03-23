/**
 * @ngdoc overview
 * @name npn-viz-tool.vis
 * @description
 *
 * Module for generic visualization support, dialog framework, common services, etc.
 */
angular.module('npn-viz-tool.vis',[
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.vis-scatter',
    'npn-viz-tool.vis-calendar',
    'npn-viz-tool.vis-map',
    'ui.bootstrap'
])
/**
 * @ngdoc service
 * @name npn-viz-tool.vis:ChartService
 * @module npn-viz-tool.vis
 * @description
 *
 * Handles data gathering in a generic fashion for visualizations that should share, rather than
 * duplicate such logic.
 */
.factory('ChartService',['$window','$http','$log','$uibModal','FilterService','SettingsService',
    function($window,$http,$log,$uibModal,FilterService,SettingsService){
    // some hard coded values that will be massaged into generated
    // values at runtime.
    var CHART_W = 930,
        CHART_H =500,
        MARGIN = {top: 20, right: 30, bottom: 60, left: 40},
        WIDTH = CHART_W - MARGIN.left - MARGIN.right,
        HEIGHT = CHART_H - MARGIN.top - MARGIN.bottom,
        SIZING = {
            margin: MARGIN,
            width: WIDTH,
            height: HEIGHT
        },
        VISUALIZATIONS = [{
            title: 'Scatter Plot',
            controller: 'ScatterVisCtrl',
            template: 'js/scatter/scatter.html',
            description: 'This visualization plots selected geographic or climactic variables against estimated onset dates for individuals for up to three species/phenophase pairs.'
        },{
            title: 'Calendar',
            controller: 'CalendarVisCtrl',
            template: 'js/calendar/calendar.html',
            description: 'This visualization illustrates annual timing of phenophase activity for selected species/phenophase pairs. Horizontal bars represent phenological activity at a site to regional level for up to two years.'
        },{
            title: 'Gridded Data',
            controller: 'MapVisCtrl',
            template: 'js/mapvis/mapvis.html',
            description: 'This visualization maps ground-based observations against USA-NPN gridded data products, including Accumulated Growing Degree Days and Spring Index models.',
            singleStation: false // doesn't make sense for a single station visualization.
        }],
        visualizeSingleStationId;
    function filterSuspectSummaryData (d){
        var bad = (d.latitude === 0.0 || d.longitude === 0.0 || d.elevation_in_meters < 0);
        if(bad) {
            $log.warn('suspect station data',d);
        }
        return !bad;
    }
    function filterLqSummaryData (d) {
        var keep = d.numdays_since_prior_no >= 0;
        if(!keep) {
            $log.debug('filtering less precise data from summary output',d);
        }
        return keep;
    }
    function addCommonParams(params) {
        if(visualizeSingleStationId) {
            params['station_id[0]'] = visualizeSingleStationId;
        } else {
            var filter = FilterService.getFilter();
            // if geo filtering add the explicit station_ids in question.
            if(filter.getGeographicArgs().length) {
                FilterService.getFilteredMarkers().forEach(function(marker,i){
                    params['station_id['+i+']'] = marker.station_id;
                });
            }
            // if network filtering in play add network_id/s
            filter.getNetworkArgs().forEach(function(n,i){
                params['network['+i+']'] = n.getName();
				params['network_id['+i+']'] = n.getId();
            });
        }
        return params;
    }
    function txformUrlEncoded(obj) {
        var encoded = [],key;
        for(key in obj) {
            encoded.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
        }
        return encoded.join('&');
    }
    function setVisualizeSingleStationId(id) {
        visualizeSingleStationId = id;
    }
    var service = {
        /**
         * @ngdoc property
         * @propertyOf npn-viz-tool.vis:ChartService
         * @name ONE_DAY_MILLIS
         * @description constant for the number of milliseconds in a day.
         */
        ONE_DAY_MILLIS: (24*60*60*1000),
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name getSizeInfo
         * @description
         *
         * Get common info about how a chart should be sized with respect to actual
         * window size.
         *
         * <strong>Note:</strong> This method will result in information about how to
         * statically size an image within a visualization dialog.  However d3 can dynamically
         * deliver width/height information for an SVG if full height/width is desired.  E.g.
         * <pre>
         * var width = parseFloat(svg.style('width').replace('px','')),
         *     height = parseFloat(svg.style('height').replace('px',''));
         * </pre>
         *
         * @param {object} marginOverride Allows for overriding of defaults.
         */
        getSizeInfo: function(marginOverride){
            // make the chart 92% of the window width
            var margin = angular.extend({},MARGIN,marginOverride),
                cw = Math.round($window.innerWidth*0.90),
                ch = Math.round(cw*0.5376), // ratio based on initial w/h of 930/500
                w = cw  - margin.left - margin.right,
                h = ch  - margin.top - margin.bottom,
                sizing = {width: w, height : h, margin: margin};
            $log.debug('sizing',sizing);
            return sizing;
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name leastSquares
         * @description
         *
         * Perform leastSquares regression mathematics for drawing regression lines.
         *
         * @param {Array} xSeries the x-series
         * @param {Array} ySeries the y-series
         */
        leastSquares: function(xSeries,ySeries) {
            if(xSeries.length === 0 || ySeries.length === 0) {
                return [Number.NaN,Number.NaN,Number.NaN];
            }
            var reduceSumFunc = function(prev, cur) { return prev + cur; };

            var xBar = xSeries.reduce(reduceSumFunc) * 1.0 / xSeries.length;
            var yBar = ySeries.reduce(reduceSumFunc) * 1.0 / ySeries.length;

            var ssXX = xSeries.map(function(d) { return Math.pow(d - xBar, 2); })
                .reduce(reduceSumFunc);

            var ssYY = ySeries.map(function(d) { return Math.pow(d - yBar, 2); })
                .reduce(reduceSumFunc);

            var ssXY = xSeries.map(function(d, i) { return (d - xBar) * (ySeries[i] - yBar); })
                .reduce(reduceSumFunc);

            var slope = ssXY / ssXX;
            var intercept = yBar - (xBar * slope);
            var rSquare = Math.pow(ssXY, 2) / (ssXX * ssYY);

            return [slope, intercept, rSquare];
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name approxY
         * @description
         *
         * Generate an approximate value for y based on the least squares coefficient and a known x.
         *
         * @param {Array} leastSquaresCoeff the coefficient array.
         * @param {number} x The value for x.
         */
        approxY: function(leastSquaresCoeff,x) {
            // y = a + bx
            var a = leastSquaresCoeff[1],
                b = leastSquaresCoeff[0];
            return a + (b*x);
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name getSummarizedData
         * @description
         *
         * Issue a request for summarized data.  Common parameters will be implicitly added like
         * networks in the base filter or lists of sites if geographic filtering is enabled.
         *
         * @param {Object} params Parameters to send to the web service.
         * @param {function} success The success callback to receive the data, "suspect" and "imprecise" data (if told to do so) will be implicitly filtered from the result.
         */
        getSummarizedData: function(params,success) {
            $http({
                method: 'POST',
                url: '/npn_portal/observations/getSummarizedData.json',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                transformRequest: txformUrlEncoded,
                data: addCommonParams(params)
            }).success(function(response){
                var filtered = response
                                .filter(filterSuspectSummaryData)
                                .filter(SettingsService.getSettingValue('filterLqdSummary') ? filterLqSummaryData : angular.identity);
                $log.debug('filtered out '+(response.length-filtered.length)+'/'+response.length+' suspect records or with negative num_days_prior_no.');
                success(filtered);
            });
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name getObservationDates
         * @description
         *
         * Issue a request for observation.  Common parameters will be implicitly added like
         * networks in the base filter or lists of sites if geographic filtering is enabled.
         *
         * @param {Object} params Parameters to send to the web service.
         * @param {function} success The success callback to receive the response data.
         */
        getObservationDates: function(params,success) {
            $http({
                method: 'POST',
                url: '/npn_portal/observations/getObservationDates.json',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                transformRequest: txformUrlEncoded,
                data: addCommonParams(params)
            }).success(success);
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name isFilterEmpty
         * @description
         *
         * Convenience shortcut to <code>FilterService.isFilterEmpty</code>.
         */
        isFilterEmpty: FilterService.isFilterEmpty,
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name getVisualizations
         * @description Get the coded list of visualization definitions.
         * @returns {Array} The visualization definitions for use by the UI control.
         */
        getVisualizations: function() {
            return VISUALIZATIONS;
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name openSingleStationVisualization
         * @description Open a visualization dialog focused on a single station.
         *
         * @param {string} station_id The station id.
         * @param {object} vis The visualization object.
         */
        openSingleStationVisualization: function(station_id,vis) {
            setVisualizeSingleStationId(station_id);
            var modal_instance = service.openVisualization(vis);
            if(modal_instance) {
                // when modal instance closes should unset single station id.
                modal_instance.result.then(setVisualizeSingleStationId,setVisualizeSingleStationId);
            } else {
                setVisualizeSingleStationId();
            }
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name openVisualization
         * @description Open a visualization dialog.
         *
         * @param {object} vis The visualization object.
         */
        openVisualization: function(vis) {
            if(!FilterService.isFilterEmpty()) {
                return $uibModal.open({
                    templateUrl: vis.template,
                    controller: vis.controller,
                    windowClass: 'vis-dialog-window',
                    backdrop: 'static',
                    keyboard: false,
                    size: 'lg'
                });
            }
        }
    };
    return service;
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis:vis-dialog
 * @module npn-viz-tool.vis
 * @description A visualization dialog
 *
 * @param {string} title The title.
 * @param {object} modal The modal dialog.
 */
.directive('visDialog',[function(){
    return {
        restrict: 'E',
        templateUrl: 'js/vis/visDialog.html',
        transclude: true,
        scope: {
            title: '@',
            modal: '='
        },
        controller: ['$scope',function($scope) {
        }]
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis:vis-control
 * @module npn-viz-tool.vis
 * @description The visualization slide out control.
 */
.directive('visControl',['ChartService',function(ChartService){
    return {
        restrict: 'E',
        templateUrl: 'js/vis/visControl.html',
        scope: {
        },
        controller: function($scope) {
            $scope.isFilterEmpty = ChartService.isFilterEmpty;
            $scope.open = ChartService.openVisualization;
            $scope.visualizations = ChartService.getVisualizations();
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis:vis-download
 * @module npn-viz-tool.vis
 * @description Vis download.
 */
.directive('visDownload',[function(){
    return {
        restrict: 'E',
        templateUrl: 'js/vis/visDownload.html',
        scope: {
            selector: '@',
            filename: '@'
        },
        controller: ['$scope',function($scope){
            $scope.download = function() {
                var chart = d3.select($scope.selector),
                    html = chart.attr('version', 1.1)
                                .attr('xmlns', 'http://www.w3.org/2000/svg')
                                .node().parentNode.innerHTML,
                    imgsrc = 'data:image/svg+xml;base64,'+ window.btoa(html),
                    canvas = document.querySelector('#visDownloadCanvas');
                canvas.width = chart.attr('width');
                canvas.height = chart.attr('height');

                var context = canvas.getContext('2d'),
                    image = new Image();
                image.onload = function() {
                    context.drawImage(image,0,0);
                    var canvasdata = canvas.toDataURL('image/png'),
                        a = $('#vis-download-link')[0];//document.createElement('a');
                    a.download = $scope.filename||'visualization.png';
                    a.href = canvasdata;
                    a.click();
                };
                image.src = imgsrc;
            };
        }]
    };
}]);