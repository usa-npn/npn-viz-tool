angular.module('npn-viz-tool.vis',[
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.vis-scatter',
    'npn-viz-tool.vis-calendar',
    'ui.bootstrap'
])
.factory('ChartService',['$window','$http','FilterService',function($window,$http,FilterService){
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
        };
    function filterSuspectSummaryData (d){
        var bad = (d.latitude === 0.0 || d.longitude === 0.0 || d.elevation_in_meters < 0);
        if(bad) {
            console.warn('suspect station data',d);
        }
        return !bad;
    }
    var service = {
        ONE_DAY_MILLIS: (24*60*60*1000),
        getSizeInfo: function(marginOverride){
            // make the chart 92% of the window width
            var margin = angular.extend({},MARGIN,marginOverride),
                cw = Math.round($window.innerWidth*0.92),
                ch = Math.round(cw*0.5376), // ratio based on initial w/h of 930/500
                w = cw  - margin.left - margin.right,
                h = ch  - margin.top - margin.bottom,
                sizing = {width: w, height : h, margin: margin};
            console.log('sizing',sizing);
            return sizing;
        },
        leastSquares: function(xSeries,ySeries) {
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
        approxY: function(leastSquaresCoeff,x) {
            // y = a + bx
            var a = leastSquaresCoeff[1],
                b = leastSquaresCoeff[0];
            return a + (b*x);
        },
        getSummarizedData: function(params,success) {
            // if geo filtering add the explicit station_ids in question.
            if(FilterService.getFilter().getGeoArgs().length) {
                FilterService.getFilteredMarkers().forEach(function(marker,i){
                    params['site_id['+i+']'] = marker.station_id;
                });
            }
            $http({
                method: 'POST',
                url: '/npn_portal/observations/getSummarizedData.json',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                transformRequest: function(obj) {
                    var encoded = [],key;
                    for(key in obj) {
                        encoded.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
                    }
                    return encoded.join('&');
                },
                data: params
            }).success(function(response){
                success(response.filter(filterSuspectSummaryData));
            });
        }
    };
    return service;
}])
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
.directive('visControl',['$modal',function($modal){
    var visualizations = [{
        title: 'Scatter Plot',
        controller: 'ScatterVisCtrl',
        template: 'js/scatter/scatter.html',
        description: 'This visualization allows you to plot various geographic or climactic variables on the X axis against Onset Day Of Year on the Y axis.  Up to three Species/Phenophase pairs may be plotted.'
    },{
        title: 'Calendar',
        controller: 'CalendarVisCtrl',
        template: 'js/calendar/calendar.html',
        description: 'This visualization illustrates phenophase activity for various species/phenophase pairs of your choosing.  Horizontal bars are graphed representing a "calendar" of phenological activity at a regional level for up to two years allowing year to year comparison of activity.'
    }];
    return {
        restrict: 'E',
        templateUrl: 'js/vis/visControl.html',
        scope: {

        },
        controller: function($scope) {
            $scope.visualizations = visualizations;
            $scope.open = function(vis) {
                $modal.open({
                    templateUrl: vis.template,
                    controller: vis.controller,
                    windowClass: 'vis-dialog-window',
                    backdrop: 'static',
                    keyboard: false,
                    size: 'lg'
                });
            };
        }
    };
}]);