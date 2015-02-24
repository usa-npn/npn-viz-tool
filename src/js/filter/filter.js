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
        resetFilter: function() {
            filter = {};
        },
        addSpecies: function(species) {
            species.color = colorScale(Object.keys(filter).length);
            if(species && species.species_id) {
                filter[parseInt(species.species_id)] = species;
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
.directive('filterTag',['$http',function($http){
    return {
        restrict: 'E',
        templateUrl: 'js/filter/filterTag.html',
        scope: {
            item: '='
        },
        controller: function($scope){
            $scope.status = {
                isopen: false
            };

            // TODO cache ??
            $http.get('/npn_portal/phenophases/getPhenophasesForSpecies.json',{
                params: {
                    return_all: true,
                    species_id: $scope.item.species_id
                }
            }).success(function(phases) {
                console.log('phases',phases);
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
.directive('filterControl',['$http','$filter','FilterService',function($http,$filter,FilterService){
    return {
        restrict: 'E',
        templateUrl: 'js/filter/filter.html',
        controller: ['$scope',function($scope) {
            $scope.addSpeciesToFilter = function(species) {
                FilterService.addSpecies(species);
                $scope.addSpecies.speciesToAdd = $scope.addSpecies.selected = undefined;
            };
            $scope.addSpecies = {selected: undefined};
            $scope.animals = [];
            $scope.plants = [];
            $scope.networks = [];
            $scope.findSpeciesParamsEmpty = true;
            var findSpeciesParams;

            function invalidateResults() {
                $scope.serverResults = undefined;
                $scope.addSpecies.speciesToAdd = undefined;
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

            $scope.$watch('addSpecies.selected',function(){
                $scope.addSpecies.speciesToAdd = angular.isObject($scope.addSpecies.selected) ?
                    $scope.addSpecies.selected : undefined;
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