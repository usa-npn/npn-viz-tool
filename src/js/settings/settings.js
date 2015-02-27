angular.module('npn-viz-tool.settings',[
    'npn-viz-tool.filters'
])
.factory('SettingsService',[function(){
    var settings = {
        clusterMarkers: {
            name: 'cluster-markers',
            value: true
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
            $scope.$watch('settings.clusterMarkers.value',function(oldV,newV){
                broadcastSettingChange('clusterMarkers');
            });
            $scope.$watch('settings.tagBadgeFormat.value',function(oldV,newV){
                broadcastSettingChange('tagBadgeFormat');
            });
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