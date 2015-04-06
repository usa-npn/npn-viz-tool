angular.module('npn-viz-tool',[
'templates-npnvis',
'npn-viz-tool.map',
'uiGmapgoogle-maps',
'ui.bootstrap',
'ngAnimate'
])
.config(['uiGmapGoogleMapApiProvider','$logProvider',function(uiGmapGoogleMapApiProvider,$logProvider) {
    uiGmapGoogleMapApiProvider.configure({
        //    key: 'your api key',
        v: '3.17',
        libraries: ['geometry','drawing']
    });
    $logProvider.debugEnabled(window.location.hash && window.location.hash.match(/^#\/debug/));
}]);
