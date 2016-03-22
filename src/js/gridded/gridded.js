angular.module('npn-viz-tool.gridded',[
    'npn-viz-tool.gridded-services'
])
.directive('griddedControl',['$log','uiGmapGoogleMapApi','uiGmapIsReady','WmsService',function($log,uiGmapGoogleMapApi,uiGmapIsReady,WmsService){
    return {
        restrict: 'E',
        templateUrl: 'js/gridded/gridded-control.html',
        link: function($scope) {
            $scope.selection = {};
            var api,
                map;
            uiGmapGoogleMapApi.then(function(maps){
                api = maps;
                uiGmapIsReady.promise(1).then(function(instances){
                    map = instances[0].map;
                    WmsService.getLayers(map).then(function(layers){
                        $log.debug('layers',layers);
                        $scope.layers = layers;
                    },function(){
                        $log.error('unable to get map layers?');
                    });
                });
            });
            function noInfoWindows() {
                // TODO
            }
            $scope.$watch('selection.layerCategory',function(category) {
                $log.debug('layer category change ',category);
                if($scope.selection.activeLayer) {
                    $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                    $scope.selection.activeLayer.off();
                    delete $scope.selection.activeLayer;
                    delete $scope.legend;
                    noInfoWindows();
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
                    $scope.legend = legend;
                });
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