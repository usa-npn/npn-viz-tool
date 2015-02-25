angular.module('npn-viz-tool.map',[
    'npn-viz-tool.layers',
    'npn-viz-tool.stations',
    'npn-viz-tool.toolbar',
    'npn-viz-tool.filter',
    'uiGmapgoogle-maps'
])
.directive('npnVizMap',['$document','uiGmapGoogleMapApi','uiGmapIsReady','FilterService',function($document,uiGmapGoogleMapApi,uiGmapIsReady,FilterService){
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
            $scope.$on('tool-close',function(event,data) {
                if(data.tool.id === 'filter' && !FilterService.isFilterEmpty()) {
                    // hide the station view
                    $scope.stationView = false;
                }
            });*/
            $scope.$on('filter-phase1-start',function(event,data){
                $scope.stationView = false;
            });
            $scope.$on('filter-reset',function(event,data){
                $scope.stationView = true;
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
}])
.directive('npnWorking',['uiGmapIsReady',function(uiGmapIsReady){
    return {
        restrict: 'E',
        template: '<div id="npn-working" ng-if="working"><i class="fa fa-circle-o-notch fa-spin fa-5x"></i></div>',
        scope: {
        },
        controller: function($scope) {
            $scope.working = true;
            uiGmapIsReady.promise(1).then(function(instances){
                $scope.working = false;
            });
            function startWorking(event,data) { $scope.working = true; }
            function stopWorking(event,data) { $scope.working = false; }
            $scope.$on('filter-phase1-start',startWorking);
            $scope.$on('filter-phase2-start',startWorking);
            $scope.$on('filter-phase2-end',stopWorking);
        }
    };
}]);