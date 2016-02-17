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
                    $scope.layers = layers;
                },function(){
                    $log.error('unable to get map layers?');
                });
            });
        });

        $scope.selection = {};
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
            $scope.selection.activeLayer = layer.fit();
        });
        $scope.$watch('selection.activeLayer.extent.current',function(v) {
            if($scope.selection.activeLayer) {
                $log.debug('layer extent change ',$scope.selection.activeLayer.name,v);
                $scope.selection.activeLayer.off().on();
            }
        });
}]);