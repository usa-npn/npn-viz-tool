angular.module('npn-viz-tool',[
'templates-npnvis',
'npn-viz-tool.layers',
'npn-viz-tool.map',
'npn-viz-tool.toolbar',
'npn-viz-tool.filters',
'uiGmapgoogle-maps',
'ui.bootstrap',
'ngAnimate'
])
.config(function(uiGmapGoogleMapApiProvider) {
    uiGmapGoogleMapApiProvider.configure({
        //    key: 'your api key',
        v: '3.17',
        libraries: 'geometry'
    });
});
