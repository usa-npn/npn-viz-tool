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
            LayerService.loadLayer('abc');
            LayerService.loadLayer('def');

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
                        /*
                        for(var key in $scope.countMap) {
                            if(!$scope.countMap[key].$styled) {
                                console.log('count for ' + key + ' was not styled.');
                            }
                        }*/
                        LayerService.loadLayer('hij');
                    }
                }
                $scope.$watch('countMap',chorpleth);
                $scope.$watch('featureMap',chorpleth);
            });
        }]
    };
}]);