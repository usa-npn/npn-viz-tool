angular.module('npn-viz-tool.stations',[
    'npn-viz-tool.filter',
    'npn-viz-tool.cluster',
    'npn-viz-tool.settings',
    'npn-viz-tool.layers'
])
.factory('StationService',['$http','$log','FilterService',function($http,$log,FilterService){
    var infoWindow,
        markerEvents = {
        'click':function(m){
            if(infoWindow) {
                infoWindow.close();
                infoWindow = undefined;
            }
            //m.info = new google.maps.InfoWindow();
            //m.info.setContent('<div class="station-details"><i class="fa fa-circle-o-notch fa-spin"></i></div>');
            //m.info.open(m.map,m);
            $log.debug('Fetching info for station '+m.model.station_id);
            $http.get('/npn_portal/stations/getStationDetails.json',{params:{ids: m.model.station_id}}).success(function(info){
                function litem(label,value) {
                    return value && value !== '' ?
                     '<li><label>'+label+':</label> '+value+'</li>' : '';
                }
                if(info && info.length === 1) {
                    var i = info[0],
                        html = '<div class="station-details">';
                    $log.debug(i);
                    //html += '<h5>'+i.site_name+'</h5>';
                    html += '<ul class="list-unstyled">';
                    html += litem('Site Name',i.site_name);
                    html += litem('Group',i.group_name);
                    if(m.model.observationCount) {
                        html += litem('Records',m.model.observationCount);
                    } else {
                        html += litem('Individuals',i.num_individuals);
                        html += litem('Records',i.num_records);
                    }

                    html += '</ul>';
                    if(m.model.speciesInfo) {
                        html += '<label>Species Observed</label>';
                        html += '<ul class="list-unstyled">';
                        Object.keys(m.model.speciesInfo.titles).forEach(function(key){
                            var scale = FilterService.getChoroplethScale(key),
                                count = m.model.speciesInfo.counts[key];
                            html += '<li><div class="choropleth-swatch" style="background-color: '+scale(count)+';"></div>'+m.model.speciesInfo.titles[key]+' ('+count+')</li>';
                        });
                        html += '</ul>';
                    }
                    html += '</div>';
                    infoWindow = new google.maps.InfoWindow({
                        maxWidth: 500,
                        content: html
                    });
                    infoWindow.open(m.map,m);
                }
            });
        }
    },
    service = {
        getMarkerEvents: function() { return markerEvents; }
    };
    return service;
}])
.directive('npnStations',['$http','$log','LayerService','SettingsService','StationService','ClusterService',function($http,$log,LayerService,SettingsService,StationService,ClusterService){
    return {
        restrict: 'E',
        template: '<ui-gmap-markers models="regions.markers" idKey="\'name\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" isLabel="true"></ui-gmap-markers><ui-gmap-markers models="stations.markers" idKey="\'station_id\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" doCluster="doCluster" events="markerEvents" clusterOptions="clusterOptions"></ui-gmap-markers>',
        scope: {
        },
        controller: ['$scope',function($scope) {
            $scope.doCluster = SettingsService.getSettingValue('clusterMarkers');
            $scope.$on('setting-update-clusterMarkers',function(event,data){
                $scope.doCluster = data.value;
            });
            var clusterOptions = ClusterService.getDefaultClusterOptions();
            $scope.clusterOptions = angular.extend(clusterOptions,{
                calculator: function(markers,styleCount) {
                    var r = {
                        text: markers.length,
                        index:1
                    };
                    for(var i = 0; i <clusterOptions.styles.length;i++) {
                        if(markers.length >= clusterOptions.styles[i].n) {
                            r.index = (i+1);
                        }
                    }
                    return r;
                }
            });
            $scope.regions = {
                markers: []
            };
            $scope.stations = {
                states: [],
                markers: []
            };
            $scope.markerEvents = StationService.getMarkerEvents();
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
                    LayerService.loadLayer('primary',function(feature) {
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
                            var center = feature.getProperty('CENTER'),
                                regionMarker = angular.extend({
                                    name: name,
                                    icon: {
                                        path: google.maps.SymbolPath.CIRCLE,
                                        fillColor: '#000',
                                        fillOpacity: 0.5,
                                        scale: 16,
                                        strokeColor: '#ccc',
                                        strokeWeight: 1
                                    },
                                    markerOpts: {
                                        title: name + ' ('+count.number_stations+' Sites)',
                                        labelClass: 'station-count',
                                        labelContent: ''+count.number_stations
                                        }},center);
                            if(count.number_stations < 10) {
                                regionMarker.icon.scale = 8;
                                regionMarker.markerOpts.labelAnchor = '4 8';
                            } else if(count.number_stations < 100) {
                                regionMarker.icon.scale = 12;
                                regionMarker.markerOpts.labelAnchor = '8 8';
                            } else if(count.number_stations < 1000) {
                                regionMarker.icon.scale = 14;
                                regionMarker.markerOpts.labelAnchor = '10 8';
                            } else {
                                regionMarker.markerOpts.labelAnchor = '13 8';
                            }
                            $scope.$apply(function(){
                                $scope.regions.markers.push(regionMarker);
                            });
                        } else if (!loaded) {
                            $log.warn('no station count for '+name);
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
                                                title: d.station_name,
                                                icon: {
                                                    path: google.maps.SymbolPath.CIRCLE,
                                                    fillColor: '#e6550d',
                                                    fillOpacity: 1.0,
                                                    scale: 8,
                                                    strokeColor: '#204d74',
                                                    strokeWeight: 1
                                                }
                                            };
                                        });
                                        var newMarkers = $scope.stations.markers.concat(data),
                                            n = (newMarkers.length > 512 ? Math.round(newMarkers.length/2) : 512),i;
                                        for(i = clusterOptions.styles.length-1; i >= 0; i--) {
                                            clusterOptions.styles[i].n = n;
                                            n = Math.round(n/2);
                                        }
                                        $scope.stations.markers = newMarkers;
                                        // simply drop the feature as opposed to re-styling it
                                        map.data.remove(event.feature);
                                        // remove the station count marker
                                        // UGH splice isn't triggering the marker to get removed so re-build the
                                        // marker array...
                                        var region_markers = [];
                                        for(i = 0; i < $scope.regions.markers.length; i++) {
                                            if($scope.regions.markers[i].name !== state) {
                                                region_markers.push($scope.regions.markers[i]);
                                            }
                                        }
                                        $scope.regions.markers = region_markers;
                                    });
                            }
                        }));
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