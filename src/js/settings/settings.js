angular.module('npn-viz-tool.settings',[
    'npn-viz-tool.filters'
])
.factory('SettingsService',[function(){
    var settings = {
        clusterMarkers: {
            name: 'cluster-markers',
            q: 'cm',
            value: true
        },
        tagSpeciesTitle: {
            name: 'tag-species-title',
            q: 'tst',
            value: 'common-name',
            options: [{
                value: 'common-name',
                q: 'cn',
                label: 'Common Name'
            },{
                value: 'genus-species',
                q: 'gs',
                label: 'Genus Species'
            }]
        },
        tagBadgeFormat: {
            name: 'tag-badge-format',
            q: 'tbf',
            value: 'observation-count',
            options: [{
                value: 'observation-count',
                q: 'oc',
                label: 'Observation Count'
            },{
                value: 'station-count',
                q: 'sc',
                label: 'Station Count'
            },{
                value: 'station-observation-count',
                q: 'soc',
                label: 'Station Count/Observation Count'
            }]
        }
    };
    return {
        getSettings: function() { return settings; },
        getSetting: function(key) { return settings[key]; },
        getSettingValue: function(key) { return settings[key].value; },
        getSharingUrlArgs: function() {
            var arg = '',key,s,i;
            for(key in settings) {
                s = settings[key];
                arg+=(arg !== '' ? ';':'')+s.q+'=';
                if(!s.options) {
                    arg+=s.value;
                } else {
                    for(i = 0; i < s.options.length; i++) {
                        if(s.value === s.options[i].value) {
                            arg += s.options[i].q;
                            break;
                        }
                    }
                }
            }
            return 'ss='+encodeURIComponent(arg);
        },
        populateFromSharingUrlArgs: function(ss) {
            if(ss) {
                ss.split(';').forEach(function(st){
                    var pts = st.split('='),
                        q = pts[0], v = pts[1],key,i;
                    for(key in settings) {
                        if(settings[key].q === q) {
                            if(settings[key].options) {
                                for(i = 0; i < settings[key].options.length; i++) {
                                    if(settings[key].options[i].q === v) {
                                        settings[key].value = settings[key].options[i].value;
                                        break;
                                    }
                                }
                            } else {
                                settings[key].value = (v === 'true' || v === 'false') ? (v === 'true') : v;
                            }
                            break;
                        }
                    }
                });
            }
        }
    };
}])
.directive('settingsControl',['$rootScope','$document','$location','SettingsService',function($rootScope,$document,$location,SettingsService){
    return {
        restrict: 'E',
        templateUrl: 'js/settings/settingsControl.html',
        controller: function($scope) {
            SettingsService.populateFromSharingUrlArgs($location.search()['ss']);
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