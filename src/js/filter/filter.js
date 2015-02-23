angular.module('npn-viz-tool.filter',[
    'isteven-multi-select'
]).directive('filterControl',['$http','$filter',function($http,$filter){
    return {
        restrict: 'E',
        templateUrl: 'js/filter/filter.html',
        controller: ['$scope',function($scope) {
            $scope.addSpecies = {selected: undefined};
            $scope.animals = [];
            $scope.plants = [];
            $scope.networks = [];
            function invalidateResults() {
                $scope.serverResults = undefined;
            }
            $scope.$watch('animals',invalidateResults);
            $scope.$watch('plants',invalidateResults);
            $scope.$watch('networks',invalidateResults);
            $scope.$watch('addSpecies.selected',function(){
                $scope.addSpecies.speciesToAdd = angular.isObject($scope.addSpecies.selected) ?
                    $scope.addSpecies.selected : undefined;
            });

            function findSpeciesParams() {
                var params = {},
                    sid_idx = 0;
                angular.forEach([].concat($scope.animals).concat($scope.plants),function(s){
                    params['group_ids['+(sid_idx++)+']'] = s['species_type_id'];
                });
                if($scope.networks.length) {
                    params['network_id'] = $scope.networks[0]['network_id'];
                }
                return params;
            }

            $scope.findSpecies = function() {
                if(!$scope.serverResults) {
                    $scope.serverResults = $http.get('/npn_portal/species/getSpeciesFilter.json',{
                        params: findSpeciesParams()
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

            function selectAll(types) {
                angular.forEach(types,function(type) {
                    type.selected = true;
                });
                return types;
            }

            $http.get('/npn_portal/networks/getPartnerNetworks.json').success(function(partners){
                angular.forEach(partners,function(p) {
                    p.network_name = p.network_name.trim();
                });
                $scope.partners = partners;
            });
            $http.get('/npn_portal/species/getPlantTypes.json').success(function(types){
                $scope.plantTypes = selectAll(types);
            });
            $http.get('/npn_portal/species/getAnimalTypes.json').success(function(types){
                $scope.animalTypes = selectAll(types);
            });
        }]
    };
}]);