angular.module('npn-viz-tool.filter',[
    'isteven-multi-select'
])
/**
 * TODO - need to nail down the event model and probably even formalize it via a service because it's all
 * pretty loosey goosey at the moment.  Bad enough duplicating strings around...
 *
 * TODO - the filter components (date, species and geo) are untyped objects.  it would be much cleaner to
 * strongly type them and create factory methods for them.
 * E.g.
 * var filterArg = FilterService.newSpeciesArg() || newDateArg() || newGeoArg();
 */
.factory('FilterService',['$q','$http','$rootScope','$timeout','uiGmapGoogleMapApi',function($q,$http,$rootScope,$timeout,uiGmapGoogleMapApi){
    // NOTE: this scale is limited to 20 colors
    var colorScale = d3.scale.category20(),
        filter = {},
        geoFilter = {},
        defaultIcon = {
            //path: google.maps.SymbolPath.CIRCLE,
            //'M 125,5 155,90 245,90 175,145 200,230 125,180 50,230 75,145 5,90 95,90 z',
            fillColor: '#00ff00',
            fillOpacity: 0.95,
            scale: 8,
            strokeColor: '#204d74',
            strokeWeight: 1
        },
        last;
    uiGmapGoogleMapApi.then(function(maps) {
        defaultIcon.path = maps.SymbolPath.CIRCLE;
    });
    function isFilterEmpty() {
        return Object.keys(filter).length === 0;
    }
    function getFilterParams() {
        if(!isFilterEmpty()) {
            var params = {},
                species_idx = 0,
                key,item;
            for(key in filter) {
                item = filter[key];
                if (item.species_id) {
                    params['species_id['+(species_idx++)+']'] = item.species_id;
                } else if (key === 'date' && item.start_date && item.end_date) {
                    params['start_date'] = item.start_date+'-01-01';
                    params['end_date'] = item.end_date+'-12-31';
                }
            }
            return params;
        }
    }
    $rootScope.$on('filter-rerun-phase2',function(event,data){
        $timeout(function(){
            if(last) {
                var markers = post_filter(last);
                $rootScope.$broadcast('filter-marker-updates',{markers: markers});
            }
        },500);
    });
    function post_filter(markers) {
        $rootScope.$broadcast('filter-phase2-start',{
            count: markers.length
        });
        var filtered =  markers.filter(function(station){
            if(Object.keys(geoFilter).length > 0) {
                var gid,hit = false;
                for(gid in geoFilter) {
                    if((hit=geoFilter[gid].$geoFilter(station))) {
                        break;
                    }
                }
                if(!hit) {
                    return false;
                }
            }
            station.markerOpts.icon.fillColor = defaultIcon.fillColor;

            var sid,speciesFilter,keeps = 0,
                hitMap = {};
            for(sid in station.species) {
                speciesFilter = filter[sid];
                hitMap[sid] = 0;
                if(!speciesFilter) {
                    console.warn('species found in results but not in filter',station.species[sid]);
                    continue;
                } else if (typeof(speciesFilter.$speciesFilter) != 'function') {
                    console.warn('speciesFilterTag does not expose a $speciesFilter function.');
                    continue;
                }
                if(speciesFilter.$speciesFilter(station.species[sid])) {
                    hitMap[sid]++;
                    keeps++;
                    if(keeps === 1) {
                        // this is the first "hit" and dictates the marker color
                        station.markerOpts.icon.fillColor = speciesFilter.color;
                    }
                }
            }
            // look through the hitMap and see if there were multiple hits for multiple species
            hitMap['n'] = 0;
            for(sid in hitMap) {
                if(sid != 'n' && hitMap[sid] > 0) {
                    hitMap['n']++;
                }
            }
            station.markerOpts.icon.strokeColor = (hitMap['n'] > 1) ? '#00ff00' : defaultIcon.strokeColor;
            // set key on the marker that uniquely identifies it based on its id and colors
            station.$markerKey = station.station_id+'.'+station.markerOpts.icon.fillColor+'.'+station.markerOpts.icon.strokeColor;
            return keeps > 0;
        });
        $rootScope.$broadcast('filter-phase2-end',{
            count: filtered.length
        });
        return filtered;
    }
    function execute() {
        var def = $q.defer(),
            filterParams = getFilterParams();
        if(filterParams) {
            $rootScope.$broadcast('filter-phase1-start',{});
            $http.get('/npn_portal/observations/getAllObservationsForSpecies.json',{
                params: filterParams
            }).success(function(d) {
                var i,j,k,s;
                // replace 'station_list' with a map
                d.stations = {};
                for(i = 0; i < d.station_list.length; i++) {
                    d.station_list[i].markerOpts = {
                        title: d.station_list[i].station_name,
                        icon: angular.extend({},defaultIcon)
                    };
                    d.stations[d.station_list[i].station_id] = d.station_list[i];
                }
                for(i = 0; i < d.observation_list.length; i++) {
                    for(j = 0; j < d.observation_list[i].stations.length; j++) {
                        s = d.stations[d.observation_list[i].stations[j].station_id];
                        if(!s) {
                            console.warn('Unable to find station with id', d.observation_list[i].stations[j].station_id);
                            continue;
                        }
                        if(!s.species) {
                            s.species = {};
                        }
                        for(k = 0; k < d.observation_list[i].stations[j].species_ids.length; k++) {
                            var sid = d.observation_list[i].stations[j].species_ids[k];
                            if(!s.species[sid.species_id]) {
                                s.species[sid.species_id] = sid;
                            } else {
                                s.species[sid.species_id].phenophases = s.species[sid.species_id].phenophases.concat(sid.phenophases);
                            }
                        }
                    }
                }
                $rootScope.$broadcast('filter-phase1-end',{
                    count: d.station_list.length
                });
                // now need to walk through the station_list and post-filter by phenophases...
                console.log('results-pre',d);
                def.resolve(post_filter(last=d.station_list));
            });
        } else {
            // no filter params return an empty list of markers
            def.resolve([]);
        }
        return def.promise;
    }
    function broadcastFilterUpdate() {
        $rootScope.$broadcast('filter-update',{});
    }
    function resetFilter() {
        filter = {};
        $rootScope.$broadcast('filter-reset',{});
    }
    function updateColors() {
        var key,fc,idx = 0;
        for(key in filter) {
            fc = filter[key];
            if(fc.species_id) {
                fc.color = colorScale(idx++);
            }
        }
    }
    return {
        getFilter: function() {
            return angular.extend({},filter);
        },
        execute: execute,
        reExecute: function() {
            return (last && last.length) ? post_filter(last) : [];
        },
        isFilterEmpty: isFilterEmpty,
        hasDate: function() {
            return !!filter['date'];
        },
        getDate: function() {
            return filter['date'];
        },
        resetFilter: resetFilter,
        addToFilter: function(item) {
            if(item && item.species_id) {
                var key = parseInt(item.species_id);
                if(!filter[key]) {
                    filter[key] = item;
                    updateColors();
                    broadcastFilterUpdate();
                }
            } else if(item && item.start_date && item.end_date) {
                filter['date'] = item;
                broadcastFilterUpdate();
            } else if(item && item.geoKey) {
                geoFilter[item.geoKey] = item;
            }
        },
        removeFromFilter: function(item) {
            if(item && item.species_id) {
                delete filter[parseInt(item.species_id)];
                if(isFilterEmpty()) {
                    resetFilter(); // so that events go out
                } else {
                    broadcastFilterUpdate();
                }
            } else if(item && item.start_date && item.end_date) {
                // date is required so removal of it invalidates the entire filter
                resetFilter();
            } else if(item && item.geoKey) {
                delete geoFilter[item.geoKey];
            }
        }
    };
}])
.directive('npnFilterResults',['$document','$rootScope','$http','FilterService',function($document,$rootScope,$http,FilterService){
    return {
        restrict: 'E',
        template: '<ui-gmap-markers models="results.markers" idKey="\'$markerKey\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" doCluster="doCluster"></ui-gmap-markers>',
        scope: {
        },
        controller: function($scope) {
            var filter_control_open = false;
            $scope.results = {
                markers: []
            };
            $scope.doCluster = true;
            function executeFilter() {
                if(!FilterService.isFilterEmpty()) {
                    $scope.results.markers = [];
                    FilterService.execute().then(function(markers) {
                        $scope.results.markers = markers;
                    });
                }
            }
            $scope.$on('tool-open',function(event,data){
                filter_control_open = (data.tool.id === 'filter');
            });
            $scope.$on('tool-close',function(event,data) {
                if(data.tool.id === 'filter') {
                    filter_control_open = false;
                    executeFilter();
                }
            });
            $scope.$on('filter-update',function(event,data){
                if(!filter_control_open) {
                    executeFilter();
                }
            });
            $scope.$on('filter-reset',function(event,data){
                $scope.results.markers = [];
            });
            $scope.$on('filter-marker-updates',function(event,data){
                console.log('update data',data);
                $scope.results.markers = data.markers;
            });
            // TEMPORARY try toggling clustering on/off
            $document.bind('keypress',function(e){
                if(e.charCode === 99 || e.key === 'C') {
                    $scope.$apply(function(){
                        $scope.doCluster = !$scope.doCluster;
                    });
                }
            });
        }
    };
}])
.directive('filterTags',['FilterService',function(FilterService){
    return {
        restrict: 'E',
        templateUrl: 'js/filter/filterTags.html',
        scope: {
        },
        controller: function($scope){
            $scope.getFilter = FilterService.getFilter;
        }
    };
}])
.directive('speciesFilterTag',['$rootScope','$http','FilterService',function($rootScope,$http,FilterService){
    return {
        restrict: 'E',
        require: '^filterTags',
        templateUrl: 'js/filter/speciesFilterTag.html',
        scope: {
            item: '='
        },
        controller: function($scope){
            $scope.$on('filter-phase2-start',function(event,data) {
                $scope.count = 0;
                angular.forEach($scope.item.phenophases,function(pp){
                    pp.count = 0;
                });
            });
            $scope.$on('filter-phase1-start',function(event,data) {
                $scope.count = '?';
                angular.forEach($scope.item.phenophases,function(pp){
                    pp.count = '?';
                });
            });
            $scope.item.$speciesFilter = function(species) {
                if(species.species_id != $scope.item.species_id) {
                    console.warn('$filter called on wrong species', $scope.item, species);
                }
                var filtered = species.phenophases.filter(function(pp) {
                    $scope.item.phenophasesMap[pp.phenophase_id].count++;
                    return $scope.item.phenophasesMap[pp.phenophase_id].selected;
                });
                if(filtered.length > 0) {
                    // TODO - the # here is the number of stations with a hit?
                    $scope.count++;
                }
                return filtered.length > 0;
            };
            $scope.count = '?';
            $scope.removeFromFilter = FilterService.removeFromFilter;
            $scope.status = {
                isopen: false
            };
            // keep track of selected phenophases during open/close of the list
            // if on close something changed ask that the currently filtered data
            // be re-filtered.
            var saved_pheno_state;
            $scope.$watch('status.isopen',function() {
                if($scope.status.isopen) {
                    saved_pheno_state = $scope.item.phenophases.map(function(pp) { return pp.selected; });
                } else if (saved_pheno_state) {
                    for(var i = 0; i < saved_pheno_state.length; i++) {
                        if(saved_pheno_state[i] != $scope.item.phenophases[i].selected) {
                            $rootScope.$broadcast('filter-rerun-phase2',{});
                            break;
                        }
                    }
                }
            });
            $scope.selectAll = function(state) {
                angular.forEach($scope.item.phenophases,function(pp){
                    pp.selected = state;
                });
            };
            $http.get('/npn_portal/phenophases/getPhenophasesForSpecies.json',{ // cache ??
                params: {
                    return_all: true,
                    //date: FilterService.getDate().end_date+'-12-31',
                    species_id: $scope.item.species_id
                }
            }).success(function(phases) {
                var seen = {}; // the call returns redundant data so filter it out.
                $scope.item.phenophases = phases[0].phenophases.filter(function(pp){
                    if(seen[pp.phenophase_id]) {
                        return false;
                    }
                    seen[pp.phenophase_id] = pp;
                    return (pp.selected = true);
                });
                $scope.item.phenophasesMap = {}; // create a map for faster lookup during filtering.
                angular.forEach($scope.item.phenophases,function(pp){
                    $scope.item.phenophasesMap[pp.phenophase_id] = pp;
                });
            });
        }
    };
}])
.directive('dateFilterTag',['FilterService',function(FilterService){
    return {
        restrict: 'E',
        require: '^filterTags',
        templateUrl: 'js/filter/dateFilterTag.html',
        scope: {
            item: '='
        },
        controller: function($scope){
            $scope.removeFromFilter = FilterService.removeFromFilter;
            $scope.count = '?';
            $scope.$on('filter-phase1-start',function(event,data) {
                $scope.count = '?';
            });
            $scope.$on('filter-phase2-start',function(event,data) {
                $scope.count = 0;
            });
            $scope.$on('filter-phase2-end',function(event,data) {
                $scope.count = data.count;
            });
        }
    };
}])
.directive('filterControl',['$http','$filter','FilterService',function($http,$filter,FilterService){
    return {
        restrict: 'E',
        templateUrl: 'js/filter/filter.html',
        controller: ['$scope',function($scope) {

            $scope.addDateRangeToFilter = function() {
                FilterService.addToFilter($scope.selected.date);
                //$scope.selected.date = {};
            };

            $scope.filterHasDate = FilterService.hasDate;
            var thisYear = (new Date()).getYear()+1900,
                validYears = [];
            for(var i = 2010; i <= thisYear; i++) {
                validYears.push(i);
            }
            $scope.thisYear = thisYear;
            $scope.validYears = validYears;

            $scope.selected = {addSpecies: undefined, date: {
                start_date: (thisYear-1),
                end_date: thisYear
            }};

            $scope.addSpeciesToFilter = function(species) {
                FilterService.addToFilter(species);
                $scope.selected.speciesToAdd = $scope.selected.addSpecies = undefined;
            };
            $scope.speciesInput = {
                animals: [],
                plants: [],
                networks: []
            };
            $scope.findSpeciesParamsEmpty = true;
            var findSpeciesParams;

            function invalidateResults() {
                $scope.serverResults = undefined;
                $scope.selected.speciesToAdd = $scope.selected.addSpecies = undefined;
                var params = {},
                    sid_idx = 0;
                angular.forEach([].concat($scope.speciesInput.animals).concat($scope.speciesInput.plants),function(s){
                    params['group_ids['+(sid_idx++)+']'] = s['species_type_id'];
                });
                if($scope.speciesInput.networks.length) {
                    params['network_id'] = $scope.speciesInput.networks[0]['network_id'];
                }
                findSpeciesParams = params;
                $scope.findSpeciesParamsEmpty = Object.keys(params).length === 0;
            }

            $scope.$watch('speciesInput.animals',invalidateResults);
            $scope.$watch('speciesInput.plants',invalidateResults);
            $scope.$watch('speciesInput.networks',invalidateResults);

            $scope.$watch('selected.addSpecies',function(){
                $scope.selected.speciesToAdd = angular.isObject($scope.selected.addSpecies) ?
                    $scope.selected.addSpecies : undefined;
            });

            $scope.findSpecies = function() {
                if(!$scope.serverResults) {
                    $scope.serverResults = $http.get('/npn_portal/species/getSpeciesFilter.json',{
                        params: findSpeciesParams
                    }).then(function(response){
                        var species = [];
                        angular.forEach(response.data,function(s){
                            s.number_observations = parseInt(s.number_observations);
                            s.$display = s.common_name+' ('+s.number_observations+')';
                            species.push(s);
                        });
                        return ($scope.serverResults = species.sort(function(a,b){
                            if(a.number_observations < b.number_observations) {
                                return 1;
                            }
                            if(a.number_observations > b.number_observations) {
                                return -1;
                            }
                            return 0;
                        }));
                    });
                }
                return $scope.serverResults;
            };
            $http.get('/npn_portal/networks/getPartnerNetworks.json').success(function(partners){
                angular.forEach(partners,function(p) {
                    p.network_name = p.network_name.trim();
                });
                $scope.partners = partners;
            });
            // not selecting all by default to force the user to pick which should result
            // in less expensive type-ahead queries later (e.g. 4s vs 60s).
            $http.get('/npn_portal/species/getPlantTypes.json').success(function(types){
                $scope.plantTypes = types;
            });
            $http.get('/npn_portal/species/getAnimalTypes.json').success(function(types){
                $scope.animalTypes = types;
            });
        }]
    };
}]);