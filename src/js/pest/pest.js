/**
 * @ngdoc overview
 * @name npn-viz-tool.gridded
 * @description
 *
 * Base module for controlling gridded map layers.
 */
angular.module('npn-viz-tool.pest',[
    'npn-viz-tool.pest-services'
])
/**
 * @ngdoc service
 * @name npn-viz-tool.gridded:PestControlService
 * @module npn-viz-tool.gridded
 * @description
 *
 * This is simply an empty object that can be shared between the gridded-control, gridded-legend-main
 * directives and the sharing control to expose currently the active layer/legend (if any).
 *
 * The gridded-control and gridded-legend-main directives are not placed hierarchically with respect to
 * one another so this object acts as an intermediary where the legend object can be referenced.
 */
    .service('PestControlService',['$location',function($location){
        var service = {
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded:GriddedControlService
             * @name  getLegend
             * @description
             *
             * Gets the currently active legend, if any.
             *
             * @return {npn-viz-tool.gridded-services:WmsMapLegend} The legend, if one is active.
             */
            getLegend: function() { return service.legend; },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded:GriddedControlService
             * @name  getLayer
             * @description
             *
             * Gets the currently active layer, if any.
             *
             * @return {npn-viz-tool.gridded-services:WmsMapLayer} The layer, if one is active.
             */
            getLayer: function() { return service.layer; },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded:GriddedControlService
             * @name  addSharingUrlArgs
             * @description
             *
             * Populates any necessary sharing URL parameters for the share control.
             *
             * @param {object} params The params object that will be used to build a shared URL.
             */
            addSharingUrlArgs: function(params) {
                if(service.layer) {
                    var args = service.layer.name+'/'+service.layer.extent.current.value,
                        range = service.layer.getStyleRange();
                    if(range) {
                        args += '/'+range[0]+'/'+range[1];
                    }
                    params['gl'] = args;
                }
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded:GriddedControlService
             * @name  getSharingUrlArgs
             * @description
             *
             * Pulls any sharing URL args from the current URL.
             *
             * @returns {Array} An array of strings or undefined.  Index 0 is the layer name and index 1 is the current extent value.
             */
            getSharingUrlArgs: function() {
                var gl = $location.search()['gl'];
                if(gl) {
                    return gl.split(/\//);
                }
            }
        };
        return service;
    }])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.gridded:gridded-control
 * @module npn-viz-tool.gridded
 * @description
 *
 * Gridded layers toolbar content.
 */
.directive('pestControl',['$log','$rootScope','uiGmapGoogleMapApi','uiGmapIsReady','WmsService','GriddedControlService','GriddedInfoWindowHandler',function($log,$rootScope,uiGmapGoogleMapApi,uiGmapIsReady,WmsService,GriddedControlService,GriddedInfoWindowHandler){
    return {
        restrict: 'E',
        templateUrl: 'js/pest/pest-control.html',
        link: function($scope) {
            var griddedIwHandler;
            $scope.selection = {};
            $scope.actions = {
                reset: function() {
                    delete $scope.selection.layerCategory;
                    delete $scope.selection.layer;
                }
            };
            $scope.$on('filter-reset',$scope.actions.reset);
            var api,
                map,
                initCalled;
            function init() {
                if(initCalled) {
                    return;
                }
                initCalled = true;
                uiGmapGoogleMapApi.then(function(maps){
                    api = maps;
                    uiGmapIsReady.promise(1).then(function(instances){
                        map = instances[0].map;
                        griddedIwHandler = new GriddedInfoWindowHandler(map);
                        map.addListener('click',function(e){
                            griddedIwHandler.open(e.latLng,$scope.selection.activeLayer,$scope.legend);
                        });
                        WmsService.getLayers(map).then(function(layers){
                            $log.debug('layers',layers);
                            $scope.layers = layers;
                            var sharingUrlArgs = GriddedControlService.getSharingUrlArgs(),lname,ext,c,l;
                            if(sharingUrlArgs) {
                                $log.debug('arguments from shared url',sharingUrlArgs);
                                lname = sharingUrlArgs[0];
                                ext = sharingUrlArgs[1];
                                l = layers.categories.reduce(function(found,cat){
                                    if(!found){
                                        found = cat.layers.reduce(function(f,ly){
                                            return f||(ly.name === lname ? ly : undefined);
                                        },undefined);
                                        if(found) {
                                            c = cat;
                                        }
                                    }
                                    return found;
                                },undefined);
                                if(l) {
                                    l.extent.current = l.extent.values.reduce(function(found,extent){
                                        return found||(extent.value === ext ? extent : undefined);
                                    },undefined)||l.extent.current;
                                    $scope.selection.layerCategory = c;
                                    $scope.selection.layer = l;
                                    if(sharingUrlArgs.length === 4) {
                                        l.setStyleRange([parseInt(sharingUrlArgs[2]),parseInt(sharingUrlArgs[3])]);
                                    }
                                } else {
                                    $log.warn('unable to find gridded layer named '+lname);
                                }
                            }
                        },function(){
                            $log.error('unable to get map layers?');
                        });
                    });
                });
            }
            if(GriddedControlService.getSharingUrlArgs()) {
                init();
            } else {
                $scope.$on('tool-open',function(event,data){
                    if(data.tool.id === 'gridded') {
                        init();
                    }
                });
            }
            function noInfoWindows() {
                if(griddedIwHandler) {
                    griddedIwHandler.close();
                }
            }
            $scope.$watch('selection.layerCategory',function(category) {
                $log.debug('layer category change ',category);
                if($scope.selection.activeLayer) {
                    $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                    var layer = $scope.selection.activeLayer;
                    $scope.selection.activeLayer.off();
                    delete $scope.selection.activeLayer;
                    delete $scope.legend;
                    delete GriddedControlService.legend;
                    delete GriddedControlService.layer;
                    noInfoWindows();
                    $rootScope.$broadcast('gridded-layer-off',{layer:layer});
                }
            });
            $scope.$watch('selection.layer',function(layer) {
                if(!layer) {
                    return;
                }
                noInfoWindows();
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
                GriddedControlService.layer = $scope.selection.activeLayer = layer.fit().on();
                //boundsRestrictor.setBounds(layer.getBounds());
                delete $scope.legend;
                $scope.selection.activeLayer.getLegend(layer).then(function(legend){
                    GriddedControlService.legend = $scope.legend = legend;
                });
                $rootScope.$broadcast('gridded-layer-on',{layer:$scope.selection.activeLayer});
            });
            $scope.$watch('selection.activeLayer.extent.current',function(v) {
                var layer;
                if(layer = $scope.selection.activeLayer) {
                    $log.debug('layer extent change ',layer.name,v);
                    noInfoWindows();
                    layer.bounce();
                }
            });
        }
    };
}]);