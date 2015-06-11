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
                value: 'scientific-name',
                q: 'sn',
                label: 'Scientific Name'
            }]
        },
        tagBadgeFormat: {
            name: 'tag-badge-format',
            q: 'tbf',
            value: 'observation-count',
            options: [{
                value: 'observation-count',
                q: 'oc',
                label: 'Record Count'
            },{
                value: 'station-count',
                q: 'sc',
                label: 'Station Count'
            }/*,{
                value: 'station-observation-count',
                q: 'soc',
                label: 'Station Count/Record Count'
            }*/]
        },
        filterLqdSummary: {
            name: 'filter-lqd-summary',
            q: 'flqdf',
            value: true
        }
    };
    return {
        getSettings: function() { return settings; },
        getSetting: function(key) { return settings[key]; },
        getSettingValue: function(key) { return settings[key].value; },
        // @return the label of the currently selected value for a setting with options (or undefined).
        getSettingValueLabel: function(key) {
            var s = settings[key],
                v = s.value,i;
            for(i = 0; s.options && i < s.options.length; i++) {
                if(s.options[i].value === v) {
                    return s.options[i].label;
                }
            }
        },
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
.directive('settingsControl',['$rootScope','$location','$log','SettingsService',function($rootScope,$location,$log,SettingsService){
    return {
        restrict: 'E',
        templateUrl: 'js/settings/settingsControl.html',
        controller: function($scope) {
            SettingsService.populateFromSharingUrlArgs($location.search()['ss']);
            $scope.settings = SettingsService.getSettings();
            function broadcastSettingChange(key) {
                $log.debug('broadcastSettingChange',$scope.settings[key]);
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
        }
    };
}]);