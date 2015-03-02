angular.module('npn-viz-tool.settings',[
    'npn-viz-tool.filters'
])
.factory('SettingsService',[function(){
    var settings = {
        clusterMarkers: {
            name: 'cluster-markers',
            value: true
        },
        tagSpeciesTitle: {
            name: 'tag-species-title',
            value: 'common-name',
            options: [{
                value: 'common-name',
                label: 'Common Name'
            },{
                value: 'genus-species',
                label: 'Genus Species'
            }]
        },
        tagBadgeFormat: {
            name: 'tag-badge-format',
            value: 'observation-count',
            options: [{
                value: 'observation-count',
                label: 'Observation Count'
            },{
                value: 'station-count',
                label: 'Station Count'
            },{
                value: 'station-observation-count',
                label: 'Station Count/Observation Count'
            }]
        }
    };
    return {
        getSettings: function() { return settings; },
        getSetting: function(key) { return settings[key]; },
        getSettingValue: function(key) { return settings[key].value; }
    };
}])
.directive('settingsControl',['$rootScope','$document','SettingsService',function($rootScope,$document,SettingsService){
    return {
        restrict: 'E',
        templateUrl: 'js/settings/settingsControl.html',
        controller: function($scope) {
            $scope.settings = SettingsService.getSettings();
            function broadcastSettingChange(key) {
                console.log('broadcastSettingChange',$scope.settings[key]);
                $rootScope.$broadcast('setting-update-'+key,$scope.settings[key]);
            }
            function setupBroadcast(key) {
                $scope.$watch('settings.'+key+'.value',function(oldV,newV){
                    broadcastSettingChange(key);
                });
            }
            for(var key in $scope.settings) {
                setupBroadcast(key);
            }
            $document.bind('keypress',function(e){
                if(e.charCode === 99 || e.key === 'C') {
                    $scope.$apply(function(){
                        $scope.settings.clusterMarkers.value = !$scope.settings.clusterMarkers.value;
                    });
                }
            });
        }
    };
}]);