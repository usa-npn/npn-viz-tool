/*
 * Regs-Dot-Gov-Directives
 * Version: 0.1.0 - 2015-02-17
 */

angular.module('npn-viz-tool.filters',[
])
.filter('trim',function(){
    return function(input) {
        if(angular.isString(input)) {
            return input.trim();
        }
        return input;
    };
})
.filter('faFileIcon',function(){
    var map = {
        pdf: 'fa-file-pdf-o'
    };
    return function(input) {
        if(input && !map[input]) {
            console.debug('no explicit file type icon for '+input);
        }
        return map[input]||'fa-file-o';
    };
})
.filter('ellipses',function(){
    return function(input) {
        var maxLen = arguments.length == 2 ? arguments[1] : 55;
        if(typeof(input) == 'string' && input.length > maxLen) {
            return input.substring(0,maxLen)+' ...';
        }
        return input;
    };
});
angular.module('npn-viz-tool',[
'templates-npnvis',
'npn-viz-tool.services',
'npn-viz-tool.map',
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

angular.module('npn-viz-tool.map',[
])
.directive('npnVizMap',['uiGmapGoogleMapApi','uiGmapIsReady',function(uiGmapGoogleMapApi,uiGmapIsReady){
    return {
        restrict: 'E',
        templateUrl: 'js/map/map.html',
        scope: {
        },
        controller: ['$scope',function($scope) {
            uiGmapGoogleMapApi.then(function(maps) {
                console.log('maps',maps);
                $scope.map = {
                    center: { latitude: 38.8402805, longitude: -97.61142369999999 },
                    zoom: 4,
                    options: {
                        streetViewControl: false,
                        panControl: false,
                        zoomControl: true,
                        zoomControlOptions: {
                            style: maps.ZoomControlStyle.SMALL,
                            position: maps.ControlPosition.RIGHT_TOP
                        }
                    }
                };
            });
        }]
    };
}])
.directive('npnVizLayers',['uiGmapIsReady','$http',function(uiGmapIsReady,$http){
    return {
        restrict: 'E',
        template: '',
        scope: {
        },
        controller: ['$scope',function($scope) {
            uiGmapIsReady.promise(1).then(function(instances) {
                var map = instances[0].map;
                $http.get('layers/us-states.geojson').success(function(geojson){
                    console.debug(geojson);
                    map.data.addGeoJson(geojson);
                    var featureMap = {};
                    map.data.setStyle(function(feature){
                        featureMap[feature.getProperty('NAME')] = feature;
                        console.log(feature.getProperty('NAME'),feature);
                        var style = {
                            strokeOpacity: 0,
                            fillOpacity: 0
                        };
                        return style;
                    });
                    $scope.featureMap = featureMap;
                });
                $http.get('/npn_portal/stations/getStationCountByState.json').success(function(counts){
                    //console.debug('counts',counts);
                    var countMap = {$max: 0};
                    counts.forEach(function(c){
                        c.number_stations = parseInt(c.number_stations);
                        if(countMap.$min === undefined || c.number_stations < countMap.$min) {
                            countMap.$min = c.number_stations;
                        }
                        if(c.number_stations > countMap.$max) {
                            countMap.$max = c.number_stations;
                        }
                        countMap[c.state] = c;
                    });
                    $scope.countMap = countMap;
                });
                function chorpleth() {
                    if($scope.featureMap && $scope.countMap) {
                        console.log('$countMap',$scope.countMap);
                        var colorScale = d3.scale.linear().domain([$scope.countMap.$min,$scope.countMap.$max]).range(['#F7FBFF','#08306B']);
                        map.data.setStyle(function(feature){
                            var name = feature.getProperty('NAME'),
                                count = $scope.countMap[name],
                                style = {
                                    strokeOpacity: 1,
                                    strokeColor: '#ffffff',
                                    strokeWeight: 1,
                                    fillOpacity: 0
                                };
                            if(count) {
                                //count.$styled = true;
                                style.fillOpacity = 0.8;
                                style.fillColor = colorScale(count.number_stations);
                                //console.log(name+' count='+count.number_stations+',color='+style.fillColor);
                            } else {
                                console.warn('no count for '+name);
                            }
                            return style;
                        });
                        /*
                        for(var key in $scope.countMap) {
                            if(!$scope.countMap[key].$styled) {
                                console.log('count for ' + key + ' was not styled.');
                            }
                        }*/
                    }
                }
                $scope.$watch('countMap',chorpleth);
                $scope.$watch('featureMap',chorpleth);
            });
        }]
    };
}]);
angular.module('templates-npnvis', ['js/map/map.html']);

angular.module("js/map/map.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/map/map.html",
    "<ui-gmap-google-map ng-if=\"map\" center='map.center' zoom='map.zoom' options=\"map.options\">\n" +
    "\n" +
    "</ui-gmap-google-map>\n" +
    "\n" +
    "<npn-viz-layers></npn-viz-layers>");
}]);


angular.module('npn-viz-tool.services',[
'ngResource'
]);
/*
.factory('Docket', ['$resource',
    function($resource){
        var Docket = $resource(rdg_svcs.getScriptLocation()+'/regulations/v3/docket.json?docketId=:id', {}, {
            get: {
                method: 'GET',
                transformResponse: function(data, header) {
                    return rdg_svcs.transformResponse(data,header,Docket);
                }
            }
        });
        return Docket;
}])
.factory('Document', ['$resource',
    function($resource){
        var scriptLoc = rdg_svcs.getScriptLocation(),
            Document = $resource(scriptLoc+'/regulations/v3/document.json?documentId=:id', {}, {
            get: {
                method: 'GET',
                transformResponse: function(data, header) {
                    var wrapped = rdg_svcs.transformResponse(data,header,Document), a;
                    wrapped.$attachments = [];
                    angular.forEach(wrapped.attachments,function(attch){
                        if((a = getSingleAttachment(attch))) {
                            wrapped.$attachments.push(a);
                        }
                    });
                    return wrapped;
                }
            }
        });
        function getQueryArgs(url) {
            var q = url.indexOf('?'),
                qargs = q > 0 ? url.substring(q+1) : null;
            if(qargs) {
                qargs = qargs.split('&').reduce(function(args,arg){
                    var parts = arg.split('='), a = {};
                    args[parts[0]] = parts[1];
                    return args;
                },[]);
                return qargs;
            }
        }
        function getSingleAttachment(attachment) {
            var attachments = [],i;
            angular.forEach(attachment.fileFormats,function(fmt){
                var proxy = fmt.replace(/^http[s]*\:\/\/api\.data\.gov/,scriptLoc);
                attachments.push({
                    title: attachment.title,
                    url: proxy,
                    args: getQueryArgs(proxy)
                });
            });
            if(attachments.length > 1) {
                // look for a pdf attachment and prefer it.
                for(i = 0; i < attachments.length; i++) {
                    if(attachments[i].args && attachments[i].args.contentType === 'pdf') {
                        return attachments[i];
                    }
                }
            }
            return attachments.length ? attachments[0] : null;
        }
        return Document;
}])
.factory('Documents', ['$resource',
    function($resource){
        var Documents = $resource(rdg_svcs.getScriptLocation()+'/regulations/v3/documents.json', {}, {
            query: {method:'GET',
                transformResponse: function(data, header) {
                    return rdg_svcs.transformResponse(data,header,Documents,'documents',function(d){
                        d.$postedDate = new Date(d.postedDate);
                        return d;
                    });
                }
            }
        });
        return Documents;
}]);
*/