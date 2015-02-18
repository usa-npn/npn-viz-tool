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
    'npn-viz-tool.services',
    'npn-viz-tool.stations',
    'uiGmapgoogle-maps'
])
.directive('npnVizMap',['$document','uiGmapGoogleMapApi','uiGmapIsReady',function($document,uiGmapGoogleMapApi,uiGmapIsReady){
    return {
        restrict: 'E',
        templateUrl: 'js/map/map.html',
        scope: {
        },
        controller: ['$scope',function($scope) {
            $scope.stationView = true;
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
            $document.bind('keypress',function(e){
                if(e.charCode === 114 || e.key === 'R') {
                    $scope.$apply(function(){
                        $scope.stationView = !$scope.stationView;
                    });
                }
                console.log('kp',e);
            });
        }]
    };
}]);
angular.module('templates-npnvis', ['js/map/map.html']);

angular.module("js/map/map.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/map/map.html",
    "<ui-gmap-google-map ng-if=\"map\" center='map.center' zoom='map.zoom' options=\"map.options\">\n" +
    "    <npn-stations ng-if=\"stationView\"></npn-stations>\n" +
    "</ui-gmap-google-map>\n" +
    "\n" +
    "");
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
        }),
        baseStyle = {
            strokeColor: '#ffffff',
            strokeOpacity: null,
            strokeWeight: 1,
            fillColor: '#c0c5b8',
            fillOpacity: null
        };
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
    function restyleSync() {
        map.data.setStyle(function(feature){
            var overrides = feature.getProperty('$style');
            if(overrides && typeof(overrides) === 'function') {
                return overrides(feature);
            }
            return overrides ?
                    angular.extend(baseStyle,overrides) : baseStyle;
        });
    }

    return {
        /**
         * Forces all features to be restyled.
         *
         * @return {promise} A promise that will be resolved once features have been restyled.
         */
        restyleLayers: function() {
            var def = $q.defer();
            readyPromise.then(function(){
                restyleSync();
                def.resolve();
            });
            return def.promise;
        },
        /**
         * Removes all map layers.
         *
         * @return {promise} A promise that will be resolved when complete.
         */
        resetLayers: function() {
            var def = $q.defer();
            readyPromise.then(function(){
                for(var label in layers) {
                    var layer = layers[label],i;
                    if(layer.loaded) {
                        for(i = 0; i < layer.loaded.length; i++) {
                            layer.loaded[i].removeProperty('$style');
                            map.data.remove(layer.loaded[i]);
                        }
                        delete layer.loaded;
                    }
                }
                def.resolve();
            });
            return def.promise;
        },
        /**
         * Loads and adds a layer to the map.
         *
         * @param  {string} label The label of the layer to add.
         * @param  {object|function} style (optional) If an object is a set of style overrides to apply to all added features
         *                           (https://developers.google.com/maps/documentation/javascript/datalayer#style_options).
         *                           If a function is provided then its signature it will be called when styling features so
         *                           that all features can be individually styled as in
         *                           https://developers.google.com/maps/documentation/javascript/datalayer#declarative_style_rules.
         *                           This parameter will be stored and re-used so it can be re-applied during calls to restyleLayers.
         *                           Keep this in mind if you pass a function and your code may go out of scope.
         * @return {promise}       A promise that will be resolved when the layer has been added and its features styled.
         */
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
                    restyleSync();
                    def.resolve([map,layer.loaded]);
                });
            });
            return def.promise;
        }
    };
}]);
angular.module('npn-viz-tool.stations',[
    'npn-viz-tool.services'
])
.directive('npnStations',['$http','LayerService',function($http,LayerService){
    return {
        restrict: 'E',
        template: '<ui-gmap-markers models="stations.markers" idKey="\'station_id\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" doCluster="true"></ui-gmap-markers>',
        scope: {
        },
        controller: ['$scope',function($scope) {
            $scope.stations = {
                states: [],
                markers: []
            };
            var eventListeners = [];
            $http.get('/npn_portal/stations/getStationCountByState.json').success(function(counts){
                var countMap = counts.reduce(function(map,c){
                    map[c.state] = c;
                    c.number_stations = parseInt(c.number_stations);
                    map.$min = Math.min(map.$min,c.number_stations);
                    map.$max = Math.max(map.$max,c.number_stations);
                    return map;
                },{$max: 0,$min: 0}),
                colorScale = d3.scale.linear().domain([countMap.$min,countMap.$max]).range(['#F7FBFF','#08306B']);

                LayerService.resetLayers().then(function(){
                    LayerService.loadLayer('US States',function(feature) {
                        var name = feature.getProperty('NAME'),
                            loaded = $scope.stations.states.indexOf(name) != -1,
                            count = countMap[name],
                            style = {
                                strokeOpacity: 1,
                                strokeColor: '#ffffff',
                                strokeWeight: 1,
                                fillOpacity: 0
                            };
                        if(count && !loaded ) {
                            count.visited = true;
                            style.fillOpacity = 0.8;
                            style.fillColor = colorScale(count.number_stations);
                            style.clickable = true;
                        } else if (!loaded) {
                            console.warn('no station count for '+name);
                        }
                        return style;
                    }).then(function(results){
                        var map = results[0];
                        eventListeners.push(map.data.addListener('mouseover',function(event){
                            map.data.overrideStyle(event.feature, {strokeWeight: 3});
                        }));
                        eventListeners.push(map.data.addListener('mouseout',function(event){
                            map.data.revertStyle();
                        }));
                        eventListeners.push(map.data.addListener('click',function(event){
                            var state = event.feature.getProperty('NAME');
                            if($scope.stations.states.indexOf(state) === -1) {
                                $scope.stations.states.push(state);
                                map.panTo(event.latLng);
                                map.setZoom(6);
                                $http.get('/npn_portal/stations/getAllStations.json',
                                            {params:{state_code:state}})
                                    .success(function(data){
                                        data.forEach(function(d){
                                            d.markerOpts = {
                                                title: d.station_name
                                            };
                                        });
                                        $scope.stations.markers = $scope.stations.markers.concat(data);
                                        // simply drop the feature as opposed to re-styling it
                                        map.data.remove(event.feature);
                                    });
                            }
                        }));
                        /* can't explain why can't read c.visited here since
                         * the other two log statements show the attribute as being there
                         * but when iterating it's not there, even in a loop...
                        var unvisited = counts.filter(function(c){
                            return !c.visited;
                        });
                        console.log('counts',counts);
                        console.log('countMap',countMap);
                        console.log('unvisited',unvisited);
                        */
                    });
                });
            });
            // may or may not be a good idea considering if other elements replace
            // map layers
            $scope.$on('$destroy',function(){
                LayerService.resetLayers();
                eventListeners.forEach(function(el){
                    el.remove();
                });
            });
        }]
    };
}]);