angular.module('npn-viz-tool.filter',[
    'isteven-multi-select'
])
.factory('FilterService',[function(){
    // NOTE: this scale is limited to 20 colors
    var colorScale = d3.scale.category20(),
        filter = {};
    return {
        getFilter: function() {
            return angular.extend({},filter);
        },
        isFilterEmpty: function() {
            return Object.keys(filter).length === 0;
        },
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