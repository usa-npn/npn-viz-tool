angular.module('npn-viz-tool.vis-map',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.settings',
    'ui.bootstrap'
])
.service('WmsService',['$log','$q','$http','$httpParamSerializer','$filter',function($log,$q,$http,$httpParamSerializer,$filter){
    var WMS_BASE_URL = 'http://geoserver.usanpn.org/geoserver/ows',
        // not safe to change since the capabilities document format changes based on version
        // so a version change -may- require code changes wrt interpreting the document
        WMS_VERSION = '1.1.1',
        WMS_CAPABILITIES_URL = WMS_BASE_URL+'?service=wms&version='+WMS_VERSION+'&request=GetCapabilities',
        wms_layer_defs,
        service = {
            getLayers: function(map) {
                function defToLayer(def) {
                    return new WmsMapLayer(map,def);
                }
                var def = $q.defer();
                if(wms_layer_defs) {
                    def.resolve(wms_layer_defs.map(defToLayer));
                } else {
                    $http.get(WMS_CAPABILITIES_URL).then(function(response){
                        var wms_capabilities = $($.parseXML(response.data));
                        wms_layer_defs = getLayers(wms_capabilities.find('Layer'));
                        $log.debug('wms_layer_defs',wms_layer_defs);
                        def.resolve(wms_layer_defs.map(defToLayer));
                    },function() {
                        def.reject(); // TODO, what if WMS is down, need to tell user??
                    });
                }
                return def.promise;
            }
        };

    function WmsMapLayer(map,layer_def) {
        var wmsArgs = {
            service: 'WMS',
            request: 'GetMap',
            version: WMS_VERSION,
            layers: layer_def.name,
            styles: '',
            format: 'image/png',
            //format: 'image/svg+xml',
            transparent: true,
            height: 256,
            width: 256,
            //srs: 'EPSG:4326'
            srs: 'EPSG:3857'
        },
        googleLayer = new google.maps.ImageMapType({
            getTileUrl: function (coord, zoom) {
                var proj = map.getProjection(),
                    zfactor = Math.pow(2, zoom),
                    top = proj.fromPointToLatLng(new google.maps.Point(coord.x * 256.0 / zfactor, coord.y * 256.0 / zfactor)),
                    bot = proj.fromPointToLatLng(new google.maps.Point((coord.x + 1) * 256.0 / zfactor, (coord.y + 1) * 256.0 / zfactor)),
                    ctop = srsConversion(top),
                    cbot = srsConversion(bot),
                    base = {};
                if(l.extent && l.extent.current) {
                    l.extent.current.addToWmsParams(base);
                }
                return WMS_BASE_URL+'?'+$httpParamSerializer(angular.extend(base,wmsArgs,{bbox: [ctop.lng,cbot.lat,cbot.lng,ctop.lat].join(',')}));
            },
            tileSize: new google.maps.Size(256, 256),
            isPng: true,
            name: (layer_def.title||layer_def.name)
        }),
        l = angular.extend({},layer_def,{
            getBounds: function() {
                if(layer_def.bbox) {
                    return layer_def.bbox.getBounds();
                }
            },
            fit: function() {
                var bounds = l.getBounds();
                if(bounds) {
                    map.fitBounds(bounds);
                }
                return l;
            },
            on: function() {
                map.overlayMapTypes.push(googleLayer);
                return l;
            },
            off: function() {
                if(map.overlayMapTypes.length) {
                    map.overlayMapTypes.pop();
                }
                return l;
            }
        });
        return l;
        // this code converts coordinates from ESPG:4326 to ESPG:3857, it originated @
        // http://gis.stackexchange.com/questions/52188/google-maps-wms-layer-with-3857
        // that author stated it came from StackOverflow which I tried to find to attribute properly but could not.
        // the issue here is that if requests are sent to the map service with ESPG:4326 coordinates everything
        // appears accurate when tightly zoomed however as you zoom out beyond a certain point the layers begin to
        // migrate north, the farther zoomed out the more drastic the migration (e.g. from Mexico into N. Canada)
        // while dealing in traditional lat/lng for google maps they are actually projected in 3857 (metres, not meters).
        // the main thing is that 4326 coordinates are projected onto a sphere/ellipsoid while 3857 are translated to
        // a flat surface.
        // unfortunately while google maps projection must be performing such transformations it doesn't expose this ability.
        function srsConversion(latLng) {
            if ((Math.abs(latLng.lng()) > 180 || Math.abs(latLng.lat()) > 90)) {
                return;
            }

            var num = latLng.lng() * 0.017453292519943295;
            var x = 6378137.0 * num;
            var a = latLng.lat() * 0.017453292519943295;

            return {lng: x, lat: 3189068.5 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)))};
        }
    }
    function getLayers(layers) {
        if(!layers || layers.length < 2) { // 1st layer is parent, children are the real layers
            return;
        }
        // make it a normal array, not a jQuery one
        var ls = [];
        layers.slice(1).each(function(i,o) {
            ls.push(o);
        });
        return ls.map(layerToObject);
    }
    function layerToObject(layer) {
        var l = $(layer);
        var o = {
            name: l.find('Name').first().text(),
            title: l.find('Title').first().text(),
            abstract: l.find('Abstract').first().text(),
            bbox: parseBoundingBox(l.find('EX_GeographicBoundingBox').first()),
            style: parseStyle(l.find('Style').first()),
            extent: parseExtent(l.find('Extent').first())
        };
        if(!o.bbox) {
            o.bbox = parseLatLonBoundingBox(l.find('LatLonBoundingBox').first());
        }
        return o;
    }
    function parseStyle(style) {
        var s = $(style);
        return {
            name: s.find('Name').first().text(),
            title: s.find('Title').first().text(),
            legend: s.find('OnlineResource').attr('xlink:href') // not very specific...
        };
    }
    function parseLatLonBoundingBox(bb) {
        if(bb.length) {
            var bbox = {
                westBoundLongitude: parseFloat(bb.attr('minx')),
                eastBoundLongitude: parseFloat(bb.attr('maxx')),
                southBoundLatitude: parseFloat(bb.attr('miny')),
                northBoundLatitude: parseFloat(bb.attr('maxy')),
                getBounds: function() { // TODO, cut/paste
                    return new google.maps.LatLngBounds(
                        new google.maps.LatLng(bbox.southBoundLatitude,bbox.westBoundLongitude), // sw
                        new google.maps.LatLng(bbox.northBoundLatitude,bbox.eastBoundLongitude) // ne
                    );
                }
            };
            return bbox;
        }
    }
    function parseBoundingBox(bb) {
        if(bb.length) {
            var bbox = {
                westBoundLongitude: parseFloat(bb.find('westBoundLongitude').text()),
                eastBoundLongitude: parseFloat(bb.find('eastBoundLongitude').text()),
                southBoundLatitude: parseFloat(bb.find('southBoundLatitude').text()),
                northBoundLatitude: parseFloat(bb.find('northBoundLatitude').text()),
                getBounds: function() {
                    return new google.maps.LatLngBounds(
                        new google.maps.LatLng(bbox.southBoundLatitude,bbox.westBoundLongitude), // sw
                        new google.maps.LatLng(bbox.northBoundLatitude,bbox.eastBoundLongitude) // ne
                    );
                }
            };
            // some bounding boxes seem to be messed up with lat/lons of 0 && -1
            // so if any of those numbers occur throw away the bounding box.
            return ![bbox.westBoundLongitude,bbox.eastBoundLongitude,bbox.southBoundLatitude,bbox.northBoundLatitude].reduce(function(v,n){
                return v||(n === 0 || n === -1);
            },false) ? bbox : undefined;
        }
    }
    // represents an extent value of month/day/year
    function DateExtentValue(value) {
        var d = new Date(value);
        return {
            value: value,
            date: d,
            label: $filter('date')(d,'shortDate'),
            addToWmsParams: function(params) {
                params.time = value;
            },
            addToWcsParams: function(params) {
                if(!params.subset) {
                    params.subset = [];
                }
                params.subset.push('http://www.opengis.net/def/axis/OGC/0/time("'+value+'")');
            }
        };
    }
    // represents an extent value of day of year
    function DoyExtentValue(value) {
        return {
            value: value,
            label: ''+value, // TODO translate to DOY
            addToWmsParams: function(params) {
                params.elevation = value;
            },
            addToWcsParams: function(params) {
                if(!params.subset) {
                    params.subset = [];
                }
                params.subset.push('http://www.opengis.net/def/axis/OGC/0/elevation('+value+')');
            }
        };
    }
    function parseExtent(extent) {
        var e = $(extent),content,dflt,
            name = e.attr('name');
        if(name === 'time') {
            content = e.text();
            if(content && content.indexOf('/') === -1) { // for now skip <lower>/<upper>/<resolution>
                dflt = new DateExtentValue(e.attr('default'));
                return {
                    label: 'Time',
                    type: 'time',
                    dflt: dflt,
                    current: dflt, // bind the extent value to use here
                    values: content.split(',').map(function(d) { return new DateExtentValue(d); })
                };
            }
        } else if (name === 'elevation') {
            content = e.text();
            dflt = new DoyExtentValue(e.attr('default'));
            return {
                label: 'Elevation',
                type: 'elevation',
                dflt: dflt,
                current: dflt, // bind the extent value to use here
                values: content.split(',').map(function(e) { return new DoyExtentValue(e); })
            };
        }
    }
    return service;
}])
.controller('MapVisCtrl',['$scope','$uibModalInstance','$http','$timeout','$filter','$log','uiGmapGoogleMapApi','uiGmapIsReady','WmsService','FilterService','ChartService','SettingsService',
    function($scope,$uibModalInstance,$http,$timeout,$filter,$log,uiGmapGoogleMapApi,uiGmapIsReady,WmsService,FilterService,ChartService,SettingsService){
        // this is introduced in angular 1.4, while this tool is based on 1.3
        function $httpParamSerializer(params){
            if(!params) {
                return '';
            }
            var args = [];
            Object.keys(params).forEach(function(key){
                var v = params[key];
                if(angular.isArray(v)) {
                    v.forEach(function(sv) {
                        args.push(key+'='+encodeURIComponent(sv));
                    });
                } else {
                    args.push(key+'='+encodeURIComponent(v));
                }
            });
            return args.join('&');
        }

        var api,map,infoWindow;
        $scope.modal = $uibModalInstance;
        $scope.wms_map = {
                center: { latitude: 48.35674, longitude: -122.39658 },
                zoom: 3,
                options: {
                    scrollwheel: false,
                    streetViewControl: false,
                    panControl: false,
                    zoomControl: true,
                    zoomControlOptions: {
                        style: google.maps.ZoomControlStyle.SMALL,
                        position: google.maps.ControlPosition.RIGHT_TOP
                    }
                },
                events: {
                    click: function(m,ename,args) {
                        var ev = args[0],
                            gridSize = 4,
                            edges,
                            wcsArgs,url; // actually probably 2.5
                        $log.debug('click',ev);
                        if($scope.selection.activeLayer) {
                            $log.debug('have map layer');
                            edges = [0,80,180,270].map(function(bearing) {
                                return ev.latLng.destinationPoint(bearing,(gridSize/2));
                            });
                            $log.debug('edges',edges);
                            wcsArgs = {
                                service: 'WCS',
                                request: 'GetCoverage',
                                version: '2.0.1',
                                coverageId: $scope.selection.activeLayer.name.replace(':','__'), // convention
                                format: 'application/gml+xml',
                                subset: []
                            };
                            wcsArgs.subset.push('http://www.opengis.net/def/axis/OGC/0/Long('+[edges[3].lng(),edges[1].lng()].join(',')+')');
                            wcsArgs.subset.push('http://www.opengis.net/def/axis/OGC/0/Lat('+[edges[2].lat(),edges[0].lat()].join(',')+')');
                            if($scope.selection.activeLayer.extent && $scope.selection.activeLayer.extent.current) {
                                $scope.selection.activeLayer.extent.current.addToWcsParams(wcsArgs);
                            }
                            $log.debug('wcsArgs',wcsArgs);
                            url = 'http://geoserver.usanpn.org:80/geoserver/wcs?'+$httpParamSerializer(wcsArgs);
                            $log.debug('url',url);
                            $http.get(url).then(function(response){
                                $log.debug('wcs response',response);
                                var wcs_data = $($.parseXML(response.data)),
                                    tuples = wcs_data.find('tupleList').text();
                                $log.debug('wcs_data',wcs_data);
                                $log.debug('tuples',tuples);
                                if(tuples) {
                                    tuples = tuples.trim().split(' ');
                                    $log.debug('tuples',tuples);
                                    if(!infoWindow) {
                                        infoWindow = new api.InfoWindow({
                                            maxWidth: 200,
                                            content: 'contents'
                                        });
                                    }
                                    infoWindow.setContent(tuples[0]);
                                    infoWindow.setPosition(ev.latLng);
                                    infoWindow.open(map);
                                }
                            });
//http://geoserver.usanpn.org:80/geoserver/wcs?
//request=GetCoverage&
//service=WCS&
//version=2.0.1&
//coverageId=gdd__30yr_avg_agdd&
//Format=application/gml%2Bxml&
//subset=http://www.opengis.net/def/axis/OGC/0/Long(-96.0414568,-96)&
//subset=http://www.opengis.net/def/axis/OGC/0/Lat(36,36.03608)&
//subset=http://www.opengis.net/def/axis/OGC/0/elevation(183.0)
                        }
                    }
                }
            };
        uiGmapGoogleMapApi.then(function(maps){
            api = maps;
            Number.prototype.toRad = function() {
               return this * Math.PI / 180;
            };

            Number.prototype.toDeg = function() {
               return this * 180 / Math.PI;
            };

            // 0=N,90=E,180=S,270=W dist in km
            maps.LatLng.prototype.destinationPoint = function(brng, dist) {
               dist = dist / 6371;
               brng = brng.toRad();

               var lat1 = this.lat().toRad(), lon1 = this.lng().toRad();

               var lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) +
                                    Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));

               var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) *
                                            Math.cos(lat1),
                                            Math.cos(dist) - Math.sin(lat1) *
                                            Math.sin(lat2));

               if (isNaN(lat2) || isNaN(lon2)) {
                    return null;
                }

               return new google.maps.LatLng(lat2.toDeg(), lon2.toDeg());
            };
            uiGmapIsReady.promise(2).then(function(instances){
                map = instances[1].map;
                WmsService.getLayers(map).then(function(layers){
                    $scope.layers = layers;
                },function(){
                    $log.error('unable to get map layers?');
                });
            });
        });

        $scope.selection = {};
        $scope.$watch('selection.layer',function(layer) {
            if(!layer) {
                return;
            }
            $log.debug('selection.layer',layer);
            if($scope.selection.activeLayer) {
                $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                $scope.selection.activeLayer.off();
            }
            // looks odd that we're not turning the layer on here
            // but updating the activeLayer reference will also result in
            // the selection.activeLayer.extent.current watch firing which
            // toggles the map off/on
            $log.debug('fitting new layer ',layer.name);
            $scope.selection.activeLayer = layer.fit();
        });
        $scope.$watch('selection.activeLayer.extent.current',function(v) {
            if($scope.selection.activeLayer) {
                $log.debug('layer extent change ',$scope.selection.activeLayer.name,v);
                $scope.selection.activeLayer.off().on();
            }
        });
}]);