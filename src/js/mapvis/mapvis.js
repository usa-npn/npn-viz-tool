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
    'ui.bootstrap'
])
/**
 * @ngdoc directive
 * @name npn-viz-tool.vis-map:map-vis-doy-control
 * @module npn-viz-tool.vis-map
 * @description
 *
 * control for day of year extents.
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
 * @name npn-viz-tool.vis-map:map-vis-year-control
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Control for year extents.
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
 * @name npn-viz-tool.vis-map:map-vis-date-control
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Control for date extents.
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
 * @name npn-viz-tool.vis-map:map-vis-layer-control
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Directive to control categorized selection of WMS layers.
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
 * @ngdoc controller
 * @name npn-viz-tool.vis-map:MapVisCtrl
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Controller for the gridded data map visualization dialog.
 */
.controller('MapVisCtrl',['$scope','$uibModalInstance','$filter','$log','uiGmapGoogleMapApi','uiGmapIsReady','WmsService','WcsService','FilterService','ChartService','SettingsService',
    function($scope,$uibModalInstance,$filter,$log,uiGmapGoogleMapApi,uiGmapIsReady,WmsService,WcsService,FilterService,ChartService,SettingsService){
        var api,map,infoWindow;
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
                                $log.debug('tuples',tuples);
                                if(!infoWindow) {
                                    infoWindow = new api.InfoWindow({
                                        maxWidth: 200,
                                        content: 'contents'
                                    });
                                }
                                infoWindow.setContent($filter('number')(tuples[0],1)); // TODO: precision is likely layer specific
                                infoWindow.setPosition(ev.latLng);
                                infoWindow.open(map);
                            },function() {
                                // TODO?
                                $log.error('unable to get gridded data.');
                            });
                    }
                }
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
        $scope.$watch('selection.layerCategory',function(category) {
            $log.debug('layer category change ',category);
            if($scope.selection.activeLayer) {
                $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                $scope.selection.activeLayer.off();
                delete $scope.selection.activeLayer;
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
        });
        $scope.$watch('selection.activeLayer.extent.current',function(v) {
            if($scope.selection.activeLayer) {
                $log.debug('layer extent change ',$scope.selection.activeLayer.name,v);
                $scope.selection.activeLayer.off().on();
            }
        });
}]);