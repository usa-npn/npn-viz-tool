angular.module('npn-viz-tool',[
'templates-npnvis',
'npn-viz-tool.map',
'uiGmapgoogle-maps',
'ui.bootstrap',
'ngAnimate'
])
.config(['uiGmapGoogleMapApiProvider','$logProvider',function(uiGmapGoogleMapApiProvider,$logProvider) {
    uiGmapGoogleMapApiProvider.configure({
        key: 'AIzaSyAsTM8XaktfkwpjEeDMXkNrojaiB2W5WyE',
        v: '3.20',
        libraries: ['geometry','drawing']
    });
    $logProvider.debugEnabled(window.location.hash && window.location.hash.match(/^#\/debug/));
    window.onbeforeunload = function() {
        return 'You are about to navigate away from the USA-NPN Visualization Tool.  Are you sure you want to do this?';
    };
}]);