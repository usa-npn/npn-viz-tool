angular.module('npn-viz-tool.bounds',[
    'npn-viz-tool.filter',
    'uiGmapgoogle-maps'
])
.directive('boundsManager',['$rootScope','$log','uiGmapGoogleMapApi','FilterService','BoundsFilterArg',
    function($rootScope,$log,uiGmapGoogleMapApi,FilterService,BoundsFilterArg){
    return {
        restrict: 'E',
        template: '<ui-gmap-drawing-manager ng-if="!isFilterEmpty()" options="options" control="control"></ui-gmap-drawing-manager>',
        controller: ['$scope',function($scope) {
            $scope.isFilterEmpty = FilterService.isFilterEmpty;
            function refilter() {
                if(FilterService.getFilter().hasSufficientCriteria()) {
                    $rootScope.$broadcast('filter-rerun-phase2',{});
                }
            }
            uiGmapGoogleMapApi.then(function(maps) {
                var mapsApi = maps,
                    dcOptions = {
                        drawingModes: [mapsApi.drawing.OverlayType.RECTANGLE],
                        position: mapsApi.ControlPosition.TOP_RIGHT,
                        drawingControl: false
                    };
                $log.debug('api',maps);
                $scope.options = {
                    drawingControlOptions: dcOptions,
                    rectangleOptions: BoundsFilterArg.RECTANGLE_OPTIONS
                };
                $scope.control = {};
                $scope.$on('bounds-filter-ready',function(event,data){
                    mapsApi.event.addListener(data.filter.arg,'mouseover',function(){
                        data.filter.arg.setOptions(angular.extend({},BoundsFilterArg.RECTANGLE_OPTIONS,{strokeWeight: 2}));
                    });
                    mapsApi.event.addListener(data.filter.arg,'mouseout',function(){
                        data.filter.arg.setOptions(BoundsFilterArg.RECTANGLE_OPTIONS);
                    });
                    mapsApi.event.addListener(data.filter.arg,'rightclick',function(){
                        FilterService.removeFromFilter(data.filter);
                        refilter();
                    });
                });
                $scope.$watch('control.getDrawingManager',function(){
                    if($scope.control.getDrawingManager){
                        var drawingManager = $scope.control.getDrawingManager();
                        mapsApi.event.addListener(drawingManager,'rectanglecomplete',function(rectangle){
                            drawingManager.setDrawingMode(null);
                            FilterService.addToFilter(new BoundsFilterArg(rectangle));
                            refilter();
                        });
                        $scope.$on('filter-reset',function(event,data){
                            dcOptions.drawingControl = false;
                            drawingManager.setOptions(dcOptions);
                        });
                        $scope.$on('filter-update',function(event,data){
                            dcOptions.drawingControl = FilterService.hasSufficientCriteria();
                            drawingManager.setOptions(dcOptions);
                        });
                    }
                });

            });
        }]
    };
}]);