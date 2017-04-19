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
        v: '3.24',
        libraries: ['geometry','drawing']
    });
    var debug = window.location.hash && window.location.hash.match(/^#.*#debug/);
    $logProvider.debugEnabled(debug);
    window.onbeforeunload = function() {
        return 'You are about to navigate away from the USA-NPN Visualization Tool.  Are you sure you want to do this?';
    };

    // TODO insert real account #
    AnalyticsProvider.setAccount('UU-XXXXXXX-X');
    // TODO remove the true and only enter debug mode if UI is loaded
    // with the debug flag
    AnalyticsProvider.enterDebugMode(debug||true);
}]);
