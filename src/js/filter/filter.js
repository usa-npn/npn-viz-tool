angular.module('npn-viz-tool.filter',[
    'isteven-multi-select'
])
.factory('FilterService',['$q','$http','$rootScope',function($q,$http,$rootScope){
    // NOTE: this scale is limited to 20 colors
    var colorScale = d3.scale.category20(),
        filter = {},
        last;
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
    function post_filter(markers) {
        $rootScope.$broadcast('filter-phase2-start',{
            count: markers.length
        });
        var filtered =  markers.filter(function(station){
            var sid,speciesFilter,keeps = 0;
            for(sid in station.species) {
                speciesFilter = filter[sid];
                if(!speciesFilter) {
                    console.warn('species found in results but not in filter',station.species[sid]);
                    continue;
                } else if (typeof(speciesFilter.$speciesFilter) != 'function') {
                    console.warn('speciesFilterTag does not expose a $speciesFilter function.');
                    continue;
                }
                if(speciesFilter.$speciesFilter(station.species[sid])) {
                    keeps++;
                }
            }
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
                        title: d.station_list[i].station_name
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
        resetFilter: function() {
            filter = {};
        },
        addToFilter: function(item) {
            if(item && item.species_id) {
                var key = parseInt(item.species_id);
                if(!filter[key]) {
                    item.color = colorScale(Object.keys(filter).length);
                    filter[key] = item;
                }
            } else if(item.start_date && item.end_date) {
                filter['date'] = item;
            }
        },
        removeFromFilter: function(item) {
            if(item && item.species_id) {
                delete filter[parseInt(item.species_id)];
            } else if(item && item.start_date && item.end_date) {
                delete filter['date'];
            }
        }
    };
}])
.directive('npnFilterResults',['$rootScope','$http','FilterService',function($rootScope,$http,FilterService){
    return {
        restrict: 'E',
        template: '<ui-gmap-markers models="results.markers" idKey="\'station_id\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" doCluster="true"></ui-gmap-markers>',
        scope: {
        },
        controller: function($scope) {
            $scope.results = {
                markers: []
            };
            $scope.$on('tool-close',function(event,data) {
                if(data.tool.id === 'filter' && !FilterService.isFilterEmpty()) {
                    $scope.results.markers = [];
                    FilterService.execute().then(function(markers) {
                        $scope.results.markers = markers;
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
// TODO - dropdown closes when any phenophase checkbox is clicked, it needs to stay open
.directive('speciesFilterTag',['$http','FilterService',function($http,FilterService){
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
            });
            $scope.$on('filter-phase1-start',function(event,data) {
                $scope.count = '?';
            });
            $scope.item.$speciesFilter = function(species) {
                if(species.species_id != $scope.item.species_id) {
                    console.warn('$filter called on wrong species', $scope.item, species);
                }
                // TODO - keep track of the "all selected" situation...
                var filtered = species.phenophases.filter(function(pp) {
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
            $http.get('/npn_portal/phenophases/getPhenophasesForSpecies.json',{ // cache ??
                params: {
                    return_all: true,
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
        }
    };
}])
.directive('filterControl',['$http','$filter','FilterService',function($http,$filter,FilterService){
    return {
        restrict: 'E',
        templateUrl: 'js/filter/filter.html',
        controller: ['$scope',function($scope) {
            $scope.selected = {addSpecies: undefined, date: {}};

            $scope.addDateRangeToFilter = function() {
                FilterService.addToFilter($scope.selected.date);
                $scope.selected.date = {};
            };

            $scope.filterHasDate = FilterService.hasDate;
            var thisYear = (new Date()).getYear()+1900,
                validYears = [];
            for(var i = 2010; i <= thisYear; i++) {
                validYears.push(i);
            }
            $scope.thisYear = thisYear;
            $scope.validYears = validYears;

            $scope.addSpeciesToFilter = function(species) {
                FilterService.addToFilter(species);
                $scope.selected.speciesToAdd = $scope.selected.addSpecies = undefined;
            };
            $scope.animals = [];
            $scope.plants = [];
            $scope.networks = [];
            $scope.findSpeciesParamsEmpty = true;
            var findSpeciesParams;

            function invalidateResults() {
                $scope.serverResults = undefined;
                $scope.selected.speciesToAdd = $scope.selected.addSpecies = undefined;
                var params = {},
                    sid_idx = 0;
                angular.forEach([].concat($scope.animals).concat($scope.plants),function(s){
                    params['group_ids['+(sid_idx++)+']'] = s['species_type_id'];
                });
                if($scope.networks.length) {
                    params['network_id'] = $scope.networks[0]['network_id'];
                }
                findSpeciesParams = params;
                $scope.findSpeciesParamsEmpty = Object.keys(params).length === 0;
            }

            $scope.$watch('animals',invalidateResults);
            $scope.$watch('plants',invalidateResults);
            $scope.$watch('networks',invalidateResults);

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
                            s.$display = s.common_name+' ('+s.number_observations+')';
                            species.push(s);
                        });
                        console.log('species',species);
                        return ($scope.serverResults = species);
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