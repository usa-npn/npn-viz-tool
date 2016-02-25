/**
 * @ngdoc overview
 * @name npn-viz-tool.vis-map
 * @description
 *
 * Logic for gridded data map visualization.
 */
angular.module('npn-viz-tool.vis-map',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.settings',
    'npn-viz-tool.vis-map-services',
    'ui.bootstrap',
    'angularAwesomeSlider'
])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-opacity-slider
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Dynamically controls the opacity of map tiles.
 *
 * @scope
 * @param {object} layer The currently selected map layer.
 */
.directive('mapVisOpacitySlider',['$log','$timeout','WmsService',function($log,$timeout,WmsService) {
    return {
        restrict: 'E',
        template: '<div ng-if="layer" class="form-group"><label for="mapVisOpacitySlider" style="margin-bottom: 15px;">Opacity</label><input ng-model="selection.opacity" type="text" id="mapVisOpacitySlider" slider options="options" /></div>',
        scope: {
            layer: '='
        },
        link: function($scope) {

            $scope.selection = {
                opacity: 75
            };
            $scope.options = {
                from: 1,
                to: 100,
                step: 1,
                dimension: ' %'
            };
            function updateOpacity() {
                if($scope.layer) {
                    $scope.layer.googleLayer.setOpacity($scope.selection.opacity/100.0);
                }
            }
            $scope.$watch('layer.extent.current',updateOpacity);
            $scope.$watch('selection.opacity',updateOpacity);
            $scope.$watch('layer',updateOpacity);
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-doy-control
 * @module npn-viz-tool.vis-map
 * @description
 *
 * control for day of year extents.
 *
 * @scope
 * @param {object} layer The currently selected map layer.
 */
.directive('mapVisDoyControl',['$log','thirtyYearAvgDayOfYearFilter',function($log,thirtyYearAvgDayOfYearFilter){
    var BASE_YEAR = thirtyYearAvgDayOfYearFilter(1,true).getFullYear(),
        ONE_DAY = (24*60*60*1000),
        MONTHS = d3.range(0,12).map(function(m) { return new Date(BASE_YEAR,m); });
    function getDaysInMonth(date) {
        var month = date.getMonth(),
            tmp;
        if(month === 11) {
            return 31;
        }
        tmp = new Date(date.getTime());
        tmp.setMonth(tmp.getMonth()+1);
        tmp.setTime(tmp.getTime()-ONE_DAY);
        $log.debug('last day of month '+(month+1)+' is '+tmp);
        return tmp.getDate();
    }
    return {
        restrict: 'E',
        templateUrl: 'js/mapvis/doy-control.html',
        scope: {
            layer: '='
        },
        link: function($scope) {
            $scope.months = MONTHS;
            var currentDate = thirtyYearAvgDayOfYearFilter($scope.layer.extent.current.value,true);
            $scope.selection = {
                month: MONTHS[currentDate.getMonth()]
            };
            function dateWatch(date) {
                $scope.selection.month.setDate(date);
                // this feels a little hoakey matching on label but...
                var label = thirtyYearAvgDayOfYearFilter($scope.selection.month);
                $log.debug('doy-control:date '+label);
                $scope.layer.extent.current = $scope.layer.extent.values.reduce(function(current,v){
                    return current||(v.label === label ? v : undefined);
                },undefined);
            }
            $scope.$watch('selection.month',function(date) {
                var month = $scope.selection.month;
                $log.debug('doy-control:month '+(month.getMonth()+1));
                $scope.dates = d3.range(1,getDaysInMonth(month)+1);
                if(currentDate) {
                    // init
                    $scope.selection.date = currentDate.getDate();
                    currentDate = undefined;
                } else if($scope.selection.date === 1) {
                    dateWatch(1); // month change without date change, need to force the extent to update.
                } else {
                    $scope.selection.date = 1;
                }
            });
            $scope.$watch('selection.date',dateWatch);
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-year-control
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Control for year extents.
 *
 * @scope
 * @param {object} layer The currently selected map layer.
 */
.directive('mapVisYearControl',['$log',function($log){
    return {
        restrict: 'E',
        templateUrl: 'js/mapvis/year-control.html',
        scope: {
            layer: '='
        },
        link: function($scope) {
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-date-control
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Control for date extents.
 *
 * @scope
 * @param {object} layer The currently selected map layer.
 */
.directive('mapVisDateControl',['$log','dateFilter',function($log,dateFilter){
    return {
        restrict: 'E',
        templateUrl: 'js/mapvis/date-control.html',
        scope: {
            layer: '='
        },
        link: function($scope) {
            // TODO - hide the today/clear buttons
            $scope.selection = $scope.layer.extent.current.date;
            $scope.minDate = $scope.layer.extent.values[0].date;
            $scope.maxDate = $scope.layer.extent.values[$scope.layer.extent.values.length-1].date;
            $log.debug('minDate',$scope.minDate);
            $log.debug('maxDate',$scope.maxDate);
            $scope.open = function() {
                $scope.isOpen = true;
            };
            $scope.$watch('selection',function(date) {
                $log.debug('selection',date);
                var fmt = 'longDate',
                    formattedDate = dateFilter(date,fmt);
                $scope.layer.extent.current = $scope.layer.extent.values.reduce(function(current,value){
                    return current||(formattedDate === dateFilter(value.date,fmt) ? value : undefined);
                },undefined);
            });
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-layer-control
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Directive to control categorized selection of WMS layers.  This directive
 * shares the parent scope.
 */
.directive('mapVisLayerControl',['$log',function($log){
    return {
        restrict: 'E',
        templateUrl: 'js/mapvis/layer-control.html',
        link: function($scope) {
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-legend
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Directive to dynamically display an interactive legend for a seleted map layer.
 *
 * @scope
 * @param {object} legend The legend of the currently selected layer.
 */
.directive('mapVisLegend',['$log','$window',function($log,$window){
    return {
        restrict: 'E',
        templateUrl: 'js/mapvis/legend.html',
        scope: {
            legend: '='
        },
        link: function($scope,$element) {
            function redraw() {
                var legend = $scope.legend,
                    svg = d3.select('.legend');

                svg.selectAll('g').remove(); // clean slate
                if(!legend) {
                    return;
                }
                $log.debug('legend.title',legend.getTitle());
                $log.debug('legend.length',legend.length);
                $log.debug('legend.colors',legend.getColors());
                $log.debug('legend.quantities',legend.getQuantities());
                $log.debug('legend.labels',legend.getLabels());
                $log.debug('legend.original_labels',legend.getOriginalLabels());

                var width = parseFloat(svg.style('width').replace('px','')),
                    height = parseFloat(svg.style('height').replace('px','')),
                    data = legend.getData(),
                    cell_width = width/data.length,
                    cell_height = 30;
                $log.debug('svg dimensions',width,height);
                $log.debug('legend cell width',cell_width);

                var g = svg.append('g');
                g.selectAll('g.cell')
                 .data(data)
                 .enter()
                 .append('g')
                 .attr('class','cell')
                 .attr('transform',function(d,i) { return 'translate('+(i*cell_width)+',0)'; })
                 .append('rect')
                 .attr('height',cell_height)
                 .attr('width',cell_width)
                 .style('stroke','black')
                 .style('stroke-width','1px')
                 .style('fill',function(d,i) { return d.color; })
                 .append('title')
                 .text(function(d) { return d.label; });

                var tick_length = 5,
                    tick_padding = 3;

                function label_cell(cell,label,anchor) {
                    var tick_start = (cell_height+tick_padding);
                    cell.append('line')
                        .attr('x1',(cell_width/2))
                        .attr('y1',tick_start)
                        .attr('x2',(cell_width/2))
                        .attr('y2',tick_start+tick_length)
                        .attr('stroke','black')
                        .attr('stroke-width','1');
                    cell.append('text')
                        .attr('dx',(cell_width/2))
                        .attr('dy','3.8em'/*cell_height+tick_length+(2*tick_padding)*/) // need to know line height of text
                        .style('text-anchor',anchor)
                        .text(label);
                }
                var cells = g.selectAll('g.cell')[0],
                    mid_idx = Math.floor(cells.length/2);
                label_cell(d3.select(cells[0]),data[0].label,'start');
                label_cell(d3.select(cells[mid_idx]),data[mid_idx].label,'middle');
                label_cell(d3.select(cells[cells.length-1]),data[data.length-1].label,'end');
            }
            $scope.$watch('legend',redraw);
            $($window).bind('resize',redraw);
            $scope.$on('$destroy',function(){
                $log.debug('legend removing resize handler');
                $($window).unbind('resize',redraw);
            });
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-geo-layer
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Transfers any geojson features from the base map to the vis map based on GeoFilterArgs.
 * This is strictly for visual effect.  If such GeoFilterArgs are in play on then the filtered results
 * will be used when placing in-situ data and as such markers will be similarly constrained.
 *
 * @scope
 */
.directive('mapVisGeoLayer',['$log','$q','$timeout','uiGmapIsReady','FilterService',function($log,$q,$timeout,uiGmapIsReady,FilterService){
    return {
        restrict: 'E',
        template: '',
        scope: {},
        link: function($scope,$element,$attrs) {
            var geoArgs = FilterService.getFilter().getGeoArgs(),
                mapContainer = $element.parent().parent().find('.angular-google-map-container');
            if(geoArgs.length) {
                $timeout(function(){
                    // this is a comlete hack but there appears to be no valid way to put features/polygons below a
                    // custom map layer.
                    $(mapContainer.children().first().children().first().children().first().children()[1]).css('z-index','99');
                },1000);
                uiGmapIsReady.promise(2).then(function(instances){
                    var baseMap = instances[0].map,
                        visMap = instances[1].map,
                        featurePromises = geoArgs.map(function(arg){
                            var def = $q.defer();
                            // arg.arg is the actual Google Maps API Feature that was
                            // selected on the base map which then needs to be translatedback
                            // to valid geojson.
                            arg.arg.toGeoJson(function(json){
                                def.resolve(json);
                            });
                            return def.promise;
                        });
                    $q.all(featurePromises).then(function(features){
                        visMap.data.addGeoJson({
                            type: 'FeatureCollection',
                            features: features
                        });
                        visMap.data.setStyle(function(feature){
                            return {
                                clickable: false,
                                strokeColor: '#666',
                                strokeOpacity: null,
                                strokeWeight: 1,
                                fillColor: '#800000',
                                fillOpacity: null,
                                zIndex: 0
                            };
                        });
                    });
                });
            }

        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-bounds-layer
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Transfers any rectangles from the base map to the vis map based on BoundsFilterArgs.
 * This is strictly for visual effect.  If such BoundsFilterArgs are in play on then the filtered results
 * will be used when placing in-situ data and as such markers will be similarly constrained.
 *
 * @scope
 */
.directive('mapVisBoundsLayer',['$log','$q','$timeout','uiGmapIsReady','FilterService','BoundsFilterArg',function($log,$q,$timeout,uiGmapIsReady,FilterService,BoundsFilterArg){
    return {
        restrict: 'E',
        template: '',
        scope: {},
        link: function($scope,$element,$attrs) {
            var boundsArgs = FilterService.getFilter().getBoundsArgs(),
                mapContainer = $element.parent().parent().find('.angular-google-map-container');
            if(boundsArgs.length) {
                $timeout(function(){
                    // this is a comlete hack but there appears to be no valid way to put features/polygons below a
                    // custom map layer.
                    $(mapContainer.children().first().children().first().children().first().children()[1]).css('z-index','99');
                },1000);
                uiGmapIsReady.promise(2).then(function(instances){
                    var baseMap = instances[0].map,
                        visMap = instances[1].map;
                    var rectangles = boundsArgs.map(function(arg){
                        return new google.maps.Rectangle(angular.extend({
                            clickable: false,
                            bounds: arg.arg.getBounds(),
                            map: visMap
                        },BoundsFilterArg.RECTANGLE_OPTIONS));
                    });
                    $log.debug('mapVisBoundsLayer.rectangles',rectangles);
                });
            }

        }
    };
}])
/**
 * @ngdoc service
 * @name npn-viz-tool.vis-map:MapVisMarkerService
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Holds SVG marker paths for shared use between tags and map markers.  Exposes basic
 * functionality for rendering marker paths in SVGs outside of the map itself (filter tags).
 *
 * @scope
 */
.service('MapVisMarkerService',['$log',function($log){
    var service = {
        /**
         * @ngdoc property
         * @propertyOf npn-viz-tool.vis-map:MapVisMarkerService
         * @name  PATHS
         * @description
         *
         * Array containing SVG paths (strings) for the map vis markers.
         */
        PATHS: [
            'M0 22 L22 22 L10 0 Z', // triangle
            'M0 22 L22 22 L22 0 L0 0 Z', // square
            'M4 22 L18 22 L22 10 L18 0 L4 0 L0 10 Z' // hexagon('ish)
        ],
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis-map:MapVisMarkerService
         * @name  getBaseIcon
         * @description
         *
         * Build a base marker object for a given icon path for use as a google map marker icon.
         *
         * @param {int} idx The marker index (0-2 otherwise the function does nothing).
         * @returns {object} A new base marker definition.
         */
        getBaseIcon: function(idx) {
            return {
                path: service.PATHS[idx],
                anchor: {x: 11, y: 11}, // markers are 22x22 px need to shift them up/left so they're centered over lat/lon
                scale: 1
            };
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis-map:MapVisMarkerService
         * @name  renderMarkerToSvg
         * @description
         *
         * Render a marker path, by index to an SVG.
         *
         * @param {string} selector The d3/css selector that uniquely identifies the SVG to render the marker path to.
         * @param {int} idx The marker index (0-2 otherwise the function does nothing).
         */
        renderMarkerToSvg: function(selector,idx) {
            if(idx < 0 || idx >= service.PATHS.length) {
                return; // invalid index, just ignore it.
            }
            var svg = d3.select(selector);
            svg.selectAll('path').remove();
            svg.attr('viewBox','0 0 22 22')
                .attr('width',16)
                .attr('height',16);
            svg.append('path')
                .attr('d',service.PATHS[idx])
                //.attr('transform','translate(-16,-32)')
                .attr('fill','steelblue');
        }
    };
    return service;
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-filter-tags
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Displays filter tags on top of the map visualization and supports removal of selections from the
 * filter.
 *
 * @scope
 * @param {Array} map-vis-filter Two way binding to an array containing the species/phenophase/year selections.
 */
.directive('mapVisFilterTags',['$log','$timeout','MapVisMarkerService',function($log,$timeout,MapVisMarkerService){
    return {
        restrict: 'E',
        templateUrl: 'js/mapvis/filter-tags.html',
        scope: {
            mapVisFilter: '='
        },
        link: function($scope) {
            $scope.removeFromFilter = function(i) {
                $scope.mapVisFilter.splice(i,1);
            };
            $scope.$watchCollection('mapVisFilter',function(){
                $timeout(function(){
                    $scope.mapVisFilter.forEach(function(o,i){
                        MapVisMarkerService.renderMarkerToSvg('svg#map-vis-marker-'+i,i);
                    });
                });
            });
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-in-situ-control
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Directive to control addition of in-situ data to the visualization map.
 *
 * @scope
 * @param {object} layer The currently selected map layer.
 */
.directive('mapVisInSituControl',['$log','FilterService',function($log,FilterService){
    return {
        restrict: 'E',
        templateUrl: 'js/mapvis/in-situ-control.html',
        scope: {
            mapVisFilter: '=',
            layer: '=',
            mapVisPlot: '&'
        },
        link: function($scope) {
            var filter = FilterService.getFilter(),
                dateArg = filter.getDateArg();
            $scope.years = d3.range(dateArg.getStartYear(),dateArg.getEndYear()+1);
            $scope.selection = {
                year: $scope.years[0]
            };
            filter.getSpeciesList().then(function(list){
                $log.debug('speciesList',list);
                $scope.speciesList = list;
                $scope.selection.species = list.length ? list[0] : undefined;
            });
            $scope.$watch('selection.species',function(species){
                $scope.phenophaseList = [];
                if(species) {
                    FilterService.getFilter().getPhenophasesForSpecies(species.species_id).then(function(list){
                        $log.debug('phenophaseList',list);
                        $scope.phenophaseList = list;
                        $scope.selection.phenophase = list.length ? list[0] : undefined;
                    });
                }
            });
            $scope.validSelection = function() {
                var s = $scope.selection;
                if(s.species && s.phenophase && s.year) {
                    return $scope.mapVisFilter.length < 3 &&
                            ($scope.mapVisFilter.length === 0 ||
                            !$scope.mapVisFilter.reduce(function(found,f){
                                return found||(s.species === f.species && s.phenophase === f.phenophase && s.year === f.year);
                            },false));
                }
                return false;
            };
            $scope.addSelectionToFilter = function() {
                $scope.mapVisFilter.push(angular.extend({},$scope.selection));
            };
        }
    };
}])
/**
 * @ngdoc controller
 * @name npn-viz-tool.vis-map:MapVisCtrl
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Controller for the gridded data map visualization dialog.
 */
.controller('MapVisCtrl',['$scope','$uibModalInstance','$filter','$log','$compile','$timeout','$q','uiGmapGoogleMapApi','uiGmapIsReady','RestrictedBoundsService','WmsService','WcsService','ChartService','MapVisMarkerService','md5',
    function($scope,$uibModalInstance,$filter,$log,$compile,$timeout,$q,uiGmapGoogleMapApi,uiGmapIsReady,RestrictedBoundsService,WmsService,WcsService,ChartService,MapVisMarkerService,md5){
        var api,
            map,
            infoWindow,
            boundsRestrictor = RestrictedBoundsService.getRestrictor('map_vis');
        $scope.modal = $uibModalInstance;
        $scope.wms_map = {
            center: { latitude: 48.35674, longitude: -122.39658 },
            zoom: 3,
            options: {
                disableDoubleClickZoom: true, // click on an arbitrary point gets gridded data so disable zoom (use controls).
                scrollwheel: false,
                streetViewControl: false,
                panControl: false,
                zoomControl: true,
                zoomControlOptions: {
                    style: google.maps.ZoomControlStyle.SMALL,
                    position: google.maps.ControlPosition.RIGHT_TOP
                }
            },
            events: {
                click: function(m,ename,args) {
                    var ev = args[0];
                    $log.debug('click',ev);
                    if($scope.selection.activeLayer) {
                        WcsService.getGriddedData($scope.selection.activeLayer,ev.latLng,4/*should gridSize change based on the layer?*/)
                            .then(function(tuples){
                                var html,compiled;
                                $log.debug('tuples',tuples);
                                $scope.gridded_point_data = tuples && tuples.length ? tuples[0] : undefined;
                                if(typeof($scope.gridded_point_data) === 'undefined') {
                                    return;
                                }
                                if(!infoWindow) {
                                    infoWindow = new api.InfoWindow({
                                        maxWidth: 200,
                                        content: 'contents'
                                    });
                                }
                                $scope.gridded_point_legend = $scope.legend ? $scope.legend.getPointData($scope.gridded_point_data) : undefined;
                                if($scope.gridded_point_legend){
                                    $log.debug('data from legend:',$scope.gridded_point_data,$scope.gridded_point_legend);
                                    html = '<div><div id="griddedPointInfoWindow" class="ng-cloak">';
                                    html += '<div class="gridded-legend-color" style="background-color: {{gridded_point_legend.color}};">&nbsp;</div>';
                                    html += '<div class="gridded-point-data">{{legend.formatPointData(gridded_point_data)}} ({{gridded_point_data | number:0}})</div>';
                                    //html += '<pre>\n{{gridded_point_data}}\n{{gridded_point_legend}}</pre>';
                                    html += '</div></div>';
                                    compiled = $compile(html)($scope);
                                    $timeout(function(){
                                        infoWindow.setContent(compiled.html());
                                        infoWindow.setPosition(ev.latLng);
                                        infoWindow.open(map);
                                    });
                                } else {
                                    infoWindow.setContent($filter('number')($scope.gridded_point_data,1)); // TODO: precision is likely layer specific
                                    infoWindow.setPosition(ev.latLng);
                                    infoWindow.open(map);
                                }

                            },function() {
                                // TODO?
                                $log.error('unable to get gridded data.');
                            });
                    }
                },
                center_changed: boundsRestrictor.center_changed
            }
        };
        uiGmapGoogleMapApi.then(function(maps){
            api = maps;
            uiGmapIsReady.promise(2).then(function(instances){
                map = instances[1].map;
                WmsService.getLayers(map).then(function(layers){
                    $log.debug('layers',layers);
                    $scope.layers = layers;
                },function(){
                    $log.error('unable to get map layers?');
                });
            });
        });

        $scope.selection = {};
        $scope.results = {
            markers: []
        };
        $scope.$watch('selection.layerCategory',function(category) {
            $log.debug('layer category change ',category);
            if($scope.selection.activeLayer) {
                $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                $scope.selection.activeLayer.off();
                delete $scope.selection.activeLayer;
                delete $scope.legend;
            }
        });
        $scope.$watch('selection.layer',function(layer) {
            if(!layer) {
                return;
            }
            if(infoWindow) {
                infoWindow.close();
            }
            $log.debug('selection.layer',layer);
            if($scope.selection.activeLayer) {
                $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                $scope.selection.activeLayer.off();
            }
            // looks odd that we're not turning the layer on here
            // but updating the activeLayer reference will also result in
            // the selection.activeLayer.extent.current watch firing which
            // toggles the map off/on
            $log.debug('fitting new layer ',layer.name);
            $scope.selection.activeLayer = layer.fit().on();
            if(!$scope.selection.activeLayer.supportsData()) {
                // moving to a layer that doesn't support data
                // clear markers if any have been placed on the map.
                $scope.results.markers = [];
            }
            boundsRestrictor.setBounds(layer.getBounds());
            delete $scope.legend;
            $scope.selection.activeLayer.getLegend(layer).then(function(legend){
                $scope.legend = legend;
            });
        });
        $scope.$watch('selection.activeLayer.extent.current',function(v) {
            if($scope.selection.activeLayer) {
                $log.debug('layer extent change ',$scope.selection.activeLayer.name,v);
                $scope.selection.activeLayer.off().on();
            }
        });

        // This is an array of species/phenohpase selections which is passed to other directives
        // to manipulate.
        $scope.speciesSelections = [];
        $scope.$watchCollection('speciesSelections',function(speciesSelections) {
            $log.debug('speciesSelections',speciesSelections);
        });

        $scope.markerEvents = {
            'click': function(m) {
                $log.debug('click',m);
            }
        };

        $scope.plotMarkers = function() {
            $scope.results.markers = [];
            $scope.working = true;
            // KISS - it may be more efficient to try to decide when to merge requests
            // together but this adds a lot of complexity/fragility so issuing
            // one request per combo in the filter.  this way there's no need to sift
            // through the results to decide which result applies to which marker type,
            // or deal with situations like gaps in years (one combo 2012 and another 2014
            // would make two requests better than one which would require tossing out 2013 data),
            // etc.

            // keep track of markers based on site so that if multiple species/individiuals exist for a given site
            // arrive markers can be updated more efficiently
            var site2marker = {},
                summary_promises = $scope.speciesSelections.map(function(s,filter_index){
                var def = $q.defer(),
                    params = {
                        request_src: 'npn-vis-map',
                        start_date: s.year+'-01-01',
                        end_date: s.year+'-12-31',
                        'species_id[0]': s.species.species_id,
                        'phenophase_id[0]': s.phenophase.phenophase_id
                    };
                $log.debug('gathering summary data for ',s,params);
                ChartService.getSummarizedData(params,function(data){
                    $log.debug('data has arrived for ',s,data);
                    // need to consolidate individual data
                    var individuals = data.reduce(function(map,d){
                            if(!map[d.individual_id]) {
                                map[d.individual_id] = [];
                            }
                            map[d.individual_id].push(d);
                            return map;
                        },{}),new_markers = [];
                    // sort individual arrays ascending on first_yes_doy
                    Object.keys(individuals).forEach(function(in_id){
                        individuals[in_id].sort(function(a,b){
                            return a.first_yes_doy - b.first_yes_doy;
                        });
                        var record = individuals[in_id][0],
                            legend_data = $scope.legend.getPointData(record.first_yes_doy),
                            marker = angular.extend(record,{
                                        markerOpts: {
                                            title: s.year+': '+(legend_data ? legend_data.label : 'Off Scale?'),
                                            zIndex: (365-record.first_yes_doy), // earlier === higher
                                            icon: angular.extend(MapVisMarkerService.getBaseIcon(filter_index),{
                                                fillColor: legend_data ? legend_data.color : '#fff',
                                                fillOpacity: 1.0,
                                                strokeColor: '#204d74',
                                                strokeWeight: 1
                                            })
                                        }
                                    });
                            if(site2marker[marker.site_id]) {
                                $log.debug('TODO - a marker already exists for site ',marker.site_id,site2marker[marker.site_id],marker);
                                site2marker[marker.site_id].markerOpts.title += ', '+marker.markerOpts.title;
                                site2marker[marker.site_id].markerOpts.icon.strokeColor = '#00ff00'; // green border
                                site2marker[marker.site_id].$markerKey = md5.createHash(JSON.stringify(site2marker[marker.site_id]));
                            } else {
                                marker.$markerKey = md5.createHash(JSON.stringify(marker));
                                site2marker[marker.site_id] = marker;
                                new_markers.push(marker);
                            }
                    });
                    $log.debug('individuals',individuals);
                    // append any new markers
                    $scope.results.markers = $scope.results.markers.concat(new_markers);
                    // put the markers on the map as the data arrives.
                    // MapVisMarkerService.PATHS[i]
                    def.resolve();
                });
                return def.promise;
            });
            $q.all(summary_promises).then(function(data){
                $log.debug('all summary data has arrived...',data);
                $scope.working = false;
            });
        };
}]);