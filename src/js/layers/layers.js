angular.module('npn-viz-tool.layers',[
'npn-viz-tool.filter',
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
                data.forEach(function(layer,idx){
                    layer.index = idx;
                    layers[layer.id] = layer;
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

    function unloadLayer(layer) {
        if(layer.loaded) {
            var unloaded = [];
            for(var i = 0; i < layer.loaded.length; i++) {
                layer.loaded[i].removeProperty('$style');
                map.data.remove(layer.loaded[i]);
                unloaded.push(layer.loaded[i]);
            }
            delete layer.loaded;
            return unloaded;
        }
    }

    return {
        /**
         * @return {Array} A copy of the list of layers as a flat array.
         */
        getAvailableLayers: function() {
            var def = $q.defer();
            readyPromise.then(function(){
                var key,l,arr = [];
                for(key in layers) {
                    l = layers[key];
                    arr.push({
                        id: l.id,
                        index: l.index,
                        label: l.label
                    });
                }
                def.resolve(arr.sort(function(a,b){
                    return a.idx - b.idx;
                }));
            });
            return def.promise;
        },
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
                for(var id in layers) {
                    unloadLayer(layers[id]);
                }
                def.resolve();
            });
            return def.promise;
        },
        /**
         * Loads and adds a layer to the map.
         *
         * @param  {string} id The id of the layer to add.
         * @param  {object|function} style (optional) If an object is a set of style overrides to apply to all added features
         *                           (https://developers.google.com/maps/documentation/javascript/datalayer#style_options).
         *                           If a function is provided then its signature it will be called when styling features so
         *                           that all features can be individually styled as in
         *                           https://developers.google.com/maps/documentation/javascript/datalayer#declarative_style_rules.
         *                           This parameter will be stored and re-used so it can be re-applied during calls to restyleLayers.
         *                           Keep this in mind if you pass a function and your code may go out of scope.
         * @return {promise}       A promise that will be resolved when the layer has been added and its features styled.
         */
        loadLayer: function(id,style) {
            var def = $q.defer();
            readyPromise.then(function(){
                var layer = layers[id];
                if(!layer) {
                    console.log('no such layer with id',id);
                    return def.reject(id);
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
        },
        unloadLayer: function(id) {
            var def = $q.defer();
            readyPromise.then(function(){
                var layer = layers[id];
                if(!layer) {
                    console.log('no such layer with id',id);
                    return def.reject(id);
                }
                var unloaded = unloadLayer(layer);
                def.resolve(unloaded);
            });
            return def.promise;
        }
    };
}])
.directive('layerControl',['$rootScope','LayerService','FilterService',function($rootScope,LayerService,FilterService){
    function geoContains(point,geo) {
        //console.debug("geoContains",geo);
        var polyType = geo.getType(),
            poly,arr,i;
        //console.debug("geoContains.type",polyType);
        if(polyType == 'Polygon') {
            poly = new google.maps.Polygon({paths: geo.getArray()[0].getArray()});
            return google.maps.geometry.poly.containsLocation(point,poly) ||
                   google.maps.geometry.poly.isLocationOnEdge(point,poly);
        } else if (polyType === 'MultiPolygon' || polyType == 'GeometryCollection') {
            arr = geo.getArray();
            for(i = 0; i < arr.length; i++) {
                if(geoContains(point,arr[i])) {
                    return true;
                }
            }
        }
        return false;
    }
    return {
        restrict: 'E',
        templateUrl: 'js/layers/layerControl.html',
        controller: function($scope) {
            var eventListeners = [],
                lastClick;

            LayerService.getAvailableLayers().then(function(layers){
                console.log('av.layers',layers);
                $scope.layers = layers;
            });
            $scope.toggle = function(layer) {
                if(layer.$onMap) {
                    LayerService.loadLayer(layer.id,function(feature) {
                        var style = {
                                strokeOpacity: 1,
                                strokeColor: '#ffffff',
                                strokeWeight: 1,
                                fillOpacity: 0
                            };
                        if(feature.getProperty('$FILTER')) {
                            style.fillColor = '#800000';
                            style.fillOpacity = 0.5;
                        }
                        return style;
                    })
                    .then(function(results){
                        if(!eventListeners.length) {
                            var map = results[0];
                            // this feels kind of like a workaround since the markers aren't
                            // refreshed until the map moves so forcibly moving the map
                            $scope.$on('filter-phase2-end',function(event,data) {
                                if(lastClick) {
                                    map.panTo(lastClick.latLng);
                                    lastClick = null;
                                }
                            });
                            eventListeners.push(map.data.addListener('mouseover',function(event){
                                map.data.overrideStyle(event.feature, {strokeWeight: 3});
                            }));
                            eventListeners.push(map.data.addListener('mouseout',function(event){
                                map.data.revertStyle();
                            }));
                            eventListeners.push(map.data.addListener('click',function(event){
                                $scope.$apply(function(){
                                    lastClick = event;
                                    // TODO "NAME" may or may not be suitable, probably should use id...
                                    var feature = event.feature,
                                        name = feature.getProperty('NAME'),
                                        filterArg = feature.getProperty('$FILTER');
                                    console.log('name',name,filterArg);
                                    if(!filterArg) {
                                        filterArg = {
                                            geoKey: name,
                                            feature: feature,
                                            $geoFilter: function(marker) {
                                                return geoContains(
                                                    new google.maps.LatLng(parseFloat(marker.latitude), parseFloat(marker.longitude)),
                                                    filterArg.feature.getGeometry());
                                            }
                                        };
                                        FilterService.addToFilter(filterArg);
                                        // TODO - different layers will probably have different styles, duplicating hard coded color...
                                        // over-ride so the change shows up immediately and will be applied on the restyle (o/w there's a pause)
                                        map.data.overrideStyle(feature, {fillColor: '#800000'});
                                    } else {
                                        FilterService.removeFromFilter(filterArg);
                                        filterArg = null;
                                    }
                                    feature.setProperty('$FILTER',filterArg);
                                    LayerService.restyleLayers().then(function(){
                                        $rootScope.$broadcast('filter-rerun-phase2',{});
                                    });
                                });

                            }));
                        }
                    });
                } else {
                    LayerService.unloadLayer(layer.id).then(function(unloaded){
                        var filterUpdate = false;
                        unloaded.forEach(function(feature) {
                            var filterArg = feature.getProperty('$FILTER');
                            if(filterArg) {
                                filterUpdate = true;
                                FilterService.removeFromFilter(filterArg);
                                feature.setProperty('$FILTER',null);
                            }
                        });
                        if(filterUpdate) {
                            $rootScope.$broadcast('filter-rerun-phase2',{});
                        }
                    });
                }
            };
            // shouldn't happen
            $scope.$on('$destroy',function(){
                LayerService.resetLayers();
                eventListeners.forEach(function(el){
                    el.remove();
                });
            });
        }
    };
}]);