/**
 * @ngdoc overview
 * @name npn-viz-tool.gridded
 * @description
 *
 * Base module for controlling gridded map layers.
 */
angular.module('npn-viz-tool.pest',[
    'npn-viz-tool.gridded-services'
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
 * @name npn-viz-tool.gridded:gridded-legend-main
 * @module npn-viz-tool.gridded
 * @description
 *
 * Gridded legend for the main map which communicates with the gridded toolbar to display a legend for
 * any currently selected gridded layer.
 *
 * @scope
 */
.directive('pestLegendMain',['PestControlService',function(PestControlService){
    return {
        restrict: 'E',
        template: '<div id="pestLegendMain" ng-style="{display: shared.legend ? \'inherit\' : \'none\'}"><pest-legend legend="shared.legend"></pest-legend></div>',
        scope: {},
        link: function($scope) {
            $scope.shared = PestControlService;
        }
    };
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
.directive('pestControl',['$log','$rootScope','uiGmapGoogleMapApi','uiGmapIsReady','WmsService','PestControlService','GriddedInfoWindowHandler',function($log,$rootScope,uiGmapGoogleMapApi,uiGmapIsReady,WmsService,PestControlService,GriddedInfoWindowHandler){
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
                //if(initCalled) {
                if($scope.layers != null) {
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
                            //setActiveLayer();
                            console.log('setting active layer to agdd base 50');
                            for( var i = 0; i < layers.categories.length; i++) {
                                if(layers.categories[i].name === 'Temperature Accumulations, Current Day') {
                                    for( var j = 0; j < layers.categories[i].layers.length; j++) {
                                        if (layers.categories[i].layers[j].name === 'gdd:agdd_50f') {
                                            console.log(layers.categories[i].layers[j].name);
                                            $scope.selection.layer = layers.categories[i].layers[j];
                                        }
                                    }
                                }
                            }
                            // var sharingUrlArgs = PestControlService.getSharingUrlArgs(),lname,ext,c,l;
                            // if(sharingUrlArgs) {
                            //     $log.debug('arguments from shared url',sharingUrlArgs);
                            //     lname = sharingUrlArgs[0];
                            //     ext = sharingUrlArgs[1];
                            //     l = layers.categories.reduce(function(found,cat){
                            //         if(!found){
                            //             found = cat.layers.reduce(function(f,ly){
                            //                 return f||(ly.name === lname ? ly : undefined);
                            //             },undefined);
                            //             if(found) {
                            //                 c = cat;
                            //             }
                            //         }
                            //         return found;
                            //     },undefined);
                            //     if(l) {
                            //         l.extent.current = l.extent.values.reduce(function(found,extent){
                            //             return found||(extent.value === ext ? extent : undefined);
                            //         },undefined)||l.extent.current;
                            //         $scope.selection.layerCategory = c;
                            //         $scope.selection.layer = l;
                            //         if(sharingUrlArgs.length === 4) {
                            //             l.setStyleRange([parseInt(sharingUrlArgs[2]),parseInt(sharingUrlArgs[3])]);
                            //         }
                            //     } else {
                            //         $log.warn('unable to find gridded layer named '+lname);
                            //     }
                            // }
                        },function(){
                            $log.error('unable to get map layers?');
                        });
                    });
                });
            }
            if(PestControlService.getSharingUrlArgs()) {
                init();
            } else {
                $scope.$on('tool-open',function(event,data){
                    if(data.tool.id === 'pestmaps') {
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
                $rootScope.$broadcast('reset-gridded-layer');
                if($scope.selection.activeLayer) {
                    $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                    var layer = $scope.selection.activeLayer;
                    $scope.selection.activeLayer.offPest();
                    delete $scope.selection.activeLayer;
                    delete $scope.legend;
                    delete PestControlService.legend;
                    delete PestControlService.layer;
                    noInfoWindows();
                    $rootScope.$broadcast('gridded-layer-off',{layer:layer});
                }
            });
            $scope.$on('reset-pest-layer',function() {
                delete $scope.selection.pest;
                delete $scope.layers;
                if($scope.selection.activeLayer) {
                    $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                    var layer = $scope.selection.activeLayer;
                    $scope.selection.activeLayer.offPest();
                    delete $scope.selection.activeLayer;
                    delete $scope.legend;
                    delete PestControlService.legend;
                    delete PestControlService.layer;
                    noInfoWindows();
                    //$rootScope.$broadcast('gridded-layer-off',{layer:layer});
                }
            });
            $scope.$watch('selection.pest',function(pest) {
                if($scope.selection.pest != null) {
                    $rootScope.$broadcast('reset-gridded-layer');
                }
                noInfoWindows();

                $scope.selection.timeSeriesDate = 60;

                if($scope.selection.activeLayer) {
                    $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                    $scope.selection.activeLayer.offPest();
                }

                // toggle between base32 and base50 underlying wms layer depending on selected pest
                if($scope.layers && $scope.layers.categories) {
                    for( var i = 0; i < $scope.layers.categories.length; i++) {
                        if($scope.layers.categories[i].name === 'Temperature Accumulations, Current Day') {
                            for( var j = 0; j < $scope.layers.categories[i].layers.length; j++) {
                                if(pest === 'Hemlock Woolly Adelgid') {
                                    if ($scope.layers.categories[i].layers[j].name === 'gdd:agdd') {
                                        $scope.selection.layer = $scope.layers.categories[i].layers[j];
                                        $scope.selection.activeLayer = $scope.layers.categories[i].layers[j];
                                    }
                                } else {
                                    if ($scope.layers.categories[i].layers[j].name === 'gdd:agdd_50f') {
                                        $scope.selection.layer = $scope.layers.categories[i].layers[j];
                                        $scope.selection.activeLayer = $scope.layers.categories[i].layers[j];
                                    }
                                }
                            }
                        }
                    }
                }

                if($scope.selection.activeLayer) {
                    $scope.selection.activeLayer.pest = pest;

                    //reset the extent date
                    var da = new Date();
                    da.setHours(0,0,0,0);
                    $scope.selection.activeLayer.extent.current.date = da;
                    $scope.selection.activeLayer.extent.current.value = da.toISOString();
                    var locale = 'en-us';
                    $scope.selection.activeLayer.extent.current.label = da.toLocaleString(locale, { month: 'long' }) + ' ' + da.getDate() + ', ' + da.getFullYear();

                    delete $scope.legend;
                    $scope.selection.activeLayer.getLegend().then(function(legend){
                        legend.pest = $scope.selection.pest;
                        PestControlService.legend = $scope.legend = legend;
                    });
                    
                    //$scope.selection.activeLayer.bouncePest(pest);
                }
            });
            $scope.$watch('selection.layer',function(layer) {
                // if(layer != 'affa') {
                //     return;
                // }
                
                // check this https://gis.stackexchange.com/questions/10117/clipping-raster-with-vector-boundaries-using-qgis
                // console.log(layer);
                // WmsService.getPestMap().then(function(pestMapData){
                //     console.log('in then');
                //     console.log(pestMapData.data.clippedImage);
                //     console.log(pestMapData.data.bbox);
                // });
                // if(layer != 'dsf') {
                //     return;
                // }
                if(!layer) {
                    return;
                }
                noInfoWindows();
                $log.debug('selection.layer',layer);
                if($scope.selection.activeLayer) {
                    $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                    $scope.selection.activeLayer.offPest();
                }
                layer.pest = $scope.selection.pest;
                // looks odd that we're not turning the layer on here
                // but updating the activeLayer reference will also result in
                // the selection.activeLayer.extent.current watch firing which
                // toggles the map off/on
                $log.debug('fitting new layer ',layer.name);
                PestControlService.layer = $scope.selection.activeLayer = layer.fit().onPest();
                //boundsRestrictor.setBounds(layer.getBounds());
                // delete $scope.legend;
                // $scope.selection.activeLayer.getLegend(layer).then(function(legend){
                //     PestControlService.legend = $scope.legend = legend;
                // });
                $rootScope.$broadcast('gridded-layer-on',{layer:$scope.selection.activeLayer});

                //testing this
                // noInfoWindows();
                // layer.bouncePest($scope.selection.pest);
            });
            $scope.$watch('selection.activeLayer.extent.current.date',function(v) {
                noInfoWindows();
                if($scope.selection && $scope.selection.activeLayer) {
                    // console.log('-------');
                    // console.log('date changed!!!');
                    // console.log($scope.selection.activeLayer.name);
                    // console.log($scope.selection.activeLayer.pest);
                    // console.log($scope.selection.activeLayer.extent.current.date);
                    setTimeout(function () {
                        // console.log('bouncing');
                        // console.log('********');
                        $scope.selection.activeLayer.bouncePest($scope.selection.pest);
                    }, 500);
                }
                
                // var layer;
                // if(layer == $scope.selection.activeLayer) {
                //     $log.debug('layer extent change ',layer.name,v);
                //     noInfoWindows();
                //     layer.bouncePest($scope.selection.pest);
                //     //layer.bounce();
                // }
            });
        }
    };
}]);