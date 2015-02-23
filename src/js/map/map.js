angular.module('npn-viz-tool.map',[
    'npn-viz-tool.services',
    'npn-viz-tool.stations',
    'npn-viz-tool.toolbar',
    'npn-viz-tool.filter',
    'uiGmapgoogle-maps'
])
.directive('npnVizMap',['$document','uiGmapGoogleMapApi','uiGmapIsReady',function($document,uiGmapGoogleMapApi,uiGmapIsReady){
    return {
        restrict: 'E',
        templateUrl: 'js/map/map.html',
        scope: {
        },
        controller: ['$scope',function($scope) {
            $scope.stationView = true;
            uiGmapGoogleMapApi.then(function(maps) {
                console.log('maps',maps);
                $scope.map = {
                    center: { latitude: 38.8402805, longitude: -97.61142369999999 },
                    zoom: 4,
                    options: {
                        streetViewControl: false,
                        panControl: false,
                        zoomControl: true,
                        zoomControlOptions: {
                            style: maps.ZoomControlStyle.SMALL,
                            position: maps.ControlPosition.RIGHT_TOP
                        }
                    }
                };
            });
            /*
            $document.bind('keypress',function(e){
                if(e.charCode === 114 || e.key === 'R') {
                    $scope.$apply(function(){
                        $scope.stationView = !$scope.stationView;
                    });
                }
                console.log('kp',e);
            });*/
        }]
    };
}]);