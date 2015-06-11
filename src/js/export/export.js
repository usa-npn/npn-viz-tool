angular.module('npn-viz-tool.export',[
    'npn-viz-tool.filter'
])
.directive('exportControl',['$log','$http','$window','FilterService',function($log,$http,$window,FilterService){
    return {
        restrict: 'E',
        template: '<a title="Export" href id="export-control" class="btn btn-default btn-xs" ng-disabled="!getFilteredMarkers().length" ng-click="exportData()"><i class="fa fa-download"></i></a>',
        controller: ['$scope',function($scope){
            $scope.getFilteredMarkers = FilterService.getFilteredMarkers;
            $scope.exportData = function() {
                var filter = FilterService.getFilter();
                var params = {
                    date: filter.getDateArg().toExportParam()
                };
                if(filter.getSpeciesArgs().length) {
                    params.species = [];
                    filter.getSpeciesArgs().forEach(function(s){
                        params.species.push(s.toExportParam());
                    });
                }
                if(filter.getNetworkArgs().length) {
                    params.networks = [];
                    filter.getNetworkArgs().forEach(function(n){
                        params.networks.push(n.toExportParam());
                    });
                }
                if(filter.getGeographicArgs().length) {
                    params.stations = [];
                    FilterService.getFilteredMarkers().forEach(function(marker,i){
                        params.stations.push(marker.station_id);
                    });
                }
                $log.debug('export.params',params);
                $http({
                    method: 'POST',
                    url: '/ddt/observations/setSearchParams',
                    data: params
                }).success(function(){
                    $window.open('/results/visualization/data');
                });
            };
        }]
    };
}]);