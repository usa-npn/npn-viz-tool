angular.module('npn-viz-tool.stations',[
    'npn-viz-tool.filter',
    'npn-viz-tool.vis-cache',
    'npn-viz-tool.cluster',
    'npn-viz-tool.settings',
    'npn-viz-tool.layers',
    'npn-viz-tool.vis'
])
.factory('StationService',['$rootScope','$http','$log','$url','FilterService','ChartService',function($rootScope,$http,$log,$url,FilterService,ChartService){
    var infoWindow,
        markerEvents = {
        'click':function(m){
            $log.debug('click',m);
            if(infoWindow) {
                infoWindow.close();
                infoWindow = undefined;
            }
            //m.info = new google.maps.InfoWindow();
            //m.info.setContent('<div class="station-details"><i class="fa fa-circle-o-notch fa-spin"></i></div>');
            //m.info.open(m.map,m);
            $log.debug('Fetching info for station '+m.model.station_id);
            $http.get($url('/npn_portal/stations/getStationDetails.json'),{params:{ids: m.model.station_id}}).then(function(response){
                var info = response.data;
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
                    var details = $.parseHTML(html)[0];
                    if(!FilterService.isFilterEmpty()) {
                        var visualizations = ChartService.getVisualizations();
                        html = '<div>';
                        html += '<label>Visualize Site Data</label>';
                        html += '<ul class="list-unstyled">';
                        ChartService.getVisualizations().forEach(function(vis){
                            if(typeof(vis.singleStation) === 'undefined' || vis.singleStation) {
                                html += '<li>';
                                html += '<a id="'+vis.controller+'" href="#">'+vis.title+'</a>';
                                html += '</li>';
                            }
                        });
                        html += '</ul></div>';
                        var visLinks = $.parseHTML(html)[0];
                        $(details).append(visLinks);
                        ChartService.getVisualizations().forEach(function(vis){
                            var link = $(details).find('#'+vis.controller);
                            link.click(function(){
                                $rootScope.$apply(function(){
                                    ChartService.openSingleStationVisualization(m.model.station_id,vis);
                                });
                            });
                        });
                    }

                    infoWindow = new google.maps.InfoWindow({
                        maxWidth: 500,
                        content: details
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
.directive('npnStations',['$http','$log','$timeout','$url','LayerService','SettingsService','StationService','ClusterService','CacheService',
    function($http,$log,$timeout,$url,LayerService,SettingsService,StationService,ClusterService,CacheService){
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
            var eventListeners = [],
                stationCounts = CacheService.get('stations-counts-by-state');
            if(stationCounts) {
                handleCounts(stationCounts);
            } else {
                $http.get($url('/npn_portal/stations/getStationCountByState.json')).then(function(response){
                    var counts = response.data;
                    CacheService.put('stations-counts-by-state',counts);
                    handleCounts(counts);
                });
            }
            function handleCounts(counts){
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
                                // remove the station count marker, splice doesn't work here.
                                $scope.regions.markers = $scope.regions.markers.filter(function(m){
                                    return m.name !== state;
                                });
                                $scope.stations.states.push(state);
                                $timeout(function(){
                                    // simply drop the feature as opposed to re-styling it
                                    map.data.remove(event.feature);
                                    map.panTo(event.latLng);
                                    var waitTime = 0;
                                    if(map.getZoom() != 6) {
                                        map.setZoom(6);
                                        waitTime = 500; // give more time for map tiles to load
                                    }
                                    $timeout(function(){
                                        $http.get($url('/npn_portal/stations/getAllStations.json'),
                                                    {params:{state_code:state}})
                                            .then(function(response){
                                                var data = response.data;
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
                                            });
                                    },waitTime);
                                },500);
                            }
                        }));
                    });
                });
            }
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
