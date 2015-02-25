/*
 * Regs-Dot-Gov-Directives
 * Version: 0.1.0 - 2015-02-25
 */

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
                    if(keeps === 1) {
                        // this is the first "hit" and dictates the marker color
                        station.markerOpts.icon.fillColor = speciesFilter.color;
                    }
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
                        title: d.station_list[i].station_name,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            //'M 125,5 155,90 245,90 175,145 200,230 125,180 50,230 75,145 5,90 95,90 z',
                            fillColor: '#00ff00',
                            fillOpacity: 0.95,
                            scale: 8,
                            strokeColor: '#204d74',
                            strokeWeight: 1
                        }
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
        getDate: function() {
            return filter['date'];
        },
        resetFilter: function() {
            filter = {};
        },
        addToFilter: function(item) {
            if(item && item.species_id) {
                var key = parseInt(item.species_id);
                if(!filter[key]) {
                    item.colorIdx = Object.keys(filter).length;
                    item.color = colorScale(item.colorIdx);
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
                // date is required so removal of it invalidates the entire filter
                filter = {};
            }
        }
    };
}])
.directive('npnFilterResults',['$document','$rootScope','$http','FilterService',function($document,$rootScope,$http,FilterService){
    return {
        restrict: 'E',
        template: '<ui-gmap-markers models="results.markers" idKey="\'station_id\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" doCluster="doCluster"></ui-gmap-markers>',
        scope: {
        },
        controller: function($scope) {
            $scope.results = {
                markers: []
            };
            $scope.doCluster = true;
            $scope.$on('tool-close',function(event,data) {
                if(data.tool.id === 'filter' && !FilterService.isFilterEmpty()) {
                    $scope.results.markers = [];
                    FilterService.execute().then(function(markers) {
                        $scope.results.markers = markers;
                    });
                }
            });
            $scope.$on('filter-rerun-phase2',function(event,data) {
                $scope.results.markers = FilterService.reExecute();
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
                // TODO - keep track of the "all selected" situation...
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

            $scope.selected = {addSpecies: undefined, date: {
                start_date: (thisYear-1),
                end_date: thisYear
            }};

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
angular.module('npn-viz-tool.filters',[
])
.filter('gte',function(){
    return function(input,num) {
        if(!num || !angular.isArray(input)) {
            return input;
        }
        return input.filter(function(i){
            return i >= num;
        });
    };
})
.filter('lte',function(){
    return function(input,num) {
        if(!num || !angular.isArray(input)) {
            return input;
        }
        return input.filter(function(i){
            return i <= num;
        });
    };
})
.filter('trim',function(){
    return function(input) {
        if(angular.isString(input)) {
            return input.trim();
        }
        return input;
    };
})
.filter('faFileIcon',function(){
    var map = {
        pdf: 'fa-file-pdf-o'
    };
    return function(input) {
        if(input && !map[input]) {
            console.debug('no explicit file type icon for '+input);
        }
        return map[input]||'fa-file-o';
    };
})
.filter('ellipses',function(){
    return function(input) {
        var maxLen = arguments.length == 2 ? arguments[1] : 55;
        if(typeof(input) == 'string' && input.length > maxLen) {
            return input.substring(0,maxLen)+' ...';
        }
        return input;
    };
});
angular.module('npn-viz-tool',[
'templates-npnvis',
'npn-viz-tool.services',
'npn-viz-tool.map',
'npn-viz-tool.toolbar',
'npn-viz-tool.filters',
'uiGmapgoogle-maps',
'ui.bootstrap',
'ngAnimate'
])
.config(function(uiGmapGoogleMapApiProvider) {
    uiGmapGoogleMapApiProvider.configure({
        //    key: 'your api key',
        v: '3.17',
        libraries: 'geometry'
    });
});

angular.module('npn-viz-tool.map',[
    'npn-viz-tool.services',
    'npn-viz-tool.stations',
    'npn-viz-tool.toolbar',
    'npn-viz-tool.filter',
    'uiGmapgoogle-maps'
])
.directive('npnVizMap',['$document','uiGmapGoogleMapApi','uiGmapIsReady','FilterService',function($document,uiGmapGoogleMapApi,uiGmapIsReady,FilterService){
    return {
        restrict: 'E',
        templateUrl: 'js/map/map.html',
        scope: {
        },
        controller: ['$scope',function($scope) {
            $scope.stationView = true;
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
            $scope.$on('tool-close',function(event,data) {
                if(data.tool.id === 'filter' && !FilterService.isFilterEmpty()) {
                    // hide the station view
                    $scope.stationView = false;
                }
            });
            /*
            $document.bind('keypress',function(e){
                if(e.charCode === 114 || e.key === 'R') {
                    $scope.$apply(function(){
                        $scope.stationView = !$scope.stationView;
                    });
                }
                console.log('kp',e);
            });*/
        }]
    };
}]);
angular.module('templates-npnvis', ['js/filter/dateFilterTag.html', 'js/filter/filter.html', 'js/filter/filterTags.html', 'js/filter/speciesFilterTag.html', 'js/map/map.html', 'js/toolbar/tool.html', 'js/toolbar/toolbar.html']);

angular.module("js/filter/dateFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/dateFilterTag.html",
    "<div class=\"btn-group\">\n" +
    "    <button class=\"btn btn-default\" disabled>\n" +
    "        {{item.start_date}} - {{item.end_date}} <span class=\"badge\">{{count}}</span>\n" +
    "    </button>\n" +
    "    <button class=\"btn btn-default\" ng-click=\"removeFromFilter(item)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </button>\n" +
    "</div>");
}]);

angular.module("js/filter/filter.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/filter.html",
    "<ul class=\"list-unstyled\">\n" +
    "    <li>\n" +
    "        <label for=\"yearInputForm\">Years (at most two)</label>\n" +
    "        <form id=\"yearInputForm\" name=\"yearInputForm\">\n" +
    "        <input id=\"start_date\" type=\"number\" class=\"form-control\"\n" +
    "               max=\"{{selected.date.end_date || thisYear}}\"\n" +
    "               ng-model=\"selected.date.start_date\"\n" +
    "               typeahead=\"year for year in validYears | lte:selected.date.end_date | filter:$viewValue\"\n" +
    "               required placeholder=\"From\" /> - \n" +
    "        <input id=\"end_date\" type=\"number\" class=\"form-control\"\n" +
    "                min=\"{{selected.date.start_date || 2010}}\"\n" +
    "                ng-model=\"selected.date.end_date\"\n" +
    "                typeahead=\"year for year in validYears | gte:selected.date.start_date | filter:$viewValue\"\n" +
    "                required placeholder=\"To\" />\n" +
    "        <button class=\"btn btn-default\"\n" +
    "                ng-disabled=\"yearInputForm.$invalid || ((selected.date.end_date - selected.date.start_date) > 2) || filterHasDate()\"\n" +
    "                ng-click=\"addDateRangeToFilter()\"><i class=\"fa fa-plus\"></i></button>\n" +
    "        </form>\n" +
    "    </li>\n" +
    "    <li class=\"divider\"></li>\n" +
    "    <li>\n" +
    "        <label for=\"species\">Species</label>\n" +
    "        <input id=\"species\"\n" +
    "               type=\"text\" class=\"form-control\"\n" +
    "               placeholder=\"Add Species To Filter\"\n" +
    "               typeahead=\"sp as sp.$display for sp in findSpecies()  | filter:{common_name:$viewValue} | limitTo:10\"\n" +
    "               typeahead-loading=\"findingSpecies\"\n" +
    "               ng-model=\"selected.addSpecies\"\n" +
    "               ng-disabled=\"findSpeciesParamsEmpty || !filterHasDate()\" />\n" +
    "        <button class=\"btn btn-default\" ng-disabled=\"!selected.speciesToAdd\"\n" +
    "                ng-click=\"addSpeciesToFilter(selected.speciesToAdd)\">\n" +
    "            <i class=\"fa\" ng-class=\"{'fa-refresh fa-spin': findingSpecies, 'fa-plus': !findingSpecies}\"></i>\n" +
    "        </button>\n" +
    "    </li>\n" +
    "    <li>\n" +
    "        <label>Animal Types</label>\n" +
    "        <div isteven-multi-select\n" +
    "            max-labels=\"3\"\n" +
    "            input-model=\"animalTypes\"\n" +
    "            output-model=\"animals\"\n" +
    "            button-label=\"species_type\"\n" +
    "            item-label=\"species_type\"\n" +
    "            tick-property=\"selected\"\n" +
    "            orientation=\"horizontal\"\n" +
    "            is-disabled=\"!filterHasDate()\"\n" +
    "            helper-elements=\"all none reset filter\"></div>\n" +
    "    </li>\n" +
    "    <li>\n" +
    "        <label>Plant Types</label>\n" +
    "        <div isteven-multi-select\n" +
    "            max-labels=\"3\"\n" +
    "            input-model=\"plantTypes\"\n" +
    "            output-model=\"plants\"\n" +
    "            button-label=\"species_type\"\n" +
    "            item-label=\"species_type\"\n" +
    "            tick-property=\"selected\"\n" +
    "            orientation=\"horizontal\"\n" +
    "            is-disabled=\"!filterHasDate()\"\n" +
    "            helper-elements=\"all none reset filter\"></div>\n" +
    "    </li>\n" +
    "    <li>\n" +
    "        <label>Partners</label>\n" +
    "        <div isteven-multi-select\n" +
    "            max-labels=\"1\"\n" +
    "            input-model=\"partners\"\n" +
    "            output-model=\"networks\"\n" +
    "            button-label=\"network_name\"\n" +
    "            item-label=\"network_name\"\n" +
    "            tick-property=\"selected\"\n" +
    "            orientation=\"horizontal\"\n" +
    "            is-disabled=\"!filterHasDate()\"\n" +
    "            selection-mode=\"single\"></div>\n" +
    "    </li>\n" +
    "</ul>\n" +
    "");
}]);

angular.module("js/filter/filterTags.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/filterTags.html",
    "<ul class=\"list-inline filter-tags\">\n" +
    "    <li ng-repeat=\"(key, value) in getFilter()\">\n" +
    "        <species-filter-tag ng-if=\"value.species_id\" item=\"value\"></species-filter-tag>\n" +
    "        <date-filter-tag ng-if =\"value.start_date && value.end_date\" item=\"value\"></date-filter-tag>\n" +
    "    </li>\n" +
    "</ul>");
}]);

angular.module("js/filter/speciesFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/speciesFilterTag.html",
    "<div class=\"btn-group filter-tag\" ng-class=\"{open: status.isopen}\">\n" +
    "    <button type=\"button\" class=\"btn btn-primary\" style=\"background-color: {{item.color}};\" ng-disabled=\"!item.phenophases\" ng-click=\"status.isopen = !status.isopen\">\n" +
    "        {{item.common_name}} <span class=\"badge\">{{count}}</span> <span class=\"caret\"></span>\n" +
    "    </button>\n" +
    "    <ul class=\"dropdown-menu phenophase-list\" role=\"menu\">\n" +
    "        <li class=\"inline\">Select <a href ng-click=\"selectAll(true)\">all</a> <a href ng-click=\"selectAll(false)\">none</a></li>\n" +
    "        <li class=\"divider\"></li>\n" +
    "        <li ng-repeat=\"phenophase in item.phenophases\">\n" +
    "            <input type=\"checkbox\" ng-model=\"phenophase.selected\"> <span class=\"badge\">{{phenophase.count}}</span> {{phenophase.phenophase_name}}\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "    <button class=\"btn btn-primary\" style=\"background-color: {{item.color}};\" ng-click=\"removeFromFilter(item)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </button>\n" +
    "</div>");
}]);

angular.module("js/map/map.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/map/map.html",
    "<ui-gmap-google-map ng-if=\"map\" center='map.center' zoom='map.zoom' options=\"map.options\">\n" +
    "    <npn-stations ng-if=\"stationView\"></npn-stations>\n" +
    "    <npn-filter-results></npn-filter-results>\n" +
    "</ui-gmap-google-map>\n" +
    "\n" +
    "<filter-tags></filter-tags>\n" +
    "\n" +
    "<toolbar>\n" +
    "    <tool id=\"filter\" icon=\"fa-search\" title=\"Filter\">\n" +
    "        <filter-control></filter-control>\n" +
    "    </tool>\n" +
    "    <tool id=\"layers\" icon=\"fa-bars\" title=\"Layers\">\n" +
    "        layer content\n" +
    "    </tool>\n" +
    "    <tool id=\"visualizations\" icon=\"fa-bar-chart\" title=\"Visualizations\">\n" +
    "        visualization content\n" +
    "    </tool>\n" +
    "    <tool id=\"settings\" icon=\"fa-cog\" title=\"Settings\">\n" +
    "        settings content\n" +
    "    </tool>\n" +
    "</toolbar>");
}]);

angular.module("js/toolbar/tool.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/toolbar/tool.html",
    "<div class=\"tool-content {{title.toLowerCase()}}\" ng-show=\"selected\">\n" +
    "    <h2>{{title}}</h2>\n" +
    "    <div ng-transclude>\n" +
    "    </div>\n" +
    "</div>");
}]);

angular.module("js/toolbar/toolbar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/toolbar/toolbar.html",
    "<div class=\"toolbar\">\n" +
    "  <ul class=\"tools-list\">\n" +
    "    <li ng-repeat=\"t in tools\" ng-class=\"{open: t.selected}\"\n" +
    "        popover-placement=\"right\" popover=\"{{t.title}}\" popover-trigger=\"mouseenter\" popover-popup-delay=\"1000\"\n" +
    "        ng-click=\"select(t)\">\n" +
    "      <i class=\"fa {{t.icon}}\"></i>\n" +
    "    </li>\n" +
    "  </ul>\n" +
    "  <div class=\"toolbar-content\" ng-class=\"{open: open}\" ng-transclude></div>\n" +
    "</div>");
}]);

// roll LayerService into layer sub-directory rather than within a "services" module.
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
        /**
         * Forces all features to be restyled.
         *
         * @return {promise} A promise that will be resolved once features have been restyled.
         */
        restyleLayers: function() {
            var def = $q.defer();
            readyPromise.then(function(){
                restyleSync();
                def.resolve();
            });
            return def.promise;
        },
        /**
         * Removes all map layers.
         *
         * @return {promise} A promise that will be resolved when complete.
         */
        resetLayers: function() {
            var def = $q.defer();
            readyPromise.then(function(){
                for(var label in layers) {
                    var layer = layers[label],i;
                    if(layer.loaded) {
                        for(i = 0; i < layer.loaded.length; i++) {
                            layer.loaded[i].removeProperty('$style');
                            map.data.remove(layer.loaded[i]);
                        }
                        delete layer.loaded;
                    }
                }
                def.resolve();
            });
            return def.promise;
        },
        /**
         * Loads and adds a layer to the map.
         *
         * @param  {string} label The label of the layer to add.
         * @param  {object|function} style (optional) If an object is a set of style overrides to apply to all added features
         *                           (https://developers.google.com/maps/documentation/javascript/datalayer#style_options).
         *                           If a function is provided then its signature it will be called when styling features so
         *                           that all features can be individually styled as in
         *                           https://developers.google.com/maps/documentation/javascript/datalayer#declarative_style_rules.
         *                           This parameter will be stored and re-used so it can be re-applied during calls to restyleLayers.
         *                           Keep this in mind if you pass a function and your code may go out of scope.
         * @return {promise}       A promise that will be resolved when the layer has been added and its features styled.
         */
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
angular.module('npn-viz-tool.stations',[
    'npn-viz-tool.services'
])
.directive('npnStations',['$http','LayerService',function($http,LayerService){
    return {
        restrict: 'E',
        template: '<ui-gmap-markers models="stations.markers" idKey="\'station_id\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" doCluster="true"></ui-gmap-markers>',
        scope: {
        },
        controller: ['$scope',function($scope) {
            $scope.stations = {
                states: [],
                markers: []
            };
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
                    LayerService.loadLayer('US States',function(feature) {
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
                        } else if (!loaded) {
                            console.warn('no station count for '+name);
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
                                                title: d.station_name
                                            };
                                        });
                                        $scope.stations.markers = $scope.stations.markers.concat(data);
                                        // simply drop the feature as opposed to re-styling it
                                        map.data.remove(event.feature);
                                    });
                            }
                        }));
                        /* can't explain why can't read c.visited here since
                         * the other two log statements show the attribute as being there
                         * but when iterating it's not there, even in a loop...
                        var unvisited = counts.filter(function(c){
                            return !c.visited;
                        });
                        console.log('counts',counts);
                        console.log('countMap',countMap);
                        console.log('unvisited',unvisited);
                        */
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
angular.module('npn-viz-tool.toolbar',[
])
.directive('toolbar', ['$rootScope',function($rootScope) {
  return {
    restrict: 'E',
    templateUrl: 'js/toolbar/toolbar.html',
    transclude: true,
    scope: {},
    controller: function($scope) {
      var tools = $scope.tools = [];

      $scope.select = function(t) {
        t.selected = !t.selected;
        $scope.open = t.selected;
        // broadcast an event for open/close that others can listen to
        $rootScope.$broadcast('tool-'+(t.selected ? 'open' : 'close'),{
          tool: t
        });
      };

      this.addTool = function(t) {
        /* TEMPORARY when devloping a specific tab */
        if(tools.length === 0) {
          $scope.select(t);
        }
        tools.push(t);
      };
    }
  };
}])
.directive('tool', [function() {
  return {
    restrict: 'E',
    require: '^toolbar',
    templateUrl: 'js/toolbar/tool.html',
    transclude: true,
    scope: {
      id: '@',
      title: '@',
      icon: '@'
    },
    link: function(scope, element, attrs, tabsCtrl) {
      tabsCtrl.addTool(scope);
    }
  };
}]);