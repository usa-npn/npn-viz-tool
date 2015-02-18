
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
        restyleLayers: function() {
            var def = $q.defer();
            readyPromise.then(function(){
                restyleSync();
                def.resolve();
            });
            return def.promise;
        },
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
                    restyleSync();
                    def.resolve([map,layer.loaded]);
                });
            });
            return def.promise;
        }
    };
}]);