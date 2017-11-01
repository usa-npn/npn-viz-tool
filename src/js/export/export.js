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
                var params = filter.getDateArg().toExportParam();
                params.downloadType = 'selectable';
                params.searchSource = 'visualization-tool';
                params.endDate = params.endYear + '-12-31';
                if(filter.getSpeciesArgs().length) {
                    params.species = [];
                    filter.getSpeciesArgs().forEach(function(s){
                        params.species.push(s.getId());
                    });
                }
                if(filter.getNetworkArgs().length) {
                    params.partnerGroups = [];
                    filter.getNetworkArgs().forEach(function(n){
                        params.partnerGroups.push(n.getId());
                    });
                }
                if(filter.getGeographicArgs().length) {
                    params.stations = [];
                    FilterService.getFilteredMarkers().forEach(function(marker,i){
                        params.stations.push(marker.station_id);
                    });
                }
                $log.debug('export.params',params);
                var serverUrl = '';
                var popServerUrl = '';
                if(location.hostname.includes('local')) {
                    serverUrl = 'https://data-dev.usanpn.org';
                    popServerUrl = 'https://data-dev.usanpn.org';
                }
                else if(location.hostname.includes('dev')) {
                    serverUrl = 'https://data-dev.usanpn.org';
                    popServerUrl = 'https://data-dev.usanpn.org';
                }
                else {
                    serverUrl = 'https://data.usanpn.org';
                    popServerUrl = 'https://data.usanpn.org';
                }
                $http({
                    method: 'POST',
                    url: popServerUrl + ':3002/pop/search',
                    data: {'searchJson': params}
                }).then(function(result){
                    if(location.hostname.includes('local')) {
                        $window.open(serverUrl + ':8080?search='+result.data.saved_search_hash);
                    }
                    else {
                        console.log(serverUrl + '/observations?search='+result.data.saved_search_hash);
                        $window.open(serverUrl + '/observations?search='+result.data.saved_search_hash);
                    }
                });
            };
        }]
    };
}]);
