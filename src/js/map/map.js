angular.module('npn-viz-tool.map',[
    'npn-viz-tool.layers',
    'npn-viz-tool.stations',
    'npn-viz-tool.toolbar',
    'npn-viz-tool.filter',
    'npn-viz-tool.bounds',
    'npn-viz-tool.settings',
    'npn-viz-tool.vis',
    'npn-viz-tool.share',
    'npn-viz-tool.export',
    'uiGmapgoogle-maps'
])
.directive('npnVizMap',['$location','$timeout','uiGmapGoogleMapApi','uiGmapIsReady','FilterService',function($location,$timeout,uiGmapGoogleMapApi,uiGmapIsReady,FilterService){
    return {
        restrict: 'E',
        templateUrl: 'js/map/map.html',
        scope: {
        },
        controller: ['$scope',function($scope) {
            var dfltCenter = { latitude: 38.8402805, longitude: -97.61142369999999 },
                dfltZoom = 4,
                api,
                map;
            $scope.stationView = false;
            uiGmapGoogleMapApi.then(function(maps) {
                api = maps;
                $scope.map = {
                    center: dfltCenter,
                    zoom: dfltZoom,
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
            uiGmapIsReady.promise(1).then(function(instances){
                map = instances[0].map;
                // this is a little leaky, the map knows which args the "share" control cares about...
                // date is the minimum requirement for filtering.
                var qargs = $location.search(),
                    qArgFilter = qargs['d'] && (qargs['s'] || qargs['n']);
                $scope.stationView = !qArgFilter;

                // constrain map movement to N America
                var allowedBounds = new api.LatLngBounds(
                         new google.maps.LatLng(0.0,-174.0),// SW - out in the pacific SWof HI
                         new google.maps.LatLng(75.0,-43.0) // NE - somewhere in greenland
                    ),
                    lastValidCenter = map.getCenter();
                if(qargs['allowedBounds']) {
                    var allowedBoundsRectangle = new api.Rectangle();
                    allowedBoundsRectangle.setOptions({
                      strokeColor: '#FFF',
                      strokeOpacity: 0.8,
                      strokeWeight: 2,
                      fillColor: '#FFF',
                      fillOpacity: 0.35,
                      map: map,
                      bounds: allowedBounds
                    });
                }
                api.event.addListener(map,'center_changed',function(){
                    if(allowedBounds.contains(map.getCenter())) {
                        lastValidCenter = map.getCenter();
                        return;
                    }
                    map.panTo(lastValidCenter);
                });
            });
            function stationViewOff() {
                $scope.stationView = false;
            }
            function stationViewOn() {
                if(map) {
                    map.panTo(new google.maps.LatLng(dfltCenter.latitude,dfltCenter.longitude));
                    map.setZoom(4);
                }
                $scope.stationView = true;
            }
            $scope.$on('tool-open',function(event,data){
                if(data.tool.id === 'layers') {
                    stationViewOff();
                }
            });
            $scope.$on('filter-phase1-start',stationViewOff);
            $scope.$on('filter-reset',stationViewOn);
            $scope.reset = function() {
                if(!$scope.stationView) {
                    FilterService.resetFilter();
                } else {
                    $scope.stationView = false;
                    $timeout(stationViewOn,500);
                }
            };
        }]
    };
}])
.directive('npnWorking',['uiGmapIsReady',function(uiGmapIsReady){
    return {
        restrict: 'E',
        template: '<div id="npn-working" ng-show="working"><i class="fa fa-circle-o-notch fa-spin fa-5x"></i></div>',
        scope: {
        },
        controller: function($scope) {
            function startWorking() { $scope.working = true; }
            function stopWorking() { $scope.working = false;}
            startWorking();
            uiGmapIsReady.promise(1).then(stopWorking);
            $scope.$on('filter-phase1-start',startWorking);
            $scope.$on('filter-phase2-start',startWorking);
            $scope.$on('filter-rerun-phase2',startWorking);
            $scope.$on('filter-phase2-end',stopWorking);
            $scope.$on('layer-load-start',startWorking);
            $scope.$on('layer-load-end',stopWorking);
        }
    };
}]);