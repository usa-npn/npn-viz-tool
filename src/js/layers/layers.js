angular.module('npn-viz-tool.layers',[
'npn-viz-tool.filter',
'ngResource'
])
.factory('LayerService',['$rootScope','$http','$q','$log','uiGmapIsReady',function($rootScope,$http,$q,$log,uiGmapIsReady){
    var layers = null,
        map = null,
        readyPromise = uiGmapIsReady.promise(1).then(function(instances){
            map = instances[0].map;
            $log.debug('LayerService - map is ready');
            return $http.get('layers/layers.json').success(function(data) {
                layers = {};
                data.forEach(function(layer,idx){
                    layer.index = idx;
                    layers[layer.id] = layer;
                });
                $log.debug('LayerService - layer list is loaded', layers);
            });
        }),
        baseStyle = {
            strokeColor: '#ffffff',
            strokeOpacity: null,
            strokeWeight: 1,
            fillColor: '#c0c5b8',
            fillOpacity: null,
            zIndex: 0
        };
    function calculateCenter(feature) {
        if(!feature.properties.CENTER) {
            // [0], per GeoJson spec first array in Polygon coordinates is
            // external ring, other indices are internal rings or "holes"
            var geo = feature.geometry,
                coordinates = geo.type === 'Polygon' ?
                    geo.coordinates[0] :
                    geo.coordinates.reduce(function(p,c){
                        return p.concat(c[0]);
                    },[]),
                i,coord,
                mxLat,mnLat,mxLon,mnLon;
            for(i = 0; i < coordinates.length; i++) {
                coord = coordinates[i];
                if(i === 0) {
                    mxLon = mnLon = coord[0];
                    mxLat = mnLat = coord[1];
                } else {
                    mxLon = Math.max(mxLon,coord[0]);
                    mnLon = Math.min(mnLon,coord[0]);
                    mxLat = Math.max(mxLat,coord[1]);
                    mnLat = Math.min(mnLat,coord[1]);
                }
            }
            feature.properties.CENTER = {
                latitude: (mnLat+((mxLat-mnLat)/2)),
                longitude: (mnLon+((mxLon-mnLon)/2))
            };
        }
    }
    function loadLayerData(layer) {
        var def = $q.defer();
        if(layer.data) {
            def.resolve(layer);
        } else {
            $rootScope.$broadcast('layer-load-start',{});
            $http.get('layers/'+layer.file).success(function(data){
                if(data.type === 'GeometryCollection') {
                    $log.debug('Translating GeometryCollection to FeatureCollection');
                    // translate to FeatureCollection
                    data.features = [];
                    angular.forEach(data.geometries,function(geo,idx){
                        data.features.push({
                            type: 'Feature',
                            properties: { NAME: ''+idx },
                            geometry: geo
                        });
                    });
                    data.type = 'FeatureCollection';
                    delete data.geometries;
                } else {
                    data.features.forEach(function(f,i){
                        if(!f.properties) {
                            f.properties = {};
                        }
                        if(!f.properties.NAME) {
                            f.properties.NAME = ''+i;
                        }
                    });
                }
                // calculate centers
                data.features.forEach(calculateCenter);
                layer.data = data;
                def.resolve(layer);
                $rootScope.$broadcast('layer-load-end',{});
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
                        label: l.label,
                        source: l.source,
                        img: l.img,
                        link: l.link
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
                    $log.debug('no such layer with id',id);
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
                    $log.debug('no such layer with id',id);
                    return def.reject(id);
                }
                var unloaded = unloadLayer(layer);
                def.resolve(unloaded);
            });
            return def.promise;
        }
    };
}])
.directive('layerControl',['$rootScope','$q','$location','$log','LayerService','FilterService','GeoFilterArg',function($rootScope,$q,$location,$log,LayerService,FilterService,GeoFilterArg){
    return {
        restrict: 'E',
        templateUrl: 'js/layers/layerControl.html',
        controller: function($scope) {
            var eventListeners = [],
                lastFeature;

            function reset() {
                $scope.layerOnMap = {
                    layer: 'none'
                };
            }
            reset();
            $scope.$on('filter-reset',reset);

            LayerService.getAvailableLayers().then(function(layers){
                function broadcastLayersReady() {
                    $rootScope.$broadcast('layers-ready',{});
                }
                $log.debug('av.layers',layers);
                $scope.layers = layers;
                var qargs = $location.search();
                if(qargs['g']) {
                    $log.debug('init layers from query arg',qargs['g']);
                    // only one layer at a time is supported so the "first" id is sufficient.
                    var featureList = qargs['g'].split(';'),
                        featureIds = featureList.map(function(f) {
                            return f.substring(f.indexOf(':')+1);
                        }),
                        layerId = featureList[0].substring(0,featureList[0].indexOf(':')),
                        lyr,i;
                    for(i = 0; i < layers.length; i++) {
                        if(layers[i].id === layerId) {
                            lyr = layers[i];
                            break;
                        }
                    }
                    if(lyr) {
                        loadLayer(lyr).then(function(results) {
                            var map = results[0],
                                features = results[1];
                            $scope.layerOnMap.skipLoad = true;
                            $scope.layerOnMap.layer = lyr; // only update this -after- the fact
                            features.forEach(function(f) {
                                if(featureIds.indexOf(f.getProperty('NAME')) != -1) {
                                    clickFeature(f,map);
                                }
                            });
                            broadcastLayersReady();
                        });
                    }
                } else {
                    broadcastLayersReady();
                }
            });

            function clickFeature(feature,map) {
                // TODO "NAME" may or may not be suitable, probably should use id...
                var name = feature.getProperty('NAME'),
                    filterArg = feature.getProperty('$FILTER');
                lastFeature = feature;
                if(!filterArg) {
                    filterArg = new GeoFilterArg(feature,$scope.layerOnMap.layer.id);
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
                    // TODO - maybe instead the filter should just broadcast the "end" event
                    if(FilterService.getFilter().hasSufficientCriteria()) {
                        $rootScope.$broadcast('filter-rerun-phase2',{});
                    }
                });
            }


            $scope.$watch('layerOnMap.layer',function(newLayer,oldLayer){
                if($scope.layerOnMap.skipLoad) {
                    $scope.layerOnMap.skipLoad = false;
                    return;
                }
                if(oldLayer && oldLayer != 'none') {
                    LayerService.unloadLayer(oldLayer.id).then(function(unloaded){
                        var geoArgs = FilterService.getFilter().getGeoArgs(),
                            filterUpdate = geoArgs.length > 0;
                        geoArgs.forEach(function(filterArg){
                            FilterService.removeFromFilter(filterArg);
                        });
                        unloaded.forEach(function(feature) {
                            feature.setProperty('$FILTER',null);
                        });
                        // TODO - maybe instead the filter should just broadcast the "end" event
                        if(filterUpdate && !FilterService.isFilterEmpty()) {
                            $rootScope.$broadcast('filter-rerun-phase2',{});
                        }
                        loadLayer(newLayer);
                    });
                } else if(newLayer){
                    loadLayer(newLayer);
                }
            });

            function loadLayer(layer) {
                var def = $q.defer();
                if(layer === 'none') {
                    return def.resolve(null);
                }
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
                            if(lastFeature) {
                                var center = lastFeature.getProperty('CENTER');
                                map.panTo(new google.maps.LatLng(center.latitude,center.longitude));
                                lastFeature = null;
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
                                clickFeature(event.feature,map);
                            });

                        }));
                    }
                    def.resolve(results);
                });
                return def.promise;
            }
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