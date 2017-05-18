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
    'npn-viz-tool.help',
    'npn-viz-tool.gridded',
    'uiGmapgoogle-maps'
])
.directive('npnVizMap',['$location','$timeout','uiGmapGoogleMapApi','uiGmapIsReady','RestrictedBoundsService','FilterService','GriddedControlService','HelpService',
    function($location,$timeout,uiGmapGoogleMapApi,uiGmapIsReady,RestrictedBoundsService,FilterService,GriddedControlService,HelpService){
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
                var boundsRestrictor = RestrictedBoundsService.getRestrictor('base_map',new api.LatLngBounds(
                             new google.maps.LatLng(0.0,-174.0),// SW - out in the pacific SWof HI
                             new google.maps.LatLng(75.0,-43.0) // NE - somewhere in greenland
                        ));
                $scope.map = {
                    center: dfltCenter,
                    zoom: dfltZoom,
                    options: {
                        mapTypeId: maps.MapTypeId.TERRAIN,
                        mapTypeControl: true,
                        mapTypeControlOptions: {
                            //style: maps.MapTypeControlStyle.DROPDOWN_MENU,
                            position: maps.ControlPosition.RIGHT_BOTTOM
                        },
                        streetViewControl: false,
                        panControl: false,
                        zoomControl: true,
                        zoomControlOptions: {
                            style: maps.ZoomControlStyle.SMALL,
                            position: maps.ControlPosition.RIGHT_TOP
                        },
                        styles: [{
                            featureType: 'poi',
                            elementType: 'labels',
                            stylers: [{visibility:'off'}]
                        },{
                            featureType: 'transit.station',
                            elementType: 'labels',
                            stylers: [{visibility:'off'}]
                        },
                        {
                            featureType: 'poi.park',
                            stylers: [{ visibility: 'off'}]
                        },
                        {
                            featureType: 'landscape',
                            stylers: [{ visibility: 'off'}]
                        }]
                    },
                    events: {
                        center_changed: boundsRestrictor.center_changed
                    }
                };
                uiGmapIsReady.promise(1).then(function(instances){
                    map = instances[0].map;
                    // this is a little leaky, the map knows which args the "share" control cares about...
                    // date is the minimum requirement for filtering.
                    var qargs = $location.search(),
                        qArgFilter = qargs['gl'] || (qargs['d'] && (qargs['s'] || qargs['n']));
                    if(!qArgFilter) {
                        stationViewOn();
                    }
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
                $timeout(function(){
                    $scope.stationView = true;
                },500);
                HelpService.lookAtMe('#toolbar-icon-filter',5000 /* wait 5 seconds */);
            }
            /*
            $scope.$on('tool-open',function(event,data){
                if(data.tool.id === 'layers') {
                    stationViewOff();
                }
            });*/
            $scope.$on('gridded-layer-on',stationViewOff);
            $scope.$on('gridded-layer-off',function() {
                if(FilterService.isFilterEmpty() && !GriddedControlService.layer) {
                    stationViewOn();
                }
            });
            $scope.$on('filter-phase1-start',stationViewOff);
            $scope.$on('filter-reset',stationViewOn);
            $scope.reset = function() {
                FilterService.resetFilter();
                if($scope.stationView) {
                    $scope.stationView = false;
                    $timeout(stationViewOn,500);
                }
            };
            $scope.$on('filter-phase2-end',function(event,data){
                if(data && data.observation) {
                    HelpService.lookAtMe('#toolbar-icon-visualizations',5000 /* wait 5 seconds */);
                }
            });
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