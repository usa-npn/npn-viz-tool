/**
 * @ngdoc overview
 * @name npn-viz-tool.gridded
 * @description
 *
 * Base module for controlling gridded map layers.
 */
angular.module('npn-viz-tool.gridded',[
    'npn-viz-tool.gridded-services'
])
/**
 * @ngdoc service
 * @name npn-viz-tool.gridded:GriddedLegendScope
 * @module npn-viz-tool.gridded
 * @description
 *
 * This is not truly a service but just an empty object that can be shared between the gridded-control
 * and gridded-legend-main directives.  These two directives are not placed hierarchically with respect to
 * one another.  This object simply acts as an intermediary where the legend object can be referenced.
 */
.service('GriddedLegendScope',[function(){
    return {};
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
.directive('griddedLegendMain',['GriddedLegendScope',function(GriddedLegendScope){
    return {
        restrict: 'E',
        template: '<div id="griddedLegendMain" ng-style="{display: shared.legend ? \'inherit\' : \'none\'}"><gridded-legend legend="shared.legend"></gridded-legend></div>',
        scope: {},
        link: function($scope) {
            $scope.shared = GriddedLegendScope;
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
.directive('griddedControl',['$log','$rootScope','uiGmapGoogleMapApi','uiGmapIsReady','WmsService','GriddedLegendScope','GriddedInfoWindowHandler',function($log,$rootScope,uiGmapGoogleMapApi,uiGmapIsReady,WmsService,GriddedLegendScope,GriddedInfoWindowHandler){
    return {
        restrict: 'E',
        templateUrl: 'js/gridded/gridded-control.html',
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
                map;
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
                    },function(){
                        $log.error('unable to get map layers?');
                    });
                });
            });
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
                    delete GriddedLegendScope.legend;
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
                $scope.selection.activeLayer = layer.fit().on();
                //boundsRestrictor.setBounds(layer.getBounds());
                delete $scope.legend;
                $scope.selection.activeLayer.getLegend(layer).then(function(legend){
                    GriddedLegendScope.legend = $scope.legend = legend;
                });
                $rootScope.$broadcast('gridded-layer-on',{layer:$scope.selection.activeLayer});
            });
            $scope.$watch('selection.activeLayer.extent.current',function(v) {
                var layer;
                if(layer = $scope.selection.activeLayer) {
                    $log.debug('layer extent change ',layer.name,v);
                    noInfoWindows();
                    layer.off().on();
                }
            });
        }
    };
}]);