angular.module('npn-viz-tool',[
'templates-npnvis',
'npn-viz-tool.map',
'uiGmapgoogle-maps',
'ui.bootstrap',
'angular-google-analytics',
'ngAnimate'
])
.config(['uiGmapGoogleMapApiProvider','$logProvider','AnalyticsProvider',function(uiGmapGoogleMapApiProvider,$logProvider,AnalyticsProvider) {
    uiGmapGoogleMapApiProvider.configure({
        key: 'AIzaSyAsTM8XaktfkwpjEeDMXkNrojaiB2W5WyE',
        v: '3.27',
        libraries: ['geometry','drawing']
    });
    var debug = window.location.hash && window.location.hash.match(/^#.*#debug/);
    $logProvider.debugEnabled(debug);
    window.onbeforeunload = function() {
        return 'You are about to navigate away from the USA-NPN Visualization Tool.  Are you sure you want to do this?';
    };

    AnalyticsProvider.setAccount('UA-30327499-1');
    if(debug) { // odd but feels wrong to call 'enterDebugMode' unless entering debug mode...
        AnalyticsProvider.enterDebugMode(true);
    }
}]);
