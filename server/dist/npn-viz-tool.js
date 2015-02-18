/*
 * Regs-Dot-Gov-Directives
 * Version: 0.1.0 - 2015-02-18
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
.directive('npnVizLayers',['uiGmapIsReady','$http','LayerService',function(uiGmapIsReady,$http,LayerService){
    return {
        restrict: 'E',
        template: '',
        scope: {
        },
        controller: ['$scope',function($scope) {
            LayerService.resetLayers().then(function(){
                LayerService.loadLayer('US States',{strokeOpacity: 0, fillOpacity: 0}).then(function(results){
                    $scope.map = results[0];
                    $scope.featureMap = results[1].reduce(function(map,f){
                        map[f.getProperty('NAME')] = f;
                        return map;
                    },{});
                    /*
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
                    */
                });
            });
            $http.get('/npn_portal/stations/getStationCountByState.json').success(function(counts){
                $scope.countMap = counts.reduce(function(map,c){
                    map[c.state] = c;
                    c.number_stations = parseInt(c.number_stations);
                    map.$min = Math.min(map.$min,c.number_stations);
                    map.$max = Math.max(map.$max,c.number_stations);
                    return map;
                },{$max: 0,$min: 0});
            });
            function chorpleth() {
                if($scope.featureMap && $scope.countMap) {
                    console.log('$countMap',$scope.countMap);
                    var map = $scope.map,
                        colorScale = d3.scale.linear().domain([$scope.countMap.$min,$scope.countMap.$max]).range(['#F7FBFF','#08306B']);
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
                            style.clickable = true;
                            //console.log(name+' count='+count.number_stations+',color='+style.fillColor);
                        } else {
                            console.warn('no count for '+name);
                        }
                        return style;
                    });
                    map.data.addListener('mouseover',function(event){
                        console.log('feature',event.feature);
                        console.log('state',event.feature.getProperty('NAME'));
                        map.data.overrideStyle(event.feature, {strokeWeight: 2});
                    });
                    map.data.addListener('mouseout',function(event){
                        map.data.revertStyle();
                    });
                    LayerService.loadLayer('hij');
                }
            }
            $scope.$watch('countMap',chorpleth);
            $scope.$watch('featureMap',chorpleth);
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
])
.factory('LayerService',['$http','$q','uiGmapIsReady',function($http,$q,uiGmapIsReady){
    var layers = null,
        map = null,
        readyPromise = uiGmapIsReady.promise(1).then(function(instances){
            map = instances[0].map;
            console.log('LayerService - map is ready');
            return $http.get('layers/layers.json').success(function(data) {
                layers = {};
                data.forEach(function(layer){
                    layers[layer.label] = layer;
                });
                console.log('LayerService - layer list is loaded', layers);
            });
        });
    function loadLayerData(layer) {
        var def = $q.defer();
        if(layer.data) {
            def.resolve(layer);
        } else {
            $http.get('layers/'+layer.file).success(function(data){
                layer.data = data;
                def.resolve(layer);
            });
        }
        return def.promise;
    }

    return {
        resetLayers: function() {
            var def = $q.defer();
            readyPromise.then(function(){
                for(var label in layers) {
                    var layer = layers[label],i;
                    if(layer.loaded) {
                        for(i = 0; i < layer.loaded.length; i++) {
                            map.data.remove(layer.loaded[i]);
                        }
                        delete layer.loaded;
                    }
                }
                def.resolve();
            });
            return def.promise;
        },
        loadLayer: function(label,style) {
            var def = $q.defer();
            readyPromise.then(function(){
                var layer = layers[label];
                if(!layer) {
                    console.log('no such layer labeled',label);
                    return def.reject(label);
                }
                loadLayerData(layer).then(function(l){
                    layer.style = style;
                    layer.loaded = map.data.addGeoJson(layer.data);
                    layer.loaded.forEach(function(feature){
                        feature.setProperty('$style',style);
                    });
                    map.data.setStyle(function(feature){
                        var base = {
                            strokeColor: '#ffffff',
                            strokeOpacity: null,
                            strokeWeight: 1,
                            fillColor: '#c0c5b8',
                            fillOpacity: null
                        }, overrides = feature.getProperty('$style');
                        return overrides ?
                                angular.extend(base,overrides) : base;
                    });
                    def.resolve([map,layer.loaded]);
                });
            });
            return def.promise;
        }
    };
}]);