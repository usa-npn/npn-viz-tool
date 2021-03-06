/**
 * @ngdoc overview
 * @name npn-viz-tool.gridded-services
 * @description
 *
 * Service support for gridded data map visualization.
 */
angular.module('npn-viz-tool.gridded-services', [
])
    .provider('$url', [function () {
        this.$get = ['$log', function ($log) {
            var BASE_URL = window.location.origin.replace('data', 'www');
            $log.debug('BASE_URL', BASE_URL);
            return function (path) {
                return BASE_URL + path;
            };
        }];
    }])
    .service('DateExtentUtil', [function () {
        var FMT_REGEX = /^(\d\d\d\d)-0?(\d+)-0?(\d+)/;
        return {
            parse: function (s) {
                var match = FMT_REGEX.exec(s.replace(/T.*$/, '')),
                    year = parseInt(match[1]),
                    month = parseInt(match[2]) - 1,
                    day = parseInt(match[3]);
                return new Date(year, month, day);
            }
        };
    }])
    /**
     * @ngdoc directive
     * @restrict E
     * @name npn-viz-tool.gridded-services:gridded-point-info-window
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * The base info window contents for gridded point data.  This directive doesn't
     * open the InfoWindow but is just used to render its contents (not intended for general re-use).
     *
     * @scope
     * @param {number} point The point data returned by the layer.
     * @param {object} layer The currently selected map layer.
     * @param {object} legend The legend for the currently selected layer.
     * @param {google.maps.LatLng} latLng The LatLng where the InfoWindow has been be opened.
     */
    .directive('griddedPointInfoWindow', ['$log', '$timeSeriesVis', '$q', '$http', function ($log, $timeSeriesVis, $q, $http) {
        return {
            restrict: 'E',
            template: '<div id="griddedPointInfoWindow" class="ng-cloak">' +
                '<div ng-if="!gridded_point_legend">loading AGDD...</div>' +
                '<div ng-if="gridded_point_legend" class="gridded-legend-color" style="background-color: {{gridded_point_legend.color}};">&nbsp;</div>' +
                '<div ng-if="gridded_point_legend" class="gridded-point-data">{{legend.formatPointData(point)}}</div>' +
                '<ul class="list-unstyled" ng-if="timeSeries">' +
                '<li><a href ng-click="timeSeries()">Show Accumulation</a></li>' +
                '</ul>' +
                //'<pre>\n{{gridded_point_data}}\n{{gridded_point_legend}}</pre>'+
                '</div>',
            scope: {
                point: '=',
                layer: '=',
                legend: '=',
                latLng: '='
            },
            link: function ($scope) {
                var latLng = $scope.latLng,
                    point = $scope.point,
                    layer = $scope.layer,
                    legend = $scope.legend;
                $log.debug('griddedPointInfoWindow:latLng', latLng);
                $log.debug('griddedPointInfoWindow:point', point);
                $log.debug('griddedPointInfoWindow:layer', layer);
                $log.debug('griddedPointInfoWindow:legend', legend);

                //for custom agdd we need geowebservice to compute point agdd
                var customAgdd = false,
                    startDate,
                    endDate,
                    lowerThreshold,
                    upperThreshold,
                    timeSeriesUrl;
                var nodeServer = 'https://data.usanpn.org/geoservices';
                if(location.hostname.includes('local') || location.hostname.includes('dev')) {
                    nodeServer = 'https://data-dev.usanpn.org/geoservices';
                }
                if (layer.pest == 'Eastern Tent Caterpillar' || layer.pest == 'Pine Needle Scale' || layer.pest == 'Bagworm') {
                    customAgdd = true;
                    startDate = layer.extent.current.date.getFullYear() + '-03-01';
                    endDate = layer.extent.current.date.toISOString().split('T')[0];
                    lowerThreshold = 50;
                    timeSeriesUrl = nodeServer + '/v1/agdd/simple/pointTimeSeries?climateProvider=NCEP&temperatureUnit=fahrenheit&startDate=' + startDate + '&endDate=' + endDate + '&base=' + lowerThreshold + '&latitude=' + latLng.lat() + '&longitude=' + latLng.lng();
                }
                if (layer.pest == 'Asian Longhorned Beetle' || layer.pest == 'Gypsy Moth') {
                    customAgdd = true;
                    startDate = layer.extent.current.date.getFullYear() + '-01-01';
                    endDate = layer.extent.current.date.toISOString().split('T')[0];
                    lowerThreshold = 50;
                    upperThreshold = 86;
                    if (layer.pest == 'Gypsy Moth') {
                        lowerThreshold = 37.4;
                        upperThreshold = 104;
                    }
                    timeSeriesUrl = nodeServer + '/v1/agdd/double-sine/pointTimeSeries?climateProvider=NCEP&temperatureUnit=fahrenheit&startDate=' + startDate + '&endDate=' + endDate + '&lowerThreshold=' + lowerThreshold + '&upperThreshold=' + upperThreshold + '&latitude=' + latLng.lat() + '&longitude=' + latLng.lng();
                }
                if (layer.pest == 'Bronze Birch Borer' || layer.pest == 'Emerald Ash Borer' || layer.pest == 'Lilac Borer' || layer.pest == 'Magnolia Scale') {
                    customAgdd = true;
                    startDate = layer.extent.current.date.getFullYear() + '-01-01';
                    endDate = layer.extent.current.date.toISOString().split('T')[0];
                    lowerThreshold = 50;
                    upperThreshold = 150;
                    timeSeriesUrl = nodeServer + '/v0/agdd/double-sine/pointTimeSeries?climateProvider=NCEP&temperatureUnit=fahrenheit&startDate=' + startDate + '&endDate=' + endDate + '&lowerThreshold=' + lowerThreshold + '&upperThreshold=' + upperThreshold + '&latitude=' + latLng.lat() + '&longitude=' + latLng.lng();
                }
                if (customAgdd) {
                    // if(location.hostname.indexOf('dev') != -1) {
                    // pestUrl = 'https://data-dev.usanpn.org:3006/v1/phenoforecasts/pestMap?species=' + pest + '&date=' + l.extent.current.value.substring(0,10);
                    // }
                    var self = this,
                        def = $q.defer();
                    $scope.point = '';
                    $http.get(timeSeriesUrl, {
                        params: {}
                    }).then(function (response) {
                        console.log(response.data);
                        var ts = response.data.timeSeries;
                        if (ts.length < 1) {
                            $scope.point = 0;
                        } else {
                            $scope.point = ts[ts.length - 1].agdd;
                        }
                        $scope.gridded_point_legend = $scope.legend.getPointData($scope.point);
                    }, def.reject);
                } else {
                    $scope.gridded_point_legend = $scope.legend.getPointData(point);
                }
                if (layer.supports_time_series) {
                    $scope.timeSeries = function () {
                        $timeSeriesVis(layer, legend, latLng);
                    };
                }
            }
        };
    }])
    /**
     * @ngdoc object
     * @name npn-viz-tool.gridded-services:GriddedInfoWindowHandler
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Injectable class that can be used to produce InfoWindows for a specific map given LatLng, Layer and Legend objects.
     */
    .factory('GriddedInfoWindowHandler', ['$log', '$timeout', '$compile', '$rootScope', function ($log, $timeout, $compile, $rootScope) {
        function GriddedInfoWindowHandler(map) {
            this.map = map;
        }
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded-services:GriddedInfoWindowHandler
         * @name  open
         * @description
         *
         * Open an InfoWindow containing gridded point data if all that's necessary is supplied.
         * This function can be called lazily without checking references, it will do nothing if any
         * of the required input is missing (all parameters).
         *
         * @param {google.maps.LatLng} latLng The LatLng where the InfoWindow should be opened.
         * @param {npn-viz-tool.gridded-services:WmsMapLayer} layer The layer the gridded data should come from.
         * @param {npn-viz-tool.gridded-services:WmsMapLegend} legnend The legend associated with the layer that can be used for format gridded response data.
         */
        GriddedInfoWindowHandler.prototype.open = function (latLng, layer, legend) {
            var map = this.map, infoWindow;
            if (latLng && layer && legend) {
                if (!this.infoWindow) {
                    this.infoWindow = new google.maps.InfoWindow({
                        maxWidth: 200,
                        content: 'contents'
                    });
                }
                infoWindow = this.infoWindow;
                layer.getGriddedData(latLng)
                    .then(function (tuples) {
                        $log.debug('tuples', tuples);
                        var compiled,
                            point = tuples && tuples.length ? tuples[0] : undefined,
                            $scope = $rootScope.$new();
                        if (point === -9999 || isNaN(point)) {
                            $log.debug('received -9999 or Nan ignoring');
                            return;
                        }
                        if (typeof ($scope.point = point) === 'undefined') {
                            $log.debug('undefined point?');
                            return;
                        }
                        $scope.layer = layer;
                        $scope.legend = legend;
                        $scope.latLng = latLng;
                        compiled = $compile('<div><gridded-point-info-window point="point" layer="layer" legend="legend" lat-lng="latLng"></gridded-point-info-window></div>')($scope);
                        $timeout(function () {
                            infoWindow.setContent(compiled[0]);
                            infoWindow.setPosition(latLng);
                            infoWindow.open(map);
                        });
                    }, function () {
                        $log.error('unable to get gridded data.');
                    });
            }
        };
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded-services:GriddedInfoWindowHandler
         * @name  close
         * @description
         *
         * Closes any currently open InfoWindow.
         */
        GriddedInfoWindowHandler.prototype.close = function () {
            if (this.infoWindow) {
                this.infoWindow.close();
            }
        };
        return GriddedInfoWindowHandler;
    }])
    /**
     * @ngdoc directive
     * @restrict E
     * @name npn-viz-tool.gridded-services:gridded-opacity-slider
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Dynamically controls the opacity of map tiles.
     *
     * @scope
     * @param {object} layer The currently selected map layer.
     */
    .directive('griddedOpacitySlider', ['$log', '$timeout', 'WmsService', function ($log, $timeout, WmsService) {
        return {
            restrict: 'E',
            template: '<div ng-if="layer" class="form-group">' +
                '<label for="griddedOpacitySlider" style="margin-bottom: 15px;">Opacity</label>' +
                '<rzslider rz-slider-model="selection.opacity" rz-slider-options="options"></rzslider>' +
                '</div>',
            scope: {
                layer: '='
            },
            link: function ($scope) {
                $scope.selection = {
                    opacity: 75
                };
                $scope.options = {
                    floor: 0,
                    ceil: 100,
                    step: 1
                };
                function updateOpacity() {
                    if ($scope.layer) {
                        $scope.layer.googleLayer.setOpacity($scope.selection.opacity / 100.0);
                    }
                }
                $scope.$watch('layer.extent.current', updateOpacity);
                $scope.$watch('selection.opacity', updateOpacity);
                $scope.$watch('layer', updateOpacity);
            }
        };
    }])
    /**
     * @ngdoc directive
     * @restrict E
     * @name npn-viz-tool.gridded-services:gridded-range-slider
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Dynamically controls the opacity ranges of the data from the WMS Server.
     *
     * @scope
     * @param {object} layer The currently selected map layer.
     */
    .directive('griddedRangeSlider', ['$log', '$timeout', 'WmsService', function ($log, $timeout, WmsService) {
        return {
            restrict: 'E',
            template: '<div ng-if="legend" class="form-group">' +
                '<label for="griddedRangeSlider" style="margin-bottom: 15px;">Range</label>' +
                '<rzslider rz-slider-model="selection.min" rz-slider-high="selection.max" rz-slider-options="options"></rzslider>' +
                '</div>',
            scope: {
                layer: '='
            },
            link: function ($scope) {
                $scope.$watch('layer', function (layer) {
                    delete $scope.legend;
                    if (layer) {
                        layer.getLegend().then(function (legend) {
                            $scope.legend = legend;
                            $log.debug('legend', legend);
                            var data = $scope.data = legend.getData(),
                                existingRange = layer.getStyleRange();
                            $scope.selection = {
                                min: (existingRange ? existingRange[0] : 0),
                                max: (existingRange ? existingRange[1] : (data.length - 1))
                            };
                            $scope.options = {
                                //showTickValues: false,
                                floor: 0,
                                ceil: (data.length - 1),
                                step: 1,
                                showTicks: true,
                                showSelectionBar: true,
                                translate: function (n) {
                                    return data[n].label;
                                },
                                getTickColor: function (n) {
                                    return data[n].color;
                                },
                                getPointerColor: function (n) {
                                    return data[n].color;
                                },
                                getSelectionBarColor: function (n) {
                                    return data[n].color;
                                }
                            };
                        });
                    }
                });
                var timer;
                function updateRange() {
                    if (timer) {
                        $timeout.cancel(timer);
                    }
                    timer = $timeout(function () {
                        var layer = $scope.layer,
                            legend = $scope.legend,
                            data = $scope.data;
                        if (legend && data) {
                            if ($scope.selection.min === $scope.options.floor &&
                                $scope.selection.max === $scope.options.ceil) {
                                // they have selected the complete range, don't send the style
                                // definition with map tile requests...
                                return layer.setStyleRange(undefined);
                            }
                            layer.setStyleRange([$scope.selection.min, $scope.selection.max]);
                        }
                    }, 500);
                }
                $scope.$watch('selection.min', updateRange);
                $scope.$watch('selection.max', updateRange);
            }
        };
    }])
    /**
     * @ngdoc directive
     * @restrict E
     * @name npn-viz-tool.gridded-services:map-vis-doy-control
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * control for day of year extents.
     *
     * @scope
     * @param {object} layer The currently selected map layer.
     */
    .directive('griddedDoyControl', ['$log', 'thirtyYearAvgDayOfYearFilter', function ($log, thirtyYearAvgDayOfYearFilter) {
        var BASE_YEAR = thirtyYearAvgDayOfYearFilter(1, true).getFullYear(),
            ONE_DAY = (24 * 60 * 60 * 1000),
            MONTHS = d3.range(0, 12).map(function (m) { return new Date(BASE_YEAR, m); });
        function getDaysInMonth(date) {
            var month = date.getMonth(),
                tmp;
            if (month === 11) {
                return 31;
            }
            tmp = new Date(date.getTime());
            tmp.setDate(1);
            tmp.setMonth(tmp.getMonth() + 1);
            tmp.setTime(tmp.getTime() - ONE_DAY);
            $log.debug('last day of month ' + (month + 1) + ' is ' + tmp);
            return tmp.getDate();
        }
        return {
            restrict: 'E',
            templateUrl: 'js/gridded/doy-control.html',
            scope: {
                layer: '='
            },
            link: function ($scope) {
                $scope.months = MONTHS;
                var currentDate;
                $scope.$watch('layer', function (layer) {
                    currentDate = thirtyYearAvgDayOfYearFilter($scope.layer.extent.current.value, true);
                    $scope.selection = {
                        month: MONTHS[currentDate.getMonth()],
                        date: currentDate.getDate()
                    };
                });
                function dateWatch(date) {
                    $scope.selection.month.setDate(date);
                    // this feels a little hoakey matching on label but...
                    var label = thirtyYearAvgDayOfYearFilter($scope.selection.month);
                    $log.debug('doy-control:date ' + label);
                    $scope.layer.extent.current = $scope.layer.extent.values.reduce(function (current, v) {
                        return current || (v.label === label ? v : undefined);
                    }, undefined);
                }
                $scope.$watch('selection.month', function (month) {
                    $log.debug('doy-control:month ' + (month.getMonth() + 1), month);
                    $scope.dates = d3.range(1, getDaysInMonth(month) + 1);
                    if (currentDate) {
                        currentDate = undefined; // ignore layer watch init'ed date
                    } else if ($scope.selection.date === 1) {
                        dateWatch(1); // month change without date change, need to force the extent to update.
                    } else {
                        $scope.selection.date = 1;
                    }
                });
                $scope.$watch('selection.date', dateWatch);
            }
        };
    }])
    /**
     * @ngdoc directive
     * @restrict E
     * @name npn-viz-tool.gridded-services:map-vis-year-control
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Control for year extents.
     *
     * @scope
     * @param {object} layer The currently selected map layer.
     */
    .directive('griddedYearControl', ['$log', function ($log) {
        return {
            restrict: 'E',
            templateUrl: 'js/gridded/year-control.html',
            scope: {
                layer: '='
            },
            link: function ($scope) {
            }
        };
    }])
    /**
     * @ngdoc directive
     * @restrict E
     * @name npn-viz-tool.gridded-services:map-vis-date-control
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Control for date extents.
     *
     * @scope
     * @param {object} layer The currently selected map layer.
     */
    .directive('griddedDateControl', ['$log', 'dateFilter', function ($log, dateFilter) {
        return {
            restrict: 'E',
            templateUrl: 'js/gridded/date-control.html',
            scope: {
                layer: '='
            },
            link: function ($scope) {
                // TODO - hide the today/clear buttons
                $scope.$watch('layer', function (layer) {
                    if (layer && layer.extent.current) {
                        $scope.options = {
                            minDate: layer.extent.values[0].date,
                            maxDate: layer.extent.values[layer.extent.values.length - 1].date
                        };
                        $scope.selection = layer.extent.current.date;
                    }
                }, false);
                $scope.open = function () {
                    $scope.isOpen = true;
                };
                $scope.$watch('selection', function (date) {
                    $log.debug('selection', date);
                    var fmt = 'longDate',
                        formattedDate = dateFilter(date, fmt);
                    $scope.layer.extent.current = $scope.layer.extent.values.reduce(function (current, value) {
                        return current || (formattedDate === dateFilter(value.date, fmt) ? value : undefined);
                    }, undefined);

                });
            }
        };
    }])
    /**
     * @ngdoc directive
     * @restrict E
     * @name npn-viz-tool.gridded-services:map-vis-date-control
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Control for pest date extents.
     *
     * @scope
     * @param {object} layer The currently selected map layer.
     */
    .directive('pestDateControl', ['$log', 'dateFilter', function ($log, dateFilter) {
        return {
            restrict: 'E',
            templateUrl: 'js/pest/date-control.html',
            scope: {
                layer: '='
            },
            link: function ($scope) {
                // TODO - hide the today/clear buttons
                $scope.$watch('layer', function (layer) {
                    if (layer && layer.extent.current) {
                        $scope.options = {
                            minDate: new Date(new Date().getFullYear() - 1, 0, 1),
                            maxDate: new Date(new Date().getTime() + (6 * 24 * 60 * 60 * 1000))
                        };
                        $scope.selection = layer.extent.current.date;
                    }
                }, true);
                $scope.open = function () {
                    $scope.isOpen = true;
                };
                $scope.$watch('selection', function (date) {
                    $log.debug('selection', date);
                    var fmt = 'longDate',
                        formattedDate = dateFilter(date, fmt);
                    $scope.layer.extent.current = $scope.layer.extent.values.reduce(function (current, value) {
                        return current || (formattedDate === dateFilter(value.date, fmt) ? value : undefined);
                    }, undefined);
                });
            }
        };
    }])
    /**
     * @ngdoc directive
     * @restrict E
     * @name npn-viz-tool.gridded-services:map-vis-layer-control
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Directive to control categorized selection of WMS layers.  This directive
     * shares the parent scope.
     */
    .directive('pestLayerControl', ['$log', function ($log) {
        return {
            restrict: 'E',
            templateUrl: 'js/pest/pest-layer-control.html',
            link: function ($scope) {
                $scope.categories = ['Insect Pest Forecast', 'Tree Budburst Forecast', 'Pollen Forecast'];
                $scope.pests = ['Apple Maggot', 'Asian Longhorned Beetle', 'Bagworm', 'Bronze Birch Borer', 'Eastern Tent Caterpillar', 'Emerald Ash Borer', 'Gypsy Moth', 'Hemlock Woolly Adelgid', 'Magnolia Scale', 'Lilac Borer', 'Pine Needle Scale', 'Winter Moth', 'Buffelgrass', 'Winter Wheat'];
            }
        };
    }])
    /**
     * @ngdoc directive
     * @restrict E
     * @name npn-viz-tool.gridded-services:map-vis-layer-control
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Directive to control categorized selection of WMS layers.  This directive
     * shares the parent scope.
     */
    .directive('griddedLayerControl', ['$log', function ($log) {
        return {
            restrict: 'E',
            templateUrl: 'js/gridded/layer-control.html',
            link: function ($scope) {
            }
        };
    }])
    /**
     * @ngdoc directive
     * @restrict E
     * @name npn-viz-tool.gridded-services:map-vis-legend
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Directive to dynamically display an interactive legend for a seleted map layer.
     *
     * @scope
     * @param {object} legend The legend of the currently selected layer.
     */
    .directive('pestLegend', ['$log', '$window', function ($log, $window) {
        // geoserver-dev.usanpn.org/geoserver/rest/workspaces/gdd/styles/emerald_ash_borer.sld
        return {
            restrict: 'E',
            templateUrl: 'js/gridded/pest-legend.html',
            scope: {
                legendId: '@',
                legend: '='
            },
            link: function ($scope, $element) {
                var svgElement = $element.find('svg')[0];
                function redraw() {
                    var legend = $scope.legend,
                        svg = d3.select(svgElement);

                    svg.selectAll('g').remove(); // clean slate
                    if (!legend) {
                        return;
                    }
                    $log.debug('legend.title', legend.getTitle());
                    $log.debug('legend.length', legend.length);
                    $log.debug('legend.colors', legend.getColors());
                    $log.debug('legend.quantities', legend.getQuantities());
                    $log.debug('legend.labels', legend.getLabels());
                    $log.debug('legend.original_labels', legend.getOriginalLabels());

                    var width = parseFloat(svg.style('width').replace('px', '')),
                        height = parseFloat(svg.style('height').replace('px', '')),
                        data = legend.getData(),
                        cell_width = 20,
                        cell_height = 20,
                        top_pad = 35;

                    //remove ignores
                    var newData = [];
                    for (var j = 0; j < data.length; j++) {
                        if (data[j].original_label.indexOf('ignore') == -1) {
                            newData.push(data[j]);
                        }
                    }
                    data = newData;

                    $log.debug('svg dimensions', width, height);
                    $log.debug('legend cell width', cell_width);

                    var g = svg.append('g'),
                        cell = g.selectAll('g.cell')
                            .data(data)
                            .enter()
                            .append('g')
                            .attr('class', 'cell')
                            .attr('transform', function (d, i) { return 'translate(' + 0 + ',' + (i * cell_width) + ')'; }) //{ return 'translate('+(i*cell_width)+','+top_pad+')'; }
                            .append('rect')
                            .attr('height', cell_height)
                            .attr('width', cell_width)
                            .style('stroke', 'black')
                            .style('stroke-width', '1px')
                            .style('fill', function (d, i) { return d.color; });

                    cell.append('title')
                        .text(function (d) { return d.label; });

                    function label_cell(cell, label, anchor) {
                        cell.append('text')
                            .attr('dx', '2.4em')
                            .attr('dy', (cell_width / 1.5)/*cell_height+tick_length+(2*tick_padding)*/) // need to know line height of text
                            .style('text-anchor', anchor)
                            .text(label);
                    }
                    var cells = g.selectAll('g.cell')[0],
                        mid_idx = Math.floor(cells.length / 2);

                    for (var i = 0; i < data.length; i++) {
                        label_cell(d3.select(cells[i]), data[i].original_label, 'start');
                    }

                    var legendHeight = cell_height * data.length;

                    var pLegend = document.getElementsByClassName('pest-legend');
                    pLegend[0].style.height = legendHeight + 48 + 10 + 'px';
                    if (legend.pest == 'Hemlock Woolly Adelgid' || legend.pest == 'Asian Longhorned Beetle' || legend.pest == 'Eastern Tent Caterpillar' || legend.pest == 'Magnolia Scale' || legend.pest == 'Pine Needle Scale' || legend.pest == 'Winter Moth' || legend.pest == 'Bagworm' || legend.pest == 'Gypsy Moth') {
                        pLegend[0].style.width = 445 + 'px';
                    } else {
                        pLegend[0].style.width = 350 + 'px';
                    }
                    // pLegend[0].style.width = 405 + 'px';

                    var agddSubtext = null;
                    if(legend.pest == 'Emerald Ash Borer' || legend.pest == 'Lilac Borer' || legend.pest == 'Apple Maggot' || legend.pest == 'Winter Moth' || legend.pest == 'Magnolia Scale' || legend.pest == 'Bronze Birch Borer') {
                        agddSubtext = 'Base: 50°F, Start: Jan 1';
                    } else if(legend.pest == 'Pine Needle Scale' || legend.pest == 'Eastern Tent Caterpillar' || legend.pest == 'Bagworm') {
                        agddSubtext = 'Base: 50°F, Start: Mar 1';
                    } else if(legend.pest == 'Gypsy Moth') {
                        agddSubtext = 'Base: 37.4°F, Upper: 104°F, Start: Jan 1';
                    } else if(legend.pest == 'Asian Longhorned Beetle') {
                        agddSubtext = 'Base: 50°F, Upper: 86°F, Start: Jan 1';
                    } else if (legend.pest == 'Hemlock Woolly Adelgid') {
                        agddSubtext = 'Base: 32°F, Start: Jan 1';
                    }
                    if(agddSubtext) {
                        svg.append('g').append('text').attr('dx',5)
                        .attr('dy',20+legendHeight)
                        .attr('font-size', '16px')
                        .attr('text-anchor','right').text(legend.pest + ' Forecast' + ', ' + legend.ldef.extent.current.label);
    
                        svg.append('g').append('text').attr('dx',5)
                       .attr('dy',38+legendHeight)
                       .attr('font-size', '14px')
                       .attr('text-anchor','right').text(agddSubtext);
    
                        svg.append('g').append('text').attr('dx',5)
                       .attr('dy',54+legendHeight)
                       .attr('font-size', '11px')
                       .attr('text-anchor','right').text('USA National Phenology Network, www.usanpn.org');
                    } else {
                        svg.append('g').append('text').attr('dx',5)
                        .attr('dy',30+legendHeight)
                        .attr('font-size', '16px')
                        .attr('text-anchor','right').text(legend.pest + ' Forecast' + ', ' + legend.ldef.extent.current.label);
    
                        svg.append('g').append('text').attr('dx',5)
                       .attr('dy',48+legendHeight)
                       .attr('font-size', '11px')
                       .attr('text-anchor','right').text('USA National Phenology Network, www.usanpn.org');
                    }

                    // svg.append('g').append('text').attr('dx', 5)
                    //     .attr('dy', 30 + legendHeight)
                    //     .attr('font-size', '16px')
                    //     .attr('text-anchor', 'right').text(legend.pest + ' Forecast' + ', ' + legend.ldef.extent.current.label);

                    // svg.append('g').append('text').attr('dx', 5)
                    //     .attr('dy', 48 + legendHeight)
                    //     .attr('font-size', '11px')
                    //     .attr('text-anchor', 'right').text('USA National Phenology Network, www.usanpn.org');

                }
                $scope.$watch('legend', redraw);

                $($window).bind('resize', redraw);
                $scope.$watch('legend.layer.extent.current', redraw);
                $scope.$on('$destroy', function () {
                    $log.debug('legend removing resize handler');
                    $($window).unbind('resize', redraw);
                });
            }
        };
    }])
    /**
     * @ngdoc filter
     * @name npn-viz-tool.gridded-services:thirtyYearAvgDayOfYear
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Filter that translates a doy value (number) into date text of 'Month day'
     * this filter uses a base year of 2010 since the 30 yr avg layers are based on
     * 1981-2010 and 2010 is known to have been a 365 day year (unlike, for instance,
     * 2016 which has 366 days).
     */
    .filter('thirtyYearAvgDayOfYear', ['dateFilter', function (dateFilter) {
        var JAN_ONE = new Date(2010/*(new Date()).getFullYear()*/, 0),
            ONE_DAY = (24 * 60 * 60 * 1000);
        return function (doy, return_date) {
            if (typeof (doy) === 'string') {
                doy = parseFloat(doy);
            }
            var date = doy instanceof Date ? doy : new Date(JAN_ONE.getTime() + ((doy - 1) * ONE_DAY));
            return return_date ? date : dateFilter(date, 'MMMM d');
        };
    }])
    /**
     * @ngdoc directive
     * @restrict E
     * @name npn-viz-tool.gridded-services:map-vis-legend
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Directive to dynamically display an interactive legend for a seleted map layer.
     *
     * @scope
     * @param {object} legend The legend of the currently selected layer.
     */
    .directive('griddedLegend', ['$log', '$window', function ($log, $window) {
        return {
            restrict: 'E',
            templateUrl: 'js/gridded/legend.html',
            scope: {
                legendId: '@',
                legend: '='
            },
            link: function ($scope, $element) {
                var svgElement = $element.find('svg')[0];
                function redraw() {
                    var legend = $scope.legend,
                        svg = d3.select(svgElement);

                    svg.selectAll('g').remove(); // clean slate
                    if (!legend) {
                        return;
                    }
                    $log.debug('legend.title', legend.getTitle());
                    $log.debug('legend.length', legend.length);
                    $log.debug('legend.colors', legend.getColors());
                    $log.debug('legend.quantities', legend.getQuantities());
                    $log.debug('legend.labels', legend.getLabels());
                    $log.debug('legend.original_labels', legend.getOriginalLabels());

                    var width = parseFloat(svg.style('width').replace('px', '')),
                        height = parseFloat(svg.style('height').replace('px', '')),
                        data = legend.getData(),
                        cell_width = width / data.length,
                        cell_height = 30,
                        top_pad = 2;
                    $log.debug('svg dimensions', width, height);
                    $log.debug('legend cell width', cell_width);

                    var g = svg.append('g'),
                        cell = g.selectAll('g.cell')
                            .data(data)
                            .enter()
                            .append('g')
                            .attr('class', 'cell')
                            .attr('transform', function (d, i) { return 'translate(' + (i * cell_width) + ',' + top_pad + ')'; })
                            .append('rect')
                            .attr('height', cell_height)
                            .attr('width', cell_width)
                            .style('stroke', 'black')
                            .style('stroke-width', '1px')
                            .style('fill', function (d, i) { return d.color; });


                    if (legend.ldef.legend_delimiter_every) {
                        var every = legend.ldef.legend_delimiter_every,
                            first_every = false,
                            running_total = 0,
                            separators = data.map(function (d, i) {
                                if ((i + 1) === data.length) {
                                    return true;
                                }
                                running_total += (data[i + 1].quantity - data[i].quantity);
                                if (running_total >= every) {
                                    running_total = 0;
                                    return true;
                                }
                                return false;
                            }),
                            top_bottom = [(cell_width + 1), cell_height, (cell_width + 1), cell_height].join(','), //{ stroke-dasharray: $w,$h,$w,$h }
                            top_right_bottom = [((cell_width * 2) + cell_height), cell_height].join(','), //{ stroke-dasharray: (($w*2)+$h),$h }
                            top_left_bottom = [(cell_width + 1), cell_height, (cell_width + cell_height + 1), 0].join(','); ////{ stroke-dasharray: $w,$h,($w+$h),0 }

                        $log.debug('legend_delimiter_every', every);
                        cell.style('stroke-dasharray', function (d, i) {
                            if (i === 0) {
                                return separators[i] ? undefined : top_left_bottom;
                            }
                            return separators[i] ? top_right_bottom : top_bottom;
                        })
                            // top_bottom removes the left/right borders which leaves a little whitespace
                            // which looks odd so in cases where there is no right border increase a cell's width
                            // by 1px to cover that gap
                            .attr('width', function (d, i) {
                                var w = parseFloat(d3.select(this).attr('width'));
                                if (i === 0) {
                                    return separators[i] ? w : w + 1;
                                }
                                return separators[i] ? w : w + 1;
                            });
                        g.selectAll('g.cell').append('line')
                            .attr('stroke', function (d, i) { return separators[i] ? 'black' : 'none'; })
                            .attr('stroke-width', 2)
                            .attr('x1', cell_width - 1)
                            .attr('x2', cell_width - 1)
                            .attr('y1', 0)
                            .attr('y2', cell_height);
                    }
                    cell.append('title')
                        .text(function (d) { return d.label; });

                    var tick_length = 5,
                        tick_padding = 3;

                    function label_cell(cell, label, anchor) {
                        var tick_start = (top_pad + cell_height + tick_padding);
                        cell.append('line')
                            .attr('x1', (cell_width / 2))
                            .attr('y1', tick_start)
                            .attr('x2', (cell_width / 2))
                            .attr('y2', tick_start + tick_length)
                            .attr('stroke', 'black')
                            .attr('stroke-width', '1');
                        cell.append('text')
                            .attr('dx', (cell_width / 2))
                            .attr('dy', '3.8em'/*cell_height+tick_length+(2*tick_padding)*/) // need to know line height of text
                            .style('text-anchor', anchor)
                            .text(label);
                    }
                    var cells = g.selectAll('g.cell')[0],
                        mid_idx = Math.floor(cells.length / 2);
                    label_cell(d3.select(cells[0]), data[0].label, 'start');
                    label_cell(d3.select(cells[mid_idx]), data[mid_idx].label, 'middle');
                    label_cell(d3.select(cells[cells.length - 1]), data[data.length - 1].label, 'end');

                    if (legend.ldef.legend_units) {
                        svg.append('g')
                            .append('text')
                            .attr('dx', (width / 2))
                            .attr('dy', 75 + top_pad)
                            .attr('text-anchor', 'middle')
                            .text(legend.ldef.legend_units);
                    }

                    if(legend.ldef.extent && legend.ldef.extent.current) {
                        svg.append('g').append('text').attr('dx', 5)
                        .attr('dy', 100 + top_pad)
                        .attr('font-size', '18px')
                        .attr('text-anchor', 'right').text(legend.ldef.title + ', ' + legend.ldef.extent.current.label);
                    } else { //inca //todo get title text
                        svg.append('g').append('text').attr('dx', 5)
                        .attr('dy', 100 + top_pad)
                        .attr('font-size', '18px')
                        .attr('text-anchor', 'right').text(legend.ldef.title + ' (2001-2017)');
                    }

                    svg.append('g').append('text').attr('dx', 5)
                        .attr('dy', 118 + top_pad)
                        .attr('font-size', '11px')
                        .attr('text-anchor', 'right').text('USA National Phenology Network, www.usanpn.org');

                }
                $scope.$watch('legend', redraw);

                $($window).bind('resize', redraw);
                $scope.$watch('legend.layer.extent.current', redraw);
                $scope.$on('$destroy', function () {
                    $log.debug('legend removing resize handler');
                    $($window).unbind('resize', redraw);
                });
            }
        };
    }])
    /**
     * @ngdoc filter
     * @name npn-viz-tool.gridded-services:thirtyYearAvgDayOfYear
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Filter that translates a doy value (number) into date text of 'Month day'
     * this filter uses a base year of 2010 since the 30 yr avg layers are based on
     * 1981-2010 and 2010 is known to have been a 365 day year (unlike, for instance,
     * 2016 which has 366 days).
     */
    .filter('thirtyYearAvgDayOfYear', ['dateFilter', function (dateFilter) {
        var JAN_ONE = new Date(2010/*(new Date()).getFullYear()*/, 0),
            ONE_DAY = (24 * 60 * 60 * 1000);
        return function (doy, return_date) {
            if (typeof (doy) === 'string') {
                doy = parseFloat(doy);
            }
            var date = doy instanceof Date ? doy : new Date(JAN_ONE.getTime() + ((doy - 1) * ONE_DAY));
            return return_date ? date : dateFilter(date, 'MMMM d');
        };
    }])
    /**
     * @ngdoc filter
     * @name npn-viz-tool.gridded-services:legendDoy
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Simplified version of thirtyYearAvgDayOfYear that simply takes a number day of year
     * and returns a formatted date.  The optional second argument defines the date format
     * which defaults to 'MMM d'.  The optional third argument defines whether or not the
     * current year should be used as oposed to one known to have 365 days (2010).
     *
     * This filter equates doy 0 with doy 1 since legend scales are inconsistent in this regard.
     *
     * @example
     * <pre>
     * $filter('legendDoy')(1.0,undefined,true|false|undefined); // Jan 1
     * </pre>
     */
    .filter('legendDoy', ['dateFilter', function (dateFilter) {
        var JAN_ONE_2010 = new Date(2010/*(new Date()).getFullYear()*/, 0),
            JAN_ONE_THIS_YEAR = new Date((new Date()).getFullYear(), 0),
            ONE_DAY = (24 * 60 * 60 * 1000);
        return function (doy, fmt, current_year) {
            doy = Math.round(doy);
            if (doy === 0) {
                doy = 1;
            }
            fmt = fmt || 'MMM d'; // e.g. Jan 1
            return dateFilter(new Date((current_year ? JAN_ONE_THIS_YEAR : JAN_ONE_2010).getTime() + ((doy - 1) * ONE_DAY)), fmt);
        };
    }])
    /**
     * @ngdoc filter
     * @name npn-viz-tool.gridded-services:legendGddUnits
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Formats legend numbers for gdd units.
     *
     * @example
     * <pre>
     * $filter('legendGddUnits')(10.0) // 10 GDD
     * </pre>
     */
    .filter('legendGddUnits', ['numberFilter', function (numberFilter) {
        return function (n, includeUnits) {
            return numberFilter(n, 0) + (includeUnits ? ' AGDD' : '');
        };
    }])
        /**
     * @ngdoc filter
     * @name npn-viz-tool.gridded-services:legendInchesUnits
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Formats legend numbers for inches units.
     *
     * @example
     * <pre>
     * $filter('legendInchesUnits')(10.0) // 10 GDD
     * </pre>
     */
    .filter('legendInchesUnits', ['numberFilter', function (numberFilter) {
        return function (n, includeUnits) {
            return n.toFixed(2) + (includeUnits ? ' inches' : '');
        };
    }])
    /**
     * @ngdoc filter
     * @name npn-viz-tool.gridded-services:legendDegrees
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Formats legend numbers in degrees, assumes F if no unit supplied.
     *
     * @example
     * <pre>
     * $filter('legendDegrees')(10) // 10&deg;F
     * </pre>
     */
    .filter('legendDegrees', ['numberFilter', function (numberFilter) {
        return function (n, unit) {
            return numberFilter(n, 0) + '\u00B0' + (unit || 'F');
        };
    }])
    /**
     * @ngdoc filter
     * @name npn-viz-tool.gridded-services:legendAgddAnomaly
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Formats legend numbers for agdd anomaly layers.
     */
    .filter('legendAgddAnomaly', ['numberFilter', function (numberFilter) {
        return function (n, includeUnits) {
            if (n === 0) {
                return 'No Difference';
            }
            var lt = n < 0;
            return numberFilter(Math.abs(n), 0) + (includeUnits ? ' AGDD ' : ' ') + (lt ? '<' : '>') + ' Avg';
        };
    }])
    /**
     * @ngdoc filter
     * @name npn-viz-tool.gridded-services:agddDefaultTodayElevation
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Selects a default extent value for a doy layer of "today" (if found among the possibilities).
     */
    .filter('agddDefaultTodayElevation', ['dateFilter', function (dateFilter) {
        var todayLabel = dateFilter(new Date(), 'MMMM d');
        return function (values) {
            return values.reduce(function (dflt, v) {
                return dflt || (v.label == todayLabel ? v : undefined);
            }, undefined);
        };
    }])
    /**
     * @ngdoc filter
     * @name npn-viz-tool.gridded-services:agddDefaultTodayTime
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Selects a default extent value for a time layer of "today" (if found among the possibilities).
     */
    .filter('agddDefaultTodayTime', ['dateFilter', function (dateFilter) {
        var todayLabel = dateFilter(new Date(), 'longDate');
        return function (values) {
            return values.reduce(function (dflt, v) {
                return dflt || (v.label == todayLabel ? v : undefined);
            }, undefined);
        };
    }])
    /**
     * @ngdoc filter
     * @name npn-viz-tool.gridded-services:legendSixAnomaly
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Formats legend numbers for spring index anomaly layers
     */
    .filter('legendSixAnomaly', [function () {
        return function (n) {
            if (n === 0) {
                return 'No Difference';
            }
            var lt = n < 0,
                abs = Math.abs(n);
            return abs + ' Days ' + (lt ? 'Early' : 'Late');
        };
    }])
    /**
     * @ngdoc filter
     * @name npn-viz-tool.gridded-services:extentDates
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Filters an array of extent dates relative to days.
     * @example
     * <pre>
     * //$filter('extentDates')(dates,<after>,<before>);
     * $filter('extentDates')(dates,undefined,'today'); // before today
     * $filter('extentDates')(dates,'today',undefined); // after today
     * $filter('extentDates')(dates,undefined,'05-01'); // before may 1st of this year
     * $filter('extentDates')(dates,undefined,'2020-05-01T00:00:00.000Z'); // before may 1st of 2020
     * </pre>
     */
    .filter('extentDates', ['$log', 'dateFilter', 'DateExtentUtil', function ($log, dateFilter, DateExtentUtil) {
        var ONE_DAY = (24 * 60 * 60 * 1000);
        function toTime(s) {
            var d = new Date();
            if (s === 'yesterday' || s === 'today' || s === 'tomorrow') {
                if (s === 'yesterday') {
                    d.setTime(d.getTime() - ONE_DAY);
                } else if (s === 'tomorrow') {
                    d.setTime(d.getTime() + ONE_DAY);
                }
                s = dateFilter(d, 'yyyy-MM-dd 00:00:00');
            } else if (s.indexOf('T') === -1) {
                s = d.getFullYear() + '-' + s + ' 00:00:00';
            }
            return DateExtentUtil.parse(s).getTime();
        }
        return function (arr, after, before) {
            var a = after ? toTime(after) : undefined,
                b = before ? toTime(before) : undefined;
            if (a || b) {
                arr = arr.filter(function (d) {
                    var t = DateExtentUtil.parse(d).getTime();
                    return (!a || (a && t > a)) && (!b || (b && t < b));
                });
            }
            return arr;
        };
    }])
    /**
     * @ngdoc service
     * @name npn-viz-tool.gridded-services:WmsService
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Interacts with the NPN geoserver WMS instance to supply map layer data.
     *
     * This service is driven by the <code>map-vis-layers.json</code> JSON document which
     * defines categorized organization for layers known to be supported by the geoserver instance.
     * In addition it specifies what UI code may be involved for formatting legend/gridded data points
     * as strings and valid extent values (despite what the geoserver capabilities may report).
     * The list of layers exposed by the map visualization will almost certainly be a re-organized subset
     * of those exposed by the geoserver.
     *
     * The JSON document exposes a single object with the properties:
     * <ul>
     *     <li><code>geo_server</code> - Contains configuration about the location of the geoserver to interact with.</li>
     *     <li><code>categories</code> - An array of category objects used to organize and configure the behavior of geo server map layers.</li>
     * </ul>
     *
     * The <code>categories</code> property is an array of objects.
     * Each "category" has, at a minimum, a <code>name</code> and <code>layers</code> property.
     * The <code>layers</code> property is an array of "layer" objects which, at a minimum, contain a <code>title</code>
     * and <code>name</code> properties.  The layer <code>name</code> contains the machine name of the associated WMS layer.
     *
     * Each category or layer can also have the following (optional) properties:
     * <ul>
     *   <li><code>legend_label_filter</code> - specifies an angular filter and optional arguments used to translate point data into strings for legends and map info windows.</li>
     *   <li><code>gridded_label_filter</code> - specifies an angular filter and optional arguments used to translate point data into strings for point data map info windows (if not specified then <code>legend_label_filter</code> will be used).</li>
     *   <li><code>extent_values_filter</code> - specifies an angualr filter and optional arguments used to filter extent values for layers.</li>
     *   <li><code>extent_default_filter</code> - specifies anangular filter and optional arguments used to select a default value.  (if not specified the default provided by the server will be used).</li>
     *   <li><code>legend_units</code> - specifies a string that should be placed on the legend below the cell labels (units separated from legend labels).</li>
     *   <li><code>supports_data</code> - specifies a boolean indicating if a layer supports plotting of data on it or not (default true).</li>
     *   <li><code>supports_time_series</code> - specifies a boolean indicating if a layer supports plotting of time series data (default false).</li>
     *   <li>code>current_year_only</code> - if <code>supports_data</code> is true (or unspecified) the indicates that a given layer should only support plotting of data for the year of the currently selected extent on it (default false).</li>
     *   <li><code>description</code> - contains a description of a given layer.  this value can also be specified at the top level so that it applies to all layers in all categories (as the default).</li>
     * </ul>
     *
     * If any of the above properties are defined at the category level then all of the category's layers will inherit the values.
     * Individual layers can define properties of the same name to over-ride the definition found at the category level.
     *
     * The <code>*_filter</code> properties define an object that names an angular <code>$filter</code>
     * instance and optional arguments to that filter.
     * E.g.
     * <pre>
    {
        "geo_server": {
            "url": "//geoserver.usanpn.org/geoserver"
        },
        "description" : "this is the default layer description.",
        "categories": [
        ...
        ,{
            "name": "Current Year AGDD",
            "supports_data": false,
            "legend_label_filter": {
                "name": "legendDegrees",
                "args": ["F"]
            },
            "extent_values_filter": {
                "name": "extentDates",
                "args": [null,"today"]
            },
            "layers":[{
                    "title": "32\u00B0F",
                    "name": "gdd:agdd"
                },{
                    "title": "50\u00B0F",
                    "name": "gdd:agdd_50f"
                }]
        },
        ...
        ]
    }
     * </pre>
     *
     * The "Current Year AGDD" category contains two layers.  For both layers the same <code>legend_label_filter</code>
     * will be applied to format numbers to strings for use in displaying the legend and gridded data retrived from the WCS.
     * Similarly both layers will use the same <code>extent_values_filter</code> whilch will filter valid extent values as reported
     * by the WMS to only those <em>before</em> "today".
     */
    .service('WmsService', ['$log', '$q', '$http', '$sce', '$httpParamSerializer', '$filter', 'DateExtentUtil', 'WcsService', 'Analytics', function ($log, $q, $http, $sce, $httpParamSerializer, $filter, DateExtentUtil, WcsService, Analytics) {
        function setGeoServerUrl(url) {
            GEOSERVER_URL = url;
            WMS_BASE_URL = GEOSERVER_URL + '/wms';
            WMS_CAPABILITIES_URL = WMS_BASE_URL + '?service=wms&version=' + WMS_VERSION + '&request=GetCapabilities';
        }
        var LAYER_CONFIG = $http.get('map-vis-layers.json'),
            GEOSERVER_URL,
            WMS_BASE_URL,
            WMS_CAPABILITIES_URL,
            // not safe to change since the capabilities document format changes based on version
            // so a version change -may- require code changes wrt interpreting the document
            WMS_VERSION = '1.1.1',
            wms_layer_config,
            wms_layer_defs,
            legends = {},
            service = {
                baseUrl: WMS_BASE_URL,
                /**
                 * @ngdoc method
                 * @methodOf npn-viz-tool.gridded-services:WmsService
                 * @name  getLayers
                 * @description
                 *
                 * Get the layers supported by the WMS service (work in progress, list will be a categorized subset eventually).
                 *
                 * @param {google.maps.Map} map The base map the fetched layers will be added to.
                 * @return {promise} A promise that will be resolved with the layers, or rejected.  The layers will be instances of {@link npn-viz-tool.gridded-services:WmsMapLayer}
                 *                   and merged into the in categories as defined by <code>map-vis-layers.json</code>.
                 */
                getLayers: function (map) {
                    function mergeLayersIntoConfig() {
                        var result = angular.copy(wms_layer_config),
                            base_description = result.description;
                        result.categories.forEach(function (category) {
                            // layers can inherit config like filters (if all in common) from
                            // the base category
                            var base_config = angular.copy(category);
                            delete base_config.name;
                            delete base_config.layers;
                            base_config.description = base_config.description || base_description;
                            category.layers = category.layers.map(function (l) {
                                return new WmsMapLayer(map, angular.extend(angular.copy(base_config), wms_layer_defs[l.name], l));
                            });
                        });
                        return result;
                    }
                    var def = $q.defer();
                    if (wms_layer_config && wms_layer_defs) {
                        def.resolve(mergeLayersIntoConfig());
                    } else {
                        LAYER_CONFIG.then(function (response) {
                            wms_layer_config = response.data;
                            setGeoServerUrl(wms_layer_config.geo_server.url);
                            $log.debug('layer_config', response.data);
                            $http.get(WMS_CAPABILITIES_URL).then(function (response) {
                                var wms_capabilities = $($.parseXML(response.data));
                                wms_layer_defs = getLayers(wms_capabilities.find('Layer'));
                                $log.debug('wms_layer_defs', wms_layer_defs);
                                def.resolve(mergeLayersIntoConfig());
                            }, def.reject);
                        }, def.reject);

                    }
                    return def.promise;
                }
            };

        /**
         * @ngdoc object
         * @name npn-viz-tool.gridded-services:WmsMapLegend
         * @module  npn-viz-tool.gridded-services
         * @description
         *
         * A legend object associated with a specific map layer.
         */
        function WmsMapLegend(color_map, ldef, legend_data) {
            function get_filter(filter_def) {
                var filter = $filter(filter_def.name);
                return function (l, q) {
                    var args = [q];
                    if (filter_def.args) {
                        args = args.concat(filter_def.args);
                    }
                    return filter.apply(undefined, args);
                };
            }
            var lformat = ldef.legend_label_filter ? get_filter(ldef.legend_label_filter) : angular.identity,
                gformat = ldef.gridded_label_filter ? get_filter(ldef.gridded_label_filter) : undefined,
                entries, data;
            entries = color_map.find('ColorMapEntry');
            if (entries.length === 0) {
                entries = color_map.find('sld\\:ColorMapEntry');
            }
            data = entries.toArray().reduce(function (arr, entry, i) {
                var e = $(entry),
                    q = parseFloat(e.attr('quantity')),
                    l = e.attr('label');
                arr.push({
                    color: e.attr('color'),
                    quantity: q,
                    original_label: l,
                    label: i === 0 ? l : lformat(l, q)
                });
                return arr;
            }, []);
            this.styleDefinition = legend_data;
            this.ldef = ldef;
            this.lformat = lformat;
            this.gformat = gformat;
            this.title_data = data[0];
            this.data = data.slice(1);
            this.length = this.data.length;
        }

        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
         * @name  setLayer
         * @description Set the current layer associated with this legend.
         * @param {object} layer The new layer to associate with this legend.
         * @returns {object} This legend object.
         */
        WmsMapLegend.prototype.setLayer = function (layer) {
            this.layer = layer;
            return this;
        };

        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
         * @name  getData
         * @description Get the raw legend cell data.
         * @returns {Array} The cell data.
         */
        WmsMapLegend.prototype.getData = function () {
            return this.data;
        };
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
         * @name  getStyleDefinition
         * @description Get the raw style definition DOM.
         * @returns {object} The style definitino DOM.
         */
        WmsMapLegend.prototype.getStyleDefinition = function () {
            return this.styleDefinition;
        };
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
         * @name  getTitle
         * @description Get the legend title (from the original zero-index cell)
         * @returns {string} The legend title.
         */
        WmsMapLegend.prototype.getTitle = function () {
            return this.title_data.label;
        };

        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
         * @name  getColors
         * @description Get the colors for the cells.
         * @returns {Array} Array of string hex colors.
         */
        WmsMapLegend.prototype.getColors = function () {
            return this.data.map(function (data) { return data.color; });
        };
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
         * @name  getQuantities
         * @description Get numberic quantities for the cells.
         * @returns {Array} Array of numbers.
         */
        WmsMapLegend.prototype.getQuantities = function () {
            return this.data.map(function (data) { return data.quantity; });
        };
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
         * @name  getLabels
         * @description Get cell labels (translated).
         * @returns {Array} Array of strings.
         */
        WmsMapLegend.prototype.getLabels = function () {
            return this.data.map(function (data) { return data.label; });
        };
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
         * @name  getOriginalLabels
         * @description Get cell labels (originals).
         * @returns {Array} Array of strings.
         */
        WmsMapLegend.prototype.getOriginalLabels = function () {
            return this.data.map(function (data) { return data.original_label; });
        };
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
         * @name  formatPointData
         * @description Translate point data for the associated layer into text.
         * @param {number} q The point data to format.
         * @returns {string} point data formatted.
         */
        WmsMapLegend.prototype.formatPointData = function (q) {
            return (this.gformat || this.lformat)(q, q);
        };
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
         * @name  getPointData
         * @description Get the legend cell data for a given point.
         * @param {number} q The point data to get the associated legend cell for.
         * @returns {object} The cell data for the point or undefined if none.
         */
        WmsMapLegend.prototype.getPointData = function (q) {
            var i, d, n;
            for (i = 0; i < this.data.length; i++) {
                d = this.data[i];
                n = (i + 1) < this.data.length ? this.data[i + 1] : undefined;
                if (q == d.quantity) {
                    return d;
                }
                if (n && q >= d.quantity && q < n.quantity) {
                    return d;
                }
            }
        };

        /**
         * @ngdoc object
         * @name npn-viz-tool.gridded-services:WmsMapLayer
         * @module  npn-viz-tool.gridded-services
         * @description
         *
         * A map layer object associated with a specific google map.
         */
        function WmsMapLayer(map, layer_def) {
            if (layer_def.extent_values_filter) {
                $log.debug('layer ' + layer_def.name + ' has an extent_values_filter, processing', layer_def.extent_values_filter);
                var valuesFilter = $filter(layer_def.extent_values_filter.name),
                    extentValues = layer_def.extent.values.map(function (e) { return e.value; }),
                    filterArgs = [extentValues].concat(layer_def.extent_values_filter.args || []),
                    filteredValues;
                filteredValues = valuesFilter.apply(undefined, filterArgs);
                $log.debug('filteredValues', (filteredValues.length > 1 ? (filteredValues[0] + '...' + filteredValues[filteredValues.length - 1]) : filteredValues));
                layer_def.extent.values = layer_def.extent.values.filter(function (v) {
                    return filteredValues.indexOf(v.value) !== -1;
                });
                if (layer_def.extent.current && filteredValues.indexOf(layer_def.extent.current.value) === -1) {
                    $log.debug('current extent value has become invalid, replacing with last option');
                    layer_def.extent.current = layer_def.extent.values.length ? layer_def.extent.values[layer_def.extent.values.length - 1] : undefined;
                }
            }
            if (layer_def.extent_default_filter) {
                $log.debug('layer ' + layer_def.name + ' has an extent_default_filter, processing', layer_def.extent_default_filter);
                var defaultFilter = $filter(layer_def.extent_default_filter.name),
                    defaultFilterArgs = [layer_def.extent.values].concat(layer_def.extent_default_filter.values || []);
                layer_def.extent.current = defaultFilter.apply(undefined, defaultFilterArgs) || layer_def.extent.current;
                $log.debug('resulting default value', layer_def.extent.current);
            }
            if (layer_def.description) {
                layer_def.$description = $sce.trustAsHtml(layer_def.description);
            }
            var boxSize = 256;
            var wmsArgs = {
                service: 'WMS',
                request: 'GetMap',
                version: WMS_VERSION,
                layers: layer_def.name,
                styles: '',
                format: 'image/png',
                transparent: true,
                height: boxSize,
                width: boxSize,
                srs: 'EPSG:3857' // 'EPSG:4326'
            },
                sldBody,
                pest,
                pestOverlay,
                googleLayer = new google.maps.ImageMapType({
                    getTileUrl: function (coord, zoom) {
                        var proj = map.getProjection(),
                            zfactor = Math.pow(2, zoom),
                            top = proj.fromPointToLatLng(new google.maps.Point(coord.x * boxSize / zfactor, coord.y * boxSize / zfactor)),
                            bot = proj.fromPointToLatLng(new google.maps.Point((coord.x + 1) * boxSize / zfactor, (coord.y + 1) * boxSize / zfactor)),
                            ctop = srsConversion(top),
                            cbot = srsConversion(bot),
                            base = {};
                        if (l.extent && l.extent.current) {
                            l.extent.current.addToWmsParams(base);
                        }
                        var args = { bbox: [ctop.lng, cbot.lat, cbot.lng, ctop.lat].join(',') };
                        if (sldBody) {
                            args.sld_body = sldBody;
                        }
                        return WMS_BASE_URL + '?' + $httpParamSerializer(angular.extend(base, wmsArgs, args));
                    },
                    tileSize: new google.maps.Size(boxSize, boxSize),
                    isPng: true,
                    name: (layer_def.title || layer_def.name)
                }),
                l = angular.extend({}, layer_def, {
                    /**
                     * @ngdoc property
                     * @propertyOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  googleLayer
                     * @description The underlying google layer (google.maps.ImageMapType)
                     */
                    googleLayer: googleLayer,
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  getMap
                     * @description Get the google map instance this layer is associated with.
                     * @returns {google.maps.Map} The map instance.
                     */
                    getMap: function () {
                        return map;
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  getStyleRange
                     * @description Get the style range, if any was set.
                     * @returns {Array|undefined} The range that was set.
                     */
                    getStyleRange: function () {
                        return l.styleRange;
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  setStyleRange
                     * @description Set the style range.
                     */
                    setStyleRange: function (range) {
                        function xmlToString(xmlData) {
                            var xmlString;
                            if (window.ActiveXObject) {
                                xmlString = xmlData.xml; // MSIE
                            }
                            else {
                                xmlString = (new XMLSerializer()).serializeToString(xmlData);
                            }
                            return xmlString;
                        }
                        var self = this;
                        if (self.styleRange = range) {
                            self.getLegend().then(function (legend) {
                                var styleDef = legend.getStyleDefinition(),
                                    data = legend.getData(),
                                    minQ = data[range[0]].quantity,
                                    maxQ = data[range[1]].quantity,
                                    $styleDef = $(styleDef),
                                    colors = $styleDef.find('ColorMapEntry'),
                                    colorMap = $styleDef.find('ColorMap');

                                // only want the first style assosiated with the layer
                                // todo: instead of picking first style, generalize to pick by name
                                while (styleDef[0].firstElementChild.firstElementChild.children.length > 2) {
                                    styleDef[0].firstElementChild.firstElementChild.removeChild(styleDef[0].firstElementChild.firstElementChild.lastChild);
                                }

                                if (colors.length === 0) {
                                    colors = $styleDef.find('sld\\:ColorMapEntry'); // FF
                                }
                                if (colorMap.length === 0) {
                                    colorMap = $styleDef.find('sld\\:ColorMap'); // FF
                                }
                                if (colorMap) {
                                    colorMap.attr('type', 'intervals');
                                }
                                colors.each(function () {
                                    var cme = $(this),
                                        q = parseInt(cme.attr('quantity'));
                                    /*if(q === -9999) {
                                        cme.attr('opacity','0.0');
                                        //cme.remove();
                                    } else {*/
                                    cme.attr('opacity', (q > minQ && q <= maxQ) ? '1.0' : '0.0');
                                    /*}*/
                                });

                                var style = xmlToString(styleDef[0]);
                                self.setStyle(style);
                            });
                        } else {
                            self.setStyle(undefined);
                        }
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  setStyle
                     * @description Set the style and its associated range (if any).
                     * @param {string} The style (XML as a string).
                     */
                    setStyle: function (style) {
                        if (style !== sldBody) { // avoid off/on if nothing is changing
                            if (style) {
                                $log.debug('style:', style);
                            }
                            sldBody = style;
                            this.bounce();
                        }
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  getBounds
                     * @description Get the bounds for this layer.
                     * @returns {google.maps.LatLngBounds} The layer's bounds.
                     */
                    getBounds: function () {
                        if (layer_def.bbox) {
                            return layer_def.bbox.getBounds();
                        }
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  supportsData
                     * @description Indicates whether a given layer supports data to be plotted on it or not.
                     * @returns {boolean} false if the layer doesn't support data plotted on it.
                     */
                    supportsData: function () {
                        return typeof (layer_def.supports_data) === 'boolean' ? layer_def.supports_data : true; /* by default a layer supports data */
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  currentYearOnly
                     * @description Indicates whether a given layer should constrain what gets plotted on it to the currently selected year.
                     * @returns {boolean} true if plotted data should be restrained.
                     */
                    currentYearOnly: function () {
                        return typeof (layer_def.current_year_only) === 'boolean' ? layer_def.current_year_only : false;
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  getTitle
                     * @description Get the layer title, if any.
                     * @returns {string} The title.
                     */
                    getTitle: function () {
                        return l.title ? l.title.replace(/^(.*?)\s+-\s+(.*)$/, '$2') : undefined;
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  getAbstract
                     * @description Get the layer description (abstract from the server), if any.
                     * @returns {string} The description.
                     */
                    getAbstract: function () {
                        return l.abstract ? l.abstract.replace(/\s*developer notes.*$/i, '') : undefined;
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  fit
                     * @description Fit the map to this layers defined bounds.
                     * @returns {npn-viz-tool.gridded-services:WmsMapLayer} this map layer instance.
                     */
                    fit: function () {
                        var bounds = l.getBounds();
                        if (bounds) {
                            map.fitBounds(bounds);
                        }
                        return l;
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  bounce
                     * @description
                     *  Toggle this layer off then on.  This function exists since off/on
                     *  are tracked by analytics and sometimes a layer needs to be updated
                     *  in this fashion.
                     * @returns {npn-viz-tool.gridded-services:WmsMapLayer} this map layer instance.
                     */
                    bounce: function () {
                        if (map.overlayMapTypes.length) {
                            map.overlayMapTypes.pop();
                        }
                        map.overlayMapTypes.push(googleLayer);
                        return l;
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  bouncePest
                     * @description
                     *  Toggle this layer off then on.  This function exists since off/on
                     *  are tracked by analytics and sometimes a layer needs to be updated
                     *  in this fashion.
                     * @returns {npn-viz-tool.gridded-services:WmsMapLayer} this map layer instance.
                     */
                    bouncePest: function (pest) {
                        // if(pest == 'Buffelgrass') {
                        //     var regionBounds = {
                        //         north: 37.00426,
                        //         south: 31.332177,
                        //         east: -109.045223,
                        //         west: -114.81651
                        //     };

                        //     if (pestOverlay) {
                        //         pestOverlay.setMap(null);
                        //     }

                        //     pestOverlay = new google.maps.GroundOverlay(
                        //         'https://geoserver-dev.usanpn.org/geoserver/wms?bbox=-12781315.428,3675016.642,-12139802.046,4439700.593&format=image%2Fpng&height=596&layers=precipitation:buffelgrass_prism&request=GetMap&service=WMS&srs=EPSG:3857&styles=&time=2018-12-31T00:00:00.000Z&transparent=true&version=1.1.1&width=500',
                        //         regionBounds,
                        //         { clickable: false });

                        //     pestOverlay.setOpacity(0.75);

                        //     pestOverlay.setMap(map);

                        //     return l;
                        // }
                        // else 
                        if (pest) {
                            var self = this,
                                def = $q.defer();
                            var nodeServer = 'https://data.usanpn.org/geoservices';
                            if(location.hostname.includes('local') || location.hostname.includes('dev')) {
                                nodeServer = 'https://data-dev.usanpn.org/geoservices';
                            }
                            var pestUrl = nodeServer + '/v1/phenoforecasts/pestMap?species=' + pest + '&date=' + l.extent.current.value.substring(0, 10);
                            $http.get(pestUrl, {
                                params: {}
                            }).then(function (response) {
                                var regionBounds = {
                                    north: response.data.bbox[3],
                                    south: response.data.bbox[1],
                                    east: response.data.bbox[2],
                                    west: response.data.bbox[0]
                                };

                                if (pestOverlay) {
                                    pestOverlay.setMap(null);
                                }

                                pestOverlay = new google.maps.GroundOverlay(
                                    response.data.clippedImage,
                                    regionBounds,
                                    { clickable: false });

                                pestOverlay.setOpacity(0.75);

                                pestOverlay.setMap(map);

                                return l;

                            }, def.reject);
                        } else {
                            if (pestOverlay) {
                                pestOverlay.setMap(null);
                            }
                            return l;
                        }
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  on
                     * @description Put this layer on the map.
                     * @returns {npn-viz-tool.gridded-services:WmsMapLayer} this map layer instance.
                     */
                    on: function () {
                        Analytics.trackEvent('gridded-layer', 'on', this.getTitle());
                        map.overlayMapTypes.push(googleLayer);
                        return l;
                    },
                    onPest: function () {
                        // var imageBounds = {
                        //     north: 49.389657980456,
                        //     south: 25.8324511400651,
                        //     east: -69.9386512189563,
                        //     west: -109.0712618165
                        //   };

                        // pestOverlay = new google.maps.GroundOverlay(
                        //       'https://data-dev.usanpn.org:3006/Emerald_Ash_Borer_2017-05-02_1517258760701_styled.png',
                        //       imageBounds,
                        //       {clickable:false});

                        // pestOverlay.setOpacity(0.75);

                        // pestOverlay.setMap(map);

                        Analytics.trackEvent('gridded-layer', 'on', this.getTitle());
                        return l;
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  off
                     * @description Take this layer off the map.
                     * @returns {npn-viz-tool.gridded-services:WmsMapLayer} this map layer instance.
                     */
                    off: function () {
                        if (map.overlayMapTypes.length) {
                            Analytics.trackEvent('gridded-layer', 'off', this.getTitle());
                            map.overlayMapTypes.pop();
                        }
                        if (pestOverlay) {
                            pestOverlay.setMap(null);
                        }
                        return l;
                    },
                    offPest: function () {
                        if (map.overlayMapTypes.length) {
                            Analytics.trackEvent('gridded-layer', 'off', this.getTitle());
                            map.overlayMapTypes.pop();
                        }
                        if (pestOverlay) {
                            pestOverlay.setMap(null);
                        }
                        return l;
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  getLegend
                     * @description Get the legend associated with this layer.
                     * @returns {promise} A promise that will be resolve with the legend when it arrives ({@link npn-viz-tool.gridded-services:WmsMapLegend}) .
                     */
                    getLegend: function () {
                        var self = this,
                            def = $q.defer();

                        // due to pestmap can no longer attempt to reuse the same legend
                        // if(legends.hasOwnProperty(layer_def.name) && self.pest == null) {
                        //     def.resolve(legends[layer_def.name]);
                        // 	def.resolve(legends[layer_def.name].setLayer(self));
                        // } else {
                        //http://geoserver.usanpn.org/geoserver/wms?request=GetStyles&layers=gdd%3A30yr_avg_agdd&service=wms&version=1.1.1
                        $http.get(WMS_BASE_URL, {
                            params: {
                                service: 'wms',
                                request: 'GetStyles',
                                version: WMS_VERSION,
                                layers: layer_def.name,
                            }
                        }).then(function (response) {
                            $log.debug('legend response', response);
                            var legend_data = $($.parseXML(response.data)),
                                color_map = legend_data.find('ColorMap');
                            var user_style = legend_data.find('UserStyle');
                            if (color_map.length === 0) {
                                // FF
                                color_map = legend_data.find('sld\\:ColorMap');
                                user_style = legend_data.find('sld\\:UserStyle');
                            }
                            var userStyleArr = user_style.toArray();
                            // this code is selecting the first if there are multiples....
                            // as is the case for si-x:leaf_anomaly
                            var styleIndex = 0;
                            var i = 0;
                            if (self.pest === 'Emerald Ash Borer') {
                                for (i = 0; i < userStyleArr.length; i++) {
                                    if (userStyleArr[i].firstElementChild.textContent === 'emerald_ash_borer') {
                                        styleIndex = i;
                                    }
                                }
                            }
                            else if (self.pest === 'Eastern Tent Caterpillar') {
                                console.log('easter tent caterpillar');
                                for (i = 0; i < userStyleArr.length; i++) {
                                    if (userStyleArr[i].firstElementChild.textContent === 'eastern_tent_caterpillar') {
                                        styleIndex = i;
                                    }
                                }
                            }
                            else if (self.pest === 'Asian Longhorned Beetle') {
                                console.log('asian longhorned beetle');
                                for (i = 0; i < userStyleArr.length; i++) {
                                    if (userStyleArr[i].firstElementChild.textContent === 'asian_longhorned_beetle') {
                                        styleIndex = i;
                                    }
                                }
                            }
                            else if (self.pest === 'Gypsy Moth') {
                                console.log('gypsy moth');
                                for (i = 0; i < userStyleArr.length; i++) {
                                    if (userStyleArr[i].firstElementChild.textContent === 'gypsy_moth') {
                                        styleIndex = i;
                                    }
                                }
                            }
                            else if (self.pest === 'Apple Maggot') {
                                console.log('apple maggot');
                                for (i = 0; i < userStyleArr.length; i++) {
                                    if (userStyleArr[i].firstElementChild.textContent === 'apple_maggot') {
                                        styleIndex = i;
                                    }
                                }
                            }
                            else if (self.pest === 'Hemlock Woolly Adelgid') {
                                for (i = 0; i < userStyleArr.length; i++) {
                                    if (userStyleArr[i].firstElementChild.textContent === 'hemlock_woolly_adelgid') {
                                        styleIndex = i;
                                    }
                                }
                            }
                            else if (self.pest === 'Winter Moth') {
                                for (i = 0; i < userStyleArr.length; i++) {
                                    if (userStyleArr[i].firstElementChild.textContent === 'winter_moth') {
                                        styleIndex = i;
                                    }
                                }
                            }
                            else if (self.pest === 'Lilac Borer') {
                                for (i = 0; i < userStyleArr.length; i++) {
                                    if (userStyleArr[i].firstElementChild.textContent === 'lilac_borer') {
                                        styleIndex = i;
                                    }
                                }
                            }
                            else if (self.pest === 'Bagworm') {
                                for (i = 0; i < userStyleArr.length; i++) {
                                    if (userStyleArr[i].firstElementChild.textContent === 'bagworm') {
                                        styleIndex = i;
                                    }
                                }
                            }
                            else if (self.pest === 'Bronze Birch Borer') {
                                for (i = 0; i < userStyleArr.length; i++) {
                                    if (userStyleArr[i].firstElementChild.textContent === 'bronze_birch_borer') {
                                        styleIndex = i;
                                    }
                                }
                            }
                            else if (self.pest === 'Magnolia Scale') {
                                for (i = 0; i < userStyleArr.length; i++) {
                                    if (userStyleArr[i].firstElementChild.textContent === 'magnolia_scale') {
                                        styleIndex = i;
                                    }
                                }
                            }
                            else if (self.pest === 'Pine Needle Scale') {
                                for (i = 0; i < userStyleArr.length; i++) {
                                    if (userStyleArr[i].firstElementChild.textContent === 'pine_needle_scale') {
                                        styleIndex = i;
                                    }
                                }
                            }
                            legends[layer_def.name] = color_map.length !== 0 ? new WmsMapLegend($(color_map.toArray()[styleIndex]), layer_def, legend_data) : undefined;
                            def.resolve(legends[layer_def.name]);
                            def.resolve(legends[layer_def.name].setLayer(self));
                        }, def.reject);
                        //}

                        return def.promise;
                    },
                    /**
                     * @ngdoc method
                     * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
                     * @name  getGriddedData
                     * @description
                     *
                     * Fetch gridded data for a specific location on this map layer.
                     *
                     * @param {google.maps.LatLng} latLng The point under which to fetch the data for.
                     * @return {promise} A promise that will be resolved with an array of numbers, or rejected.
                     */
                    getGriddedData: function (latLng) {
                        return WcsService.getGriddedData(GEOSERVER_URL, this, latLng, 5/*should gridSize change based on the layer?*/);
                    }
                });
            return l;
            // this code converts coordinates from ESPG:4326 to ESPG:3857, it originated @
            // http://gis.stackexchange.com/questions/52188/google-maps-wms-layer-with-3857
            // that author stated it came from StackOverflow which I tried to find to attribute properly but could not.
            // the issue here is that if requests are sent to the map service with ESPG:4326 coordinates everything
            // appears accurate when tightly zoomed however as you zoom out beyond a certain point the layers begin to
            // migrate north, the farther zoomed out the more drastic the migration (e.g. from Mexico into N. Canada)
            // while dealing in traditional lat/lng for google maps they are actually projected in 3857 (metres, not meters).
            // the main thing is that 4326 coordinates are projected onto a sphere/ellipsoid while 3857 are translated to
            // a flat surface.
            // unfortunately while google maps projection must be performing such transformations it doesn't expose this ability.
            function srsConversion(latLng) {
                if ((Math.abs(latLng.lng()) > 180 || Math.abs(latLng.lat()) > 90)) {
                    return;
                }

                var num = latLng.lng() * 0.017453292519943295;
                var x = 6378137.0 * num;
                var a = latLng.lat() * 0.017453292519943295;

                return { lng: x, lat: 3189068.5 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a))) };
            }
        }
        // returns an associative array of machine name layer to layer definition
        function getLayers(layers) {
            if (!layers || layers.length < 2) { // 1st layer is parent, children are the real layers
                return;
            }
            // make it a normal array, not a jQuery one
            var ls = [];
            layers.slice(1).each(function (i, o) {
                ls.push(o);
            });
            return ls.map(layerToObject).reduce(function (map, l) {
                map[l.name] = l;
                return map;
            }, {});
        }
        function layerToObject(layer) {
            var l = $(layer);
            var o = {
                name: l.find('Name').first().text(),
                // redmine #761
                title: l.find('Title').first().text().replace(/\((.+?)\)/g, ''),
                abstract: l.find('Abstract').first().text(),
                bbox: parseBoundingBox(l.find('EX_GeographicBoundingBox').first()),
                style: parseStyle(l.find('Style').first()),
                extent: parseExtent(l.find('Extent').first())
            };
            if (!o.bbox) {
                o.bbox = parseLatLonBoundingBox(l.find('LatLonBoundingBox').first());
            }
            return o;
        }
        function parseStyle(style) {
            var s = $(style);
            return {
                name: s.find('Name').first().text(),
                // redmine #761
                title: s.find('Title').first().text().replace(/\((.+?)\)/g, ''),
                legend: s.find('OnlineResource').attr('xlink:href') // not very specific...
            };
        }
        function parseLatLonBoundingBox(bb) {
            if (bb.length) {
                var bbox = {
                    westBoundLongitude: parseFloat(bb.attr('minx')),
                    eastBoundLongitude: parseFloat(bb.attr('maxx')),
                    southBoundLatitude: parseFloat(bb.attr('miny')),
                    northBoundLatitude: parseFloat(bb.attr('maxy')),
                    getBounds: function () { // TODO, cut/paste
                        return new google.maps.LatLngBounds(
                            new google.maps.LatLng(bbox.southBoundLatitude, bbox.westBoundLongitude), // sw
                            new google.maps.LatLng(bbox.northBoundLatitude, bbox.eastBoundLongitude) // ne
                        );
                    }
                };
                return bbox;
            }
        }
        function parseBoundingBox(bb) {
            if (bb.length) {
                var bbox = {
                    westBoundLongitude: parseFloat(bb.find('westBoundLongitude').text()),
                    eastBoundLongitude: parseFloat(bb.find('eastBoundLongitude').text()),
                    southBoundLatitude: parseFloat(bb.find('southBoundLatitude').text()),
                    northBoundLatitude: parseFloat(bb.find('northBoundLatitude').text()),
                    getBounds: function () {
                        return new google.maps.LatLngBounds(
                            new google.maps.LatLng(bbox.southBoundLatitude, bbox.westBoundLongitude), // sw
                            new google.maps.LatLng(bbox.northBoundLatitude, bbox.eastBoundLongitude) // ne
                        );
                    }
                };
                // some bounding boxes seem to be messed up with lat/lons of 0 && -1
                // so if any of those numbers occur throw away the bounding box.
                return ![bbox.westBoundLongitude, bbox.eastBoundLongitude, bbox.southBoundLatitude, bbox.northBoundLatitude].reduce(function (v, n) {
                    return v || (n === 0 || n === -1);
                }, false) ? bbox : undefined;
            }
        }
        // represents an extent value of month/day/year
        function DateExtentValue(value, dateFmt) {
            var d = DateExtentUtil.parse(value);
            return {
                value: value,
                date: d,
                label: $filter('date')(d, (dateFmt || 'longDate')),
                addToWmsParams: function (params) {
                    params.time = value;
                },
                addToWcsParams: function (params) {
                    if (!params.subset) {
                        params.subset = [];
                    }
                    params.subset.push('http://www.opengis.net/def/axis/OGC/0/time("' + value + '")');
                }
            };
        }
        // represents an extent value of day of year
        function DoyExtentValue(value) {
            return {
                value: value,
                label: $filter('thirtyYearAvgDayOfYear')(value),
                addToWmsParams: function (params) {
                    params.elevation = value;
                },
                addToWcsParams: function (params) {
                    if (!params.subset) {
                        params.subset = [];
                    }
                    params.subset.push('http://www.opengis.net/def/axis/OGC/0/elevation(' + value + ')');
                }
            };
        }
        function parseExtent(extent) {
            var e = $(extent),
                content = e.text(),
                dfltValue = e.attr('default'),
                dflt, values,
                name = e.attr('name'),
                start, end, yearFmt = 'yyyy', i;
            if (!name || !content) {
                return undefined;
            }
            function findDefault(current, value) {
                return current || (value.value == dfltValue ? value : undefined);
            }
            if (name === 'time') {
                if (content.indexOf('/') === -1) { // for now skip <lower>/<upper>/<resolution>
                    values = content.split(',').map(function (d) { return new DateExtentValue(d); });
                    // ugh
                    dfltValue = dfltValue.replace(/0Z/, '0.000Z'); // extent values in ms preceision but not the default...
                    dflt = values.reduce(findDefault, undefined);
                    return {
                        label: 'Date',
                        type: 'date',
                        current: dflt, // bind the extent value to use here
                        values: values
                    };
                } else {
                    values = /^([^\/]+)\/(.*)\/P1Y$/.exec(content);
                    if (values && values.length === 3) {
                        start = new DateExtentValue(values[1], yearFmt);
                        end = new DateExtentValue(values[2], yearFmt);
                        if (end.date.getFullYear() > start.date.getFullYear()) { // should never happen but to be safe
                            values = [start];
                            for (i = start.date.getFullYear() + 1; i < end.date.getFullYear(); i++) {
                                values.push(new DateExtentValue(i + '-01-01T00:00:00.000Z', yearFmt));
                            }
                            values.push(end);
                            return {
                                label: 'Year',
                                type: 'year',
                                current: end,
                                values: values
                            };
                        }
                    }
                }
            } else if (name === 'elevation') {
                values = content.split(',').map(function (e) { return new DoyExtentValue(e); });
                dflt = values.reduce(findDefault, undefined);
                return {
                    label: 'Day of Year',
                    type: 'doy',
                    current: dflt, // bind the extent value to use here
                    values: values
                };
            }
        }
        return service;
    }])
    /**
     * @ngdoc service
     * @name npn-viz-tool.gridded-services:WcsService
     * @module npn-viz-tool.gridded-services
     * @description
     *
     * Interacts with the NPN geoserver WCS instance to supply underlying gridded data.  Loading of this service
     * extends the protypes of Number and the google.maps.LatLng class.
     *
     * <strong>Important:</strong> There should be no need to import and interact with this service directly.  Indivdual
     * layers ({@link npn-viz-tool.gridded-services:WmsMapLayer#methods_getgriddeddata}) expose an instance based method for fetching gridded data specific to those layers which should be used instead (they
     * call through to this service).
     */
    .service('WcsService', ['$log', '$q', '$http', 'uiGmapGoogleMapApi', function ($log, $q, $http, uiGmapGoogleMapApi) {
        // technically we should store and use a promise here but the WcsService
        // can't be interacted with until the Google Maps API is init'ed so just doing this
        // and later using it understanding the work has been done.
        uiGmapGoogleMapApi.then(function (maps) {
            $log.debug('WcsService: adding functionality to Number/Google Maps prototypes.');
            Number.prototype.toRad = function () {
                return this * Math.PI / 180;
            };
            Number.prototype.toDeg = function () {
                return this * 180 / Math.PI;
            };
            // 0=N,90=E,180=S,270=W dist in km
            maps.LatLng.prototype.destinationPoint = function (brng, dist) {
                dist = dist / 6371;
                brng = brng.toRad();

                var lat1 = this.lat().toRad(), lon1 = this.lng().toRad();

                var lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) +
                    Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));

                var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) *
                    Math.cos(lat1),
                    Math.cos(dist) - Math.sin(lat1) *
                    Math.sin(lat2));

                if (isNaN(lat2) || isNaN(lon2)) {
                    return null;
                }

                return new google.maps.LatLng(lat2.toDeg(), lon2.toDeg());
            };
        });
        var service = {
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WcsService
             * @name  getGriddedData
             * @description
             *
             * Fetch gridded data for a specific location on a specific map layer.
             *
             * @param {string} geoServerUrl The base URL of the geoserver instance.
             * @param {object} activeLayer The map layer returned from the WcsService that the data to fetch is associated with.
             * @param {google.maps.LatLng} latLng The point under which to fetch the data for.
             * @param {number} gridSize The side of the grid to ask the WCS service data for (the larger the gridSize the more data).
             * @return {promise} A promise that will be resolved with an array of numbers, or rejected.
             */
            getGriddedData: function (geoServerUrl, activeLayer, latLng, gridSize) {
                var wcs_base_url = geoServerUrl + '/wcs',
                    def = $q.defer(),
                    edges = [0, 80, 180, 270].map(function (bearing) {
                        return latLng.destinationPoint(bearing, (gridSize / 2));
                    }),
                    wcsArgs = {
                        service: 'WCS',
                        request: 'GetCoverage',
                        version: '2.0.1',
                        coverageId: activeLayer.name.replace(':', '__'), // convention
                        format: 'application/gml+xml',
                        subset: []
                    },
                    url;
                // add edges
                wcsArgs.subset.push('http://www.opengis.net/def/axis/OGC/0/Long(' + [edges[3].lng(), edges[1].lng()].join(',') + ')');
                wcsArgs.subset.push('http://www.opengis.net/def/axis/OGC/0/Lat(' + [edges[2].lat(), edges[0].lat()].join(',') + ')');
                if (activeLayer.extent && activeLayer.extent.current) {
                    if (activeLayer.pest != null) {
                        wcsArgs.subset.push('http://www.opengis.net/def/axis/OGC/0/time("' + activeLayer.extent.current.value + '")');
                    } else {
                        activeLayer.extent.current.addToWcsParams(wcsArgs);
                    }
                }
                $log.debug('wcsArgs', wcsArgs);
                $http.get(wcs_base_url, {
                    params: wcsArgs
                }).then(function (response) {
                    $log.debug('wcs response', response);
                    var wcs_data = $($.parseXML(response.data)),
                        // this is crazy simple minded, at this time. not sure if it needs to get
                        // more sophisticated.  there's a lot more info in the resulting gml document
                        // which may or may not be of interest.
                        tuples = wcs_data.find('tupleList').text();
                    $log.debug('wcs_data', wcs_data);
                    $log.debug('tuples', tuples);
                    if (tuples) {
                        def.resolve(tuples.trim().split(' ').map(function (tuple) { return parseFloat(tuple); }));
                    } else {
                        def.reject();
                    }
                }, def.reject);
                return def.promise;
            }
        };
        return service;
    }]);
