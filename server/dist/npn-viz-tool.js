/*
 * Regs-Dot-Gov-Directives
 * Version: 0.1.0 - 2015-03-09
 */

angular.module('npn-viz-tool.filter',[
    'npn-viz-tool.settings',
    'isteven-multi-select'
])
/**
 * Base class for any part of the  base filter
 */
.factory('FilterArg',[function(){
    /**
     * Base abstract constructor.
     * @param {[type]} arg An opaque object this filter argument wraps (e.g. a species, date range or GeoJson feature object)
     */
    var FilterArg = function(arg) {
        this.arg = arg;
    };
    FilterArg.prototype.getArg = function() {
        return this.arg;
    };
    FilterArg.prototype.$filter = function(input) {
        return true;
    };
    return FilterArg;
}])
.factory('DateFilterArg',['FilterArg',function(FilterArg){
    /**
     * Constructs a DateFilterArg.  This type of arg is used server side only (on input parameters)
     * and as such does not over-ride $filter.
     *
     * @param {Object} range {start_date: <year>, end_date: <year>}
     */
    var DateFilterArg = function(range) {
        FilterArg.apply(this,arguments);
    };
    DateFilterArg.prototype.getId = function() {
        return 'date';
    };
    DateFilterArg.prototype.getStartDate = function() {
        return this.arg.start_date+'-01-01';
    };
    DateFilterArg.prototype.getEndDate = function() {
        return this.arg.end_date+'-12-31';
    };
    DateFilterArg.prototype.toString = function() {
        return this.arg.start_date+'-'+this.arg.end_date;
    };
    DateFilterArg.fromString = function(s) {
        var dash = s.indexOf('-');
        return new DateFilterArg({
                start_date: s.substring(0,dash),
                end_date: s.substring(dash+1)
            });
    };
    return DateFilterArg;
}])
.factory('SpeciesFilterArg',['$http','$rootScope','FilterArg',function($http,$rootScope,FilterArg){
    /**
     * Constructs a SpeciesFilterArg.  This type of arg spans both side of the wire.  It's id is used as input
     * to web services and its $filter method deals with post-processing phenophase filtering.  It exposes additional
     * top level attributes; count:{station:?,observation:?}, phenophases (array) and phenophaseMap (map).  Upon instantiation
     * phenophases are chased.
     *
     * @param {Object} species A species record as returned by getSpeciesFilter.json.
     */
    var SpeciesFilterArg = function(species,selectedPhenoIds) {
        FilterArg.apply(this,arguments);
        this.counts = {
            station: '?',
            observation: '?'
        };
        if(selectedPhenoIds && selectedPhenoIds != '*') {
            this.phenophaseSelections = selectedPhenoIds.split(',');
        }
        var self = this;
        $http.get('/npn_portal/phenophases/getPhenophasesForSpecies.json',{ // cache ??
                params: {
                    return_all: true,
                    //date: FilterService.getDate().end_date+'-12-31',
                    species_id: self.arg.species_id
                }
            }).success(function(phases) {
                var seen = {}; // the call returns redundant data so filter it out.
                self.phenophases = phases[0].phenophases.filter(function(pp){
                    if(seen[pp.phenophase_id]) {
                        return false;
                    }
                    seen[pp.phenophase_id] = pp;
                    pp.selected = !self.phenophaseSelections || self.phenophaseSelections.indexOf(pp.phenophase_id) != -1;
                    return true;
                });
                self.phenophasesMap = {}; // create a map for faster lookup during filtering.
                angular.forEach(self.phenophases,function(pp){
                    self.phenophasesMap[pp.phenophase_id] = pp;
                });
                $rootScope.$broadcast('species-filter-ready',{filter:self});
            });
    };
    SpeciesFilterArg.prototype.getId = function() {
        return parseInt(this.arg.species_id);
    };
    SpeciesFilterArg.prototype.resetCounts = function(c) {
        this.counts.station = this.counts.observation = c;
        angular.forEach(this.phenophases,function(pp){
            pp.count = 0;
        });
    };
    SpeciesFilterArg.prototype.$filter = function(species) {
        var self = this,
            hitCount = 0;
        if(species.species_id != self.arg.species_id) {
            console.warn('$filter called on wrong species', self.arg, species);
        }
        var filtered = species.phenophases.filter(function(pp) {
            self.phenophasesMap[pp.phenophase_id].count++;
            if(self.phenophasesMap[pp.phenophase_id].selected) {
                hitCount++;
            }
            return self.phenophasesMap[pp.phenophase_id].selected;
        });
        if(filtered.length > 0) {
            self.counts.station++;
        }
        self.counts.observation += hitCount;
        return hitCount;
    };
    SpeciesFilterArg.prototype.toString = function() {
        var s = this.arg.species_id+':',
            selected = this.phenophases.filter(function(pp){
                return pp.selected;
            });
        if(selected.length === this.phenophases.length) {
            s += '*';
        } else {
            selected.forEach(function(pp,i){
                s += (i>0?',':'')+pp.phenophase_id;
            });
        }
        return s;
    };
    SpeciesFilterArg.fromString = function(s) {
        var colon = s.indexOf(':'),
            sid = s.substring(0,colon),
            ppids = s.substring(colon+1);
        return $http.get('/npn_portal/species/getSpeciesById.json',{
            params: {
                species_id: sid
            }
        }).then(function(response){
            // odd that this ws call doesn't return the species_id...
            response.data['species_id'] = sid;
            return new SpeciesFilterArg(response.data,ppids);
        });
    };
    return SpeciesFilterArg;
}])
.factory('GeoFilterArg',['FilterArg',function(FilterArg){
    function geoContains(point,geo) {
        var polyType = geo.getType(),
            poly,arr,i;
        if(polyType == 'Polygon') {
            poly = new google.maps.Polygon({paths: geo.getArray()[0].getArray()});
            return google.maps.geometry.poly.containsLocation(point,poly) ||
                   google.maps.geometry.poly.isLocationOnEdge(point,poly);
        } else if (polyType === 'MultiPolygon' || polyType == 'GeometryCollection') {
            arr = geo.getArray();
            for(i = 0; i < arr.length; i++) {
                if(geoContains(point,arr[i])) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Constructs a GeoFilterArg.  This is just a post-processing type of filter argument which tests
     * to see if markers (stations) are within a GeoJson feature (Polygon or set of Polygons).
     *
     * @param {Object} feature A Google Maps GeoJson Feature object.
     */
    var GeoFilterArg = function(feature,sourceId){
        FilterArg.apply(this,arguments);
        this.sourceId = sourceId;
    };
    GeoFilterArg.prototype.getId = function() {
        return this.arg.getProperty('NAME');
    };
    GeoFilterArg.prototype.getSourceId = function() {
        return this.sourceId;
    };
    GeoFilterArg.prototype.$filter = function(marker) {
        return geoContains(new google.maps.LatLng(parseFloat(marker.latitude), parseFloat(marker.longitude)),this.arg.getGeometry());
    };
    GeoFilterArg.prototype.toString = function() {
        return this.sourceId+':'+this.arg.getProperty('NAME');
    };
    return GeoFilterArg;
}])
.factory('NpnFilter',['DateFilterArg','SpeciesFilterArg','GeoFilterArg',function(DateFilterArg,SpeciesFilterArg,GeoFilterArg){
    function getValues(map) {
        var vals = [],key;
        for(key in map) {
            vals.push(map[key]);
        }
        return vals;
    }
    /**
     * Constructs an NpnFilter.  An NpnFilter has multiple different parts.  A single date range (DateFilterArg),
     * a list of 1 or more species (SpeciesFilterArg) and zero or more geographic filters (GeoFilterArgs).
     */
    var NpnFilter = function(){
        this.reset();
    };
    NpnFilter.prototype.hasDate = function() {
        return !!this.date;
    };
    NpnFilter.prototype.hasCriteria = function() {
        if(this.date) {
            return true;
        }
        return Object.keys(this.species).length > 0;
    };
    NpnFilter.prototype.hasSufficientCriteria = function() {
        return this.date && Object.keys(this.species).length > 0;
    };
    NpnFilter.prototype.getDateArg = function() {
        return this.date;
    };
    NpnFilter.prototype.getSpeciesArg = function(id) {
        return this.species[id];
    };
    NpnFilter.prototype.getSpeciesArgs = function() {
        return getValues(this.species);
    };
    NpnFilter.prototype.getCriteria = function() {
        var criteria = getValues(this.species);
        if(this.date) {
            criteria.append(this.date);
        }
        return criteria;
    };
    NpnFilter.prototype.getGeoArgs = function() {
        return getValues(this.geo);
    };
    NpnFilter.prototype.add = function(item) {
        if(item instanceof DateFilterArg) {
            this.date = item;
        } else if (item instanceof SpeciesFilterArg) {
            this.species[item.getId()] = item;
        } else if (item instanceof GeoFilterArg) {
            this.geo[item.getId()] = item;
        }
        return (!(item instanceof GeoFilterArg));
    };
    NpnFilter.prototype.remove = function(item) {
        if(item instanceof DateFilterArg) {
            this.date = undefined;
            this.species = {}; // removal of date invalidates filter.
        } else if(item instanceof SpeciesFilterArg) {
            delete this.species[item.getId()];
        } else if(item instanceof GeoFilterArg) {
            delete this.geo[item.getId()];
        }
        return (!(item instanceof GeoFilterArg));
    };
    NpnFilter.prototype.reset = function() {
        this.date = undefined;
        this.species = {};
        this.geo = {};
    };
    return NpnFilter;
}])
/**
 * TODO - need to nail down the event model and probably even formalize it via a service because it's all
 * pretty loosey goosey at the moment.  Bad enough duplicating strings around...
 */
.factory('FilterService',['$q','$http','$rootScope','$timeout','uiGmapGoogleMapApi','NpnFilter',
    function($q,$http,$rootScope,$timeout,uiGmapGoogleMapApi,NpnFilter){
    // NOTE: this scale is limited to 20 colors
    var colorScale = d3.scale.category20(),
        filter = new NpnFilter(),
        paused = false,
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
    function getFilterParams() {
        if(filter.hasCriteria()) {
            var params = {},
                date = filter.getDateArg();
            if(date) {
                params['start_date'] = date.getStartDate();
                params['end_date'] = date.getEndDate();
            }
            filter.getSpeciesArgs().forEach(function(arg,i){
                params['species_id['+(i)+']'] = arg.getId();
            });
            return params;
        }
    }
    $rootScope.$on('filter-rerun-phase2',function(event,data){
        if(!paused) {
            $timeout(function(){
                if(last) {
                    var markers = post_filter(last);
                    $rootScope.$broadcast('filter-marker-updates',{markers: markers});
                }
            },500);
        }
    });
    function post_filter(markers) {
        $rootScope.$broadcast('filter-phase2-start',{
            count: markers.length
        });
        var observationCount = 0,
            geos = filter.getGeoArgs(),
            filtered =  markers.filter(function(station){
                station.markerOpts.icon.fillColor = defaultIcon.fillColor;
                var i,sid,speciesFilter,keeps = 0,
                    n,hitMap = {};

                if(geos.length > 0) {
                    var gid,hit = false;
                    for(i = 0; i < geos.length; i++) {
                        if((hit=geos[i].$filter(station))) {
                            break;
                        }
                    }
                    if(!hit) {
                        return false;
                    }
                }

                for(sid in station.species) {
                    speciesFilter = filter.getSpeciesArg(sid);
                    hitMap[sid] = 0;
                    if(!speciesFilter) {
                        console.warn('species found in results but not in filter',station.species[sid]);
                        continue;
                    }
                    if((n=speciesFilter.$filter(station.species[sid]))) {
                        observationCount += n;
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
            station: filtered.length,
            observation: observationCount
        });
        return filtered;
    }
    function execute() {
        var def = $q.defer(),
            filterParams = getFilterParams();
        if(!paused && filterParams) {
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
    function broadcastFilterReset() {
        $rootScope.$broadcast('filter-reset',{});
    }
    function updateColors() {
        filter.getSpeciesArgs().forEach(function(arg,i){
            arg.color = colorScale(i);
        });
    }
    return {
        execute: execute,
        pause: function() {
            paused = true;
        },
        resume: function() {
            paused = false;
            broadcastFilterUpdate();
        },
        getFilter: function() {
            return filter;
        },
        isFilterEmpty: function() {
            return !filter.hasCriteria();
        },
        hasDate: function() {
            return filter.hasDate();
        },
        hasSufficientCriteria: function() {
            return filter.hasSufficientCriteria();
        },
        addToFilter: function(item) {
            if(filter.add(item)) {
                updateColors();
                broadcastFilterUpdate();
            }
        },
        removeFromFilter: function(item) {
            if(filter.remove(item)) {
                if(filter.hasCriteria()) {
                    broadcastFilterUpdate();
                } else {
                    broadcastFilterReset();
                }
            }
        },
        resetFilter: function() {
            filter.reset();
            broadcastFilterReset();
        }
    };
}])
.directive('npnFilterResults',['$rootScope','$http','FilterService','SettingsService',function($rootScope,$http,FilterService,SettingsService){
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
            $scope.doCluster = SettingsService.getSettingValue('clusterMarkers');
            $scope.$on('setting-update-clusterMarkers',function(event,data){
                $scope.doCluster = data.value;
            });
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
.filter('speciesBadge',function(){
    return function(counts,format){
        if(format === 'observation-count') {
            return counts.observation;
        }
        if(format === 'station-count') {
            return counts.station;
        }
        if(format === 'station-observation-count') {
            return counts.station+'/'+counts.observation;
        }
        return counts;
    };
})
.filter('speciesTitle',function(){
    return function(item,format) {
        if(format === 'common-name') {
            return item.common_name;
        } else if (format === 'genus-species') {
            return item.genus+' '+item.species;
        }
        return item;
    };
})
.directive('speciesFilterTag',['$rootScope','FilterService','SettingsService','SpeciesFilterArg',function($rootScope,FilterService,SettingsService,SpeciesFilterArg){
    return {
        restrict: 'E',
        require: '^filterTags',
        templateUrl: 'js/filter/speciesFilterTag.html',
        scope: {
            arg: '='
        },
        controller: function($scope){
            $scope.titleFormat = SettingsService.getSettingValue('tagSpeciesTitle');
            $scope.$on('setting-update-tagSpeciesTitle',function(event,data){
                $scope.titleFormat = data.value;
            });
            $scope.badgeFormat = SettingsService.getSettingValue('tagBadgeFormat');
            $scope.$on('setting-update-tagBadgeFormat',function(event,data){
                $scope.badgeFormat = data.value;
            });
            $scope.$on('filter-phase2-start',function(event,data) {
                $scope.arg.resetCounts(0);
            });
            $scope.$on('filter-phase1-start',function(event,data) {
                $scope.arg.resetCounts('?');
            });
            $scope.removeFromFilter = FilterService.removeFromFilter;
            $scope.status = {
                isopen: false
            };
            // TODO - leaky
            // keep track of selected phenophases during open/close of the list
            // if on close something changed ask that the currently filtered data
            // be re-filtered.
            var saved_pheno_state;
            $scope.$watch('status.isopen',function() {
                if($scope.status.isopen) {
                    saved_pheno_state = $scope.arg.phenophases.map(function(pp) { return pp.selected; });
                } else if (saved_pheno_state) {
                    for(var i = 0; i < saved_pheno_state.length; i++) {
                        if(saved_pheno_state[i] != $scope.arg.phenophases[i].selected) {
                            $rootScope.$broadcast('filter-rerun-phase2',{});
                            break;
                        }
                    }
                }
            });
            $scope.selectAll = function(state) {
                angular.forEach($scope.arg.phenophases,function(pp){
                    pp.selected = state;
                });
            };
        }
    };
}])
.directive('dateFilterTag',['FilterService','SettingsService',function(FilterService,SettingsService){
    return {
        restrict: 'E',
        require: '^filterTags',
        templateUrl: 'js/filter/dateFilterTag.html',
        scope: {
            arg: '='
        },
        controller: function($scope){
            $scope.badgeFormat = SettingsService.getSettingValue('tagBadgeFormat');
            $scope.$on('setting-update-tagBadgeFormat',function(event,data){
                $scope.badgeFormat = data.value;
            });
            $scope.removeFromFilter = FilterService.removeFromFilter;
            $scope.counts = {
                station: '?',
                observation: '?'
            };
            $scope.$on('filter-phase1-start',function(event,data) {
                $scope.counts.station = $scope.counts.observation = '?';
            });
            $scope.$on('filter-phase2-start',function(event,data) {
                $scope.counts.station = $scope.counts.observation = 0;
            });
            $scope.$on('filter-phase2-end',function(event,data) {
                $scope.counts = data;
            });
        }
    };
}])
.directive('filterControl',['$http','$filter','FilterService','DateFilterArg','SpeciesFilterArg',function($http,$filter,FilterService,DateFilterArg,SpeciesFilterArg){
    return {
        restrict: 'E',
        templateUrl: 'js/filter/filterControl.html',
        controller: ['$scope',function($scope) {

            $scope.addDateRangeToFilter = function() {
                FilterService.addToFilter(new DateFilterArg($scope.selected.date));
            };

            $scope.filterHasDate = FilterService.hasDate;
            $scope.filterHasSufficientCriteria = FilterService.hasSufficientCriteria;
            var thisYear = (new Date()).getYear()+1900,
                validYears = [];
            for(var i = 2008; i <= thisYear; i++) {
                validYears.push(i);
            }
            $scope.thisYear = thisYear;
            $scope.validYears = validYears;

            $scope.selected = {addSpecies: undefined, date: {
                start_date: (thisYear-1),
                end_date: thisYear
            }};

            $scope.addSpeciesToFilter = function(species) {
                FilterService.addToFilter(new SpeciesFilterArg(species));
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
angular.module('npn-viz-tool.filters',[
])
.filter('cssClassify',function(){
    return function(input) {
        if(typeof(input) === 'string') {
            return input.trim().toLowerCase().replace(/\s+/g,'-');
        }
        return input;
    };
})
.filter('yesNo',function(){
    return function(input) {
        return input ? 'Yes' : 'No';
    };
})
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
angular.module('npn-viz-tool.layers',[
'npn-viz-tool.filter',
'ngResource'
])
.factory('LayerService',['$rootScope','$http','$q','uiGmapIsReady',function($rootScope,$http,$q,uiGmapIsReady){
    var layers = null,
        map = null,
        readyPromise = uiGmapIsReady.promise(1).then(function(instances){
            map = instances[0].map;
            console.log('LayerService - map is ready');
            return $http.get('layers/layers.json').success(function(data) {
                layers = {};
                data.forEach(function(layer,idx){
                    layer.index = idx;
                    layers[layer.id] = layer;
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
    function calculateCenter(feature) {
        if(!feature.properties.CENTER) {
            // [0], per GeoJson spec first array in Polygon coordinates is
            // external ring, other indices are internal rings or "holes"
            var geo = feature.geometry,
                coordinates = geo.type === 'Polygon' ?
                    geo.coordinates[0] :
                    geo.coordinates.reduce(function(p,c){
                        return p.concat(c[0]);
                    },[]),
                i,coord,
                mxLat,mnLat,mxLon,mnLon;
            for(i = 0; i < coordinates.length; i++) {
                coord = coordinates[i];
                if(i === 0) {
                    mxLon = mnLon = coord[0];
                    mxLat = mnLat = coord[1];
                } else {
                    mxLon = Math.max(mxLon,coord[0]);
                    mnLon = Math.min(mnLon,coord[0]);
                    mxLat = Math.max(mxLat,coord[1]);
                    mnLat = Math.min(mnLat,coord[1]);
                }
            }
            feature.properties.CENTER = {
                latitude: (mnLat+((mxLat-mnLat)/2)),
                longitude: (mnLon+((mxLon-mnLon)/2))
            };
        }
    }
    function loadLayerData(layer) {
        var def = $q.defer();
        if(layer.data) {
            def.resolve(layer);
        } else {
            $rootScope.$broadcast('layer-load-start',{});
            $http.get('layers/'+layer.file).success(function(data){
                if(data.type === 'GeometryCollection') {
                    console.log('Translating GeometryCollection to FeatureCollection');
                    // translate to FeatureCollection
                    data.features = [];
                    angular.forEach(data.geometries,function(geo,idx){
                        data.features.push({
                            type: 'Feature',
                            properties: { NAME: ''+idx },
                            geometry: geo
                        });
                    });
                    data.type = 'FeatureCollection';
                    delete data.geometries;
                }
                // calculate centers
                data.features.forEach(calculateCenter);
                layer.data = data;
                def.resolve(layer);
                $rootScope.$broadcast('layer-load-end',{});
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

    function unloadLayer(layer) {
        if(layer.loaded) {
            var unloaded = [];
            for(var i = 0; i < layer.loaded.length; i++) {
                layer.loaded[i].removeProperty('$style');
                map.data.remove(layer.loaded[i]);
                unloaded.push(layer.loaded[i]);
            }
            delete layer.loaded;
            return unloaded;
        }
    }

    return {
        /**
         * @return {Array} A copy of the list of layers as a flat array.
         */
        getAvailableLayers: function() {
            var def = $q.defer();
            readyPromise.then(function(){
                var key,l,arr = [];
                for(key in layers) {
                    l = layers[key];
                    arr.push({
                        id: l.id,
                        index: l.index,
                        label: l.label,
                        source: l.source,
                        img: l.img,
                        link: l.link
                    });
                }
                def.resolve(arr.sort(function(a,b){
                    return a.idx - b.idx;
                }));
            });
            return def.promise;
        },
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
                for(var id in layers) {
                    unloadLayer(layers[id]);
                }
                def.resolve();
            });
            return def.promise;
        },
        /**
         * Loads and adds a layer to the map.
         *
         * @param  {string} id The id of the layer to add.
         * @param  {object|function} style (optional) If an object is a set of style overrides to apply to all added features
         *                           (https://developers.google.com/maps/documentation/javascript/datalayer#style_options).
         *                           If a function is provided then its signature it will be called when styling features so
         *                           that all features can be individually styled as in
         *                           https://developers.google.com/maps/documentation/javascript/datalayer#declarative_style_rules.
         *                           This parameter will be stored and re-used so it can be re-applied during calls to restyleLayers.
         *                           Keep this in mind if you pass a function and your code may go out of scope.
         * @return {promise}       A promise that will be resolved when the layer has been added and its features styled.
         */
        loadLayer: function(id,style) {
            var def = $q.defer();
            readyPromise.then(function(){
                var layer = layers[id];
                if(!layer) {
                    console.log('no such layer with id',id);
                    return def.reject(id);
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
        },
        unloadLayer: function(id) {
            var def = $q.defer();
            readyPromise.then(function(){
                var layer = layers[id];
                if(!layer) {
                    console.log('no such layer with id',id);
                    return def.reject(id);
                }
                var unloaded = unloadLayer(layer);
                def.resolve(unloaded);
            });
            return def.promise;
        }
    };
}])
.directive('layerControl',['$rootScope','$q','$location','LayerService','FilterService','GeoFilterArg',function($rootScope,$q,$location,LayerService,FilterService,GeoFilterArg){
    return {
        restrict: 'E',
        templateUrl: 'js/layers/layerControl.html',
        controller: function($scope) {
            var eventListeners = [],
                lastFeature;

            function reset() {
                $scope.layerOnMap = {
                    layer: 'none'
                };
            }
            reset();
            $scope.$on('filter-reset',reset);

            LayerService.getAvailableLayers().then(function(layers){
                function broadcastLayersReady() {
                    $rootScope.$broadcast('layers-ready',{});
                }
                console.log('av.layers',layers);
                $scope.layers = layers;
                var qargs = $location.search();
                if(qargs['g']) {
                    console.log('init layers from query arg',qargs['g']);
                    // only one layer at a time is supported so the "first" id is sufficient.
                    var featureList = qargs['g'].split(';'),
                        featureIds = featureList.map(function(f) {
                            return f.substring(f.indexOf(':')+1);
                        }),
                        layerId = featureList[0].substring(0,featureList[0].indexOf(':')),
                        lyr,i;
                    for(i = 0; i < layers.length; i++) {
                        if(layers[i].id === layerId) {
                            lyr = layers[i];
                            break;
                        }
                    }
                    if(lyr) {
                        loadLayer(lyr).then(function(results) {
                            var map = results[0],
                                features = results[1];
                            $scope.layerOnMap.skipLoad = true;
                            $scope.layerOnMap.layer = lyr; // only update this -after- the fact
                            features.forEach(function(f) {
                                if(featureIds.indexOf(f.getProperty('NAME')) != -1) {
                                    clickFeature(f,map);
                                }
                            });
                            broadcastLayersReady();
                        });
                    }
                } else {
                    broadcastLayersReady();
                }
            });

            function clickFeature(feature,map) {
                // TODO "NAME" may or may not be suitable, probably should use id...
                var name = feature.getProperty('NAME'),
                    filterArg = feature.getProperty('$FILTER');
                lastFeature = feature;
                if(!filterArg) {
                    filterArg = new GeoFilterArg(feature,$scope.layerOnMap.layer.id);
                    FilterService.addToFilter(filterArg);
                    // TODO - different layers will probably have different styles, duplicating hard coded color...
                    // over-ride so the change shows up immediately and will be applied on the restyle (o/w there's a pause)
                    map.data.overrideStyle(feature, {fillColor: '#800000'});
                } else {
                    FilterService.removeFromFilter(filterArg);
                    filterArg = null;
                }
                feature.setProperty('$FILTER',filterArg);
                LayerService.restyleLayers().then(function(){
                    // TODO - maybe instead the filter should just broadcast the "end" event
                    if(!FilterService.isFilterEmpty()) {
                        $rootScope.$broadcast('filter-rerun-phase2',{});
                    }
                });
            }


            $scope.$watch('layerOnMap.layer',function(newLayer,oldLayer){
                if($scope.layerOnMap.skipLoad) {
                    $scope.layerOnMap.skipLoad = false;
                    return;
                }
                if(oldLayer && oldLayer != 'none') {
                    LayerService.unloadLayer(oldLayer.id).then(function(unloaded){
                        var filterUpdate = false;
                        unloaded.forEach(function(feature) {
                            var filterArg = feature.getProperty('$FILTER');
                            if(filterArg) {
                                filterUpdate = true;
                                FilterService.removeFromFilter(filterArg);
                                feature.setProperty('$FILTER',null);
                            }
                        });
                        // TODO - maybe instead the filter should just broadcast the "end" event
                        if(filterUpdate && !FilterService.isFilterEmpty()) {
                            $rootScope.$broadcast('filter-rerun-phase2',{});
                        }
                        loadLayer(newLayer);
                    });
                } else if(newLayer){
                    loadLayer(newLayer);
                }
            });

            function loadLayer(layer) {
                var def = $q.defer();
                if(layer === 'none') {
                    return def.resolve(null);
                }
                LayerService.loadLayer(layer.id,function(feature) {
                    var style = {
                            strokeOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 1,
                            fillOpacity: 0
                        };
                    if(feature.getProperty('$FILTER')) {
                        style.fillColor = '#800000';
                        style.fillOpacity = 0.5;
                    }
                    return style;
                })
                .then(function(results){
                    if(!eventListeners.length) {
                        var map = results[0];
                        // this feels kind of like a workaround since the markers aren't
                        // refreshed until the map moves so forcibly moving the map
                        $scope.$on('filter-phase2-end',function(event,data) {
                            if(lastFeature) {
                                var center = lastFeature.getProperty('CENTER');
                                map.panTo(new google.maps.LatLng(center.latitude,center.longitude));
                                lastFeature = null;
                            }
                        });
                        eventListeners.push(map.data.addListener('mouseover',function(event){
                            map.data.overrideStyle(event.feature, {strokeWeight: 3});
                        }));
                        eventListeners.push(map.data.addListener('mouseout',function(event){
                            map.data.revertStyle();
                        }));
                        eventListeners.push(map.data.addListener('click',function(event){
                            $scope.$apply(function(){
                                clickFeature(event.feature,map);
                            });

                        }));
                    }
                    def.resolve(results);
                });
                return def.promise;
            }
            // shouldn't happen
            $scope.$on('$destroy',function(){
                LayerService.resetLayers();
                eventListeners.forEach(function(el){
                    el.remove();
                });
            });
        }
    };
}]);
angular.module('npn-viz-tool',[
'templates-npnvis',
'npn-viz-tool.map',
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
    'npn-viz-tool.layers',
    'npn-viz-tool.stations',
    'npn-viz-tool.toolbar',
    'npn-viz-tool.filter',
    'npn-viz-tool.settings',
    'npn-viz-tool.vis',
    'npn-viz-tool.share',
    'uiGmapgoogle-maps'
])
.directive('npnVizMap',['$location','$timeout','uiGmapGoogleMapApi','uiGmapIsReady','FilterService',function($location,$timeout,uiGmapGoogleMapApi,uiGmapIsReady,FilterService){
    return {
        restrict: 'E',
        templateUrl: 'js/map/map.html',
        scope: {
        },
        controller: ['$scope',function($scope) {
            var dfltCenter = { latitude: 38.8402805, longitude: -97.61142369999999 },
                dfltZoom = 4,
                map;
            $scope.stationView = false;
            uiGmapGoogleMapApi.then(function(maps) {
                console.log('maps',maps);
                $scope.map = {
                    center: dfltCenter,
                    zoom: dfltZoom,
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
            uiGmapIsReady.promise(1).then(function(instances){
                map = instances[0].map;
                var qargs = $location.search();
                // this is a little leaky, the map knows which args the "share" control cares about...
                $scope.stationView = !qargs['d'] && !qargs['s'];
            });
            function stationViewOff() {
                $scope.stationView = false;
            }
            function stationViewOn() {
                if(map) {
                    map.panTo(new google.maps.LatLng(dfltCenter.latitude,dfltCenter.longitude));
                    map.setZoom(4);
                }
                $scope.stationView = true;
            }
            $scope.$on('tool-open',function(event,data){
                if(data.tool.id === 'layers') {
                    stationViewOff();
                }
            });
            $scope.$on('filter-phase1-start',stationViewOff);
            $scope.$on('filter-reset',stationViewOn);
            $scope.reset = function() {
                if(!$scope.stationView) {
                    FilterService.resetFilter();
                } else {
                    $scope.stationView = false;
                    $timeout(stationViewOn,500);
                }
            };
        }]
    };
}])
.directive('npnWorking',['uiGmapIsReady',function(uiGmapIsReady){
    return {
        restrict: 'E',
        template: '<div id="npn-working" ng-show="working"><i class="fa fa-circle-o-notch fa-spin fa-5x"></i></div>',
        scope: {
        },
        controller: function($scope) {
            function startWorking() { $scope.working = true; }
            function stopWorking() { $scope.working = false;}
            startWorking();
            uiGmapIsReady.promise(1).then(stopWorking);
            $scope.$on('filter-phase1-start',startWorking);
            $scope.$on('filter-phase2-start',startWorking);
            $scope.$on('filter-rerun-phase2',startWorking);
            $scope.$on('filter-phase2-end',stopWorking);
            $scope.$on('layer-load-start',startWorking);
            $scope.$on('layer-load-end',stopWorking);
        }
    };
}]);
angular.module('templates-npnvis', ['js/filter/dateFilterTag.html', 'js/filter/filterControl.html', 'js/filter/filterTags.html', 'js/filter/speciesFilterTag.html', 'js/layers/layerControl.html', 'js/map/map.html', 'js/settings/settingsControl.html', 'js/toolbar/tool.html', 'js/toolbar/toolbar.html', 'js/vis/scatterPlot.html', 'js/vis/visControl.html', 'js/vis/visDialog.html']);

angular.module("js/filter/dateFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/dateFilterTag.html",
    "<div class=\"btn-group\">\n" +
    "    <button class=\"btn btn-default\" disabled>\n" +
    "        {{arg.arg.start_date}} - {{arg.arg.end_date}} <span class=\"badge\">{{counts | speciesBadge:badgeFormat}}</span>\n" +
    "    </button>\n" +
    "    <button class=\"btn btn-default\" ng-click=\"removeFromFilter(arg)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </button>\n" +
    "</div>");
}]);

angular.module("js/filter/filterControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/filterControl.html",
    "<a class=\"btn btn-default\" id=\"filter-placebo\" href ng-click=\"$parent.close()\" ng-disabled=\"!filterHasSufficientCriteria()\">Execute Filter <i class=\"fa fa-search\"></i></a>\n" +
    "\n" +
    "<ul class=\"list-unstyled\">\n" +
    "    <li>\n" +
    "        <label for=\"yearInputForm\">Years (at most ten)</label>\n" +
    "        <form id=\"yearInputForm\" name=\"yearInputForm\">\n" +
    "        <input id=\"start_date\" type=\"number\" class=\"form-control\"\n" +
    "               max=\"{{selected.date.end_date || thisYear}}\"\n" +
    "               ng-model=\"selected.date.start_date\"\n" +
    "               typeahead=\"year for year in validYears | lte:selected.date.end_date | filter:$viewValue\"\n" +
    "               required placeholder=\"From\" /> - \n" +
    "        <input id=\"end_date\" type=\"number\" class=\"form-control\"\n" +
    "                min=\"{{selected.date.start_date || 2008}}\"\n" +
    "                ng-model=\"selected.date.end_date\"\n" +
    "                typeahead=\"year for year in validYears | gte:selected.date.start_date | filter:$viewValue\"\n" +
    "                required placeholder=\"To\" />\n" +
    "        <button class=\"btn btn-default\"\n" +
    "                ng-disabled=\"yearInputForm.$invalid || ((selected.date.end_date - selected.date.start_date) > 10)\"\n" +
    "                ng-click=\"addDateRangeToFilter()\"><i class=\"fa fa-plus\"></i></button>\n" +
    "        </form>\n" +
    "    </li>\n" +
    "    <li class=\"divider\" ng-if=\"filterHasDate()\"></li>\n" +
    "    <li ng-if=\"filterHasDate()\">\n" +
    "        <label for=\"species\">Species</label>\n" +
    "        <input id=\"species\"\n" +
    "               type=\"text\" class=\"form-control\"\n" +
    "               placeholder=\"Add Species To Filter\"\n" +
    "               typeahead=\"sp as sp.$display for sp in findSpecies()  | filter:{common_name:$viewValue} | limitTo:15\"\n" +
    "               typeahead-loading=\"findingSpecies\"\n" +
    "               ng-model=\"selected.addSpecies\"\n" +
    "               ng-disabled=\"findSpeciesParamsEmpty\" />\n" +
    "        <button class=\"btn btn-default\" ng-disabled=\"!selected.speciesToAdd\"\n" +
    "                ng-click=\"addSpeciesToFilter(selected.speciesToAdd)\">\n" +
    "            <i class=\"fa\" ng-class=\"{'fa-refresh fa-spin': findingSpecies, 'fa-plus': !findingSpecies}\"></i>\n" +
    "        </button>\n" +
    "    </li>\n" +
    "    <li ng-if=\"filterHasDate()\">\n" +
    "        <label>Animal Types</label>\n" +
    "        <div isteven-multi-select\n" +
    "            max-labels=\"3\"\n" +
    "            input-model=\"animalTypes\"\n" +
    "            output-model=\"speciesInput.animals\"\n" +
    "            button-label=\"species_type\"\n" +
    "            item-label=\"species_type\"\n" +
    "            tick-property=\"selected\"\n" +
    "            orientation=\"horizontal\"\n" +
    "            helper-elements=\"all none reset filter\"></div>\n" +
    "    </li>\n" +
    "    <li ng-if=\"filterHasDate()\">\n" +
    "        <label>Plant Types</label>\n" +
    "        <div isteven-multi-select\n" +
    "            max-labels=\"3\"\n" +
    "            input-model=\"plantTypes\"\n" +
    "            output-model=\"speciesInput.plants\"\n" +
    "            button-label=\"species_type\"\n" +
    "            item-label=\"species_type\"\n" +
    "            tick-property=\"selected\"\n" +
    "            orientation=\"horizontal\"\n" +
    "            helper-elements=\"all none reset filter\"></div>\n" +
    "    </li>\n" +
    "    <li ng-if=\"filterHasDate()\">\n" +
    "        <label>Partners</label>\n" +
    "        <div isteven-multi-select\n" +
    "            max-labels=\"1\"\n" +
    "            input-model=\"partners\"\n" +
    "            output-model=\"speciesInput.networks\"\n" +
    "            button-label=\"network_name\"\n" +
    "            item-label=\"network_name\"\n" +
    "            tick-property=\"selected\"\n" +
    "            orientation=\"horizontal\"\n" +
    "            selection-mode=\"single\"></div>\n" +
    "    </li>\n" +
    "</ul>\n" +
    "");
}]);

angular.module("js/filter/filterTags.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/filterTags.html",
    "<ul class=\"list-inline filter-tags\">\n" +
    "    <li ng-repeat=\"s in getFilter().getSpeciesArgs()\"><species-filter-tag arg=\"s\"></species-filter-tag></li>\n" +
    "    <li ng-if=\"(date = getFilter().getDateArg())\"><date-filter-tag arg=\"date\"></date-filter-tag></li>\n" +
    "</ul>");
}]);

angular.module("js/filter/speciesFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/speciesFilterTag.html",
    "<div class=\"btn-group filter-tag\" ng-class=\"{open: status.isopen}\">\n" +
    "    <button type=\"button\" class=\"btn btn-primary\" style=\"background-color: {{arg.color}};\" ng-disabled=\"!arg.phenophases\" ng-click=\"status.isopen = !status.isopen\">\n" +
    "        {{arg.arg | speciesTitle:titleFormat}} <span class=\"badge\">{{arg.counts | speciesBadge:badgeFormat}}</span> <span class=\"caret\"></span>\n" +
    "    </button>\n" +
    "    <ul class=\"dropdown-menu phenophase-list\" role=\"menu\">\n" +
    "        <li class=\"inline\">Select <a href ng-click=\"selectAll(true)\">all</a> <a href ng-click=\"selectAll(false)\">none</a></li>\n" +
    "        <li class=\"divider\"></li>\n" +
    "        <li ng-repeat=\"phenophase in arg.phenophases\">\n" +
    "            <input type=\"checkbox\" ng-model=\"phenophase.selected\"> <span class=\"badge\">{{phenophase.count}}</span> {{phenophase.phenophase_name}}\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "    <button class=\"btn btn-primary\" style=\"background-color: {{arg.color}};\" ng-click=\"removeFromFilter(arg)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </button>\n" +
    "</div>");
}]);

angular.module("js/layers/layerControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/layers/layerControl.html",
    "<ul class=\"list-unstyled\">\n" +
    "    <li><input type=\"radio\" id=\"layer-none\" ng-model=\"layerOnMap.layer\" value=\"none\"/> <label for=\"layer-none\">None</label></li>\n" +
    "    <li ng-repeat=\"layer in layers\">\n" +
    "        <input type=\"radio\" id=\"layer-{{layer.id}}\" ng-model=\"layerOnMap.layer\" ng-value=\"layer\"/> <label for=\"layer-{{layer.id}}\">{{layer.label}}</label>\n" +
    "        <span ng-if=\"layer.source\">(<a href=\"{{layer.source}}\" target=\"_blank\">Source</a>)</span>\n" +
    "        <span ng-if=\"layer.img\">\n" +
    "            <a ng-if=\"layer.link\" href=\"{{layer.link}}\" target=\"_blank\"><img ng-src=\"{{layer.img}}\" /></a>\n" +
    "            <img ng-if=\"!layer.link\" ng-src=\"{{layer.img}}\" />\n" +
    "        </span>\n" +
    "    </li>\n" +
    "</ul>");
}]);

angular.module("js/map/map.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/map/map.html",
    "<a title=\"Reset\" href id=\"reset-control\" class=\"btn btn-default btn-xs\" ng-click=\"reset()\"><i class=\"fa fa-refresh\"></i></a>\n" +
    "\n" +
    "<npn-working></npn-working>\n" +
    "\n" +
    "<ui-gmap-google-map ng-if=\"map\" center='map.center' zoom='map.zoom' options=\"map.options\">\n" +
    "    <npn-stations ng-if=\"stationView\"></npn-stations>\n" +
    "    <npn-filter-results></npn-filter-results>\n" +
    "</ui-gmap-google-map>\n" +
    "\n" +
    "<share-control></share-control>\n" +
    "<filter-tags></filter-tags>\n" +
    "\n" +
    "<toolbar>\n" +
    "    <tool id=\"filter\" icon=\"fa-search\" title=\"Filter\">\n" +
    "        <filter-control></filter-control>\n" +
    "    </tool>\n" +
    "    <tool id=\"layers\" icon=\"fa-bars\" title=\"Layers\">\n" +
    "        <layer-control></layer-control>\n" +
    "    </tool>\n" +
    "    <tool id=\"visualizations\" icon=\"fa-bar-chart\" title=\"Visualizations\">\n" +
    "        <vis-control></vis-control>\n" +
    "    </tool>\n" +
    "    <tool id=\"settings\" icon=\"fa-cog\" title=\"Settings\">\n" +
    "        <settings-control></settings-control>\n" +
    "    </tool>\n" +
    "</toolbar>");
}]);

angular.module("js/settings/settingsControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/settings/settingsControl.html",
    "<ul class=\"list-unstyled\">\n" +
    "    <li>\n" +
    "        <Label for=\"clusterMarkersSetting\">Cluster Markers</label>\n" +
    "        <ul class=\"list-unstyled\">\n" +
    "            <li ng-repeat=\"option in [true,false]\">\n" +
    "                <input type=\"radio\" id=\"clusterMarkers{{option}}\" ng-model=\"settings.clusterMarkers.value\"\n" +
    "                       ng-value=\"{{option}}\" /> <label for=\"clusterMarkers{{option}}\">{{option | yesNo}}</label>\n" +
    "            </li>\n" +
    "        </ul>\n" +
    "    </li>\n" +
    "    <li class=\"divider\"></li>\n" +
    "    <li>\n" +
    "        <label>Species Badge Contents</label>\n" +
    "        <ul class=\"list-unstyled\">\n" +
    "            <li ng-repeat=\"option in settings.tagBadgeFormat.options\">\n" +
    "                <input type=\"radio\"\n" +
    "                       id=\"{{option.value}}\" ng-model=\"settings.tagBadgeFormat.value\"\n" +
    "                       value=\"{{option.value}}\"> <label for=\"{{option.value}}\">{{option.label}}</label>\n" +
    "            </li>\n" +
    "        </ul>\n" +
    "\n" +
    "    </li>\n" +
    "    <li class=\"divider\"></li>\n" +
    "    <li>\n" +
    "        <label>Species Tag Title</label>\n" +
    "        <ul class=\"list-unstyled\">\n" +
    "            <li ng-repeat=\"option in settings.tagSpeciesTitle.options\">\n" +
    "                <input type=\"radio\"\n" +
    "                       id=\"{{option.value}}\" ng-model=\"settings.tagSpeciesTitle.value\"\n" +
    "                       value=\"{{option.value}}\"> <label for=\"{{option.value}}\">{{option.label}}</label>\n" +
    "            </li>\n" +
    "        </ul>\n" +
    "\n" +
    "    </li>\n" +
    "</ul>");
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

angular.module("js/vis/scatterPlot.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/vis/scatterPlot.html",
    "<vis-dialog title=\"Scatter Plot\" modal=\"modal\">\n" +
    "{{foo}}\n" +
    "</vis-dialog>");
}]);

angular.module("js/vis/visControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/vis/visControl.html",
    "<ul class=\"list-unstyled\">\n" +
    "    <li ng-repeat=\"vis in visualizations\">\n" +
    "        <a href ng-click=\"open(vis)\">{{vis.title}}</a>\n" +
    "        <p>{{vis.description}}</p>\n" +
    "    </li>\n" +
    "</ul>");
}]);

angular.module("js/vis/visDialog.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/vis/visDialog.html",
    "<div class=\"modal-header\">\n" +
    "    <a href class=\"modal-dismiss\" ng-click=\"modal.dismiss()\"><i class=\"fa fa-times-circle-o fa-2x\"></i></a>\n" +
    "    <h3 class=\"modal-title\">{{title}}</h3>\n" +
    "</div>\n" +
    "<div class=\"modal-body vis-dialog {{title | cssClassify}}\" ng-transclude>\n" +
    "</div>");
}]);

angular.module('npn-viz-tool.settings',[
    'npn-viz-tool.filters'
])
.factory('SettingsService',[function(){
    var settings = {
        clusterMarkers: {
            name: 'cluster-markers',
            q: 'cm',
            value: true
        },
        tagSpeciesTitle: {
            name: 'tag-species-title',
            q: 'tst',
            value: 'common-name',
            options: [{
                value: 'common-name',
                q: 'cn',
                label: 'Common Name'
            },{
                value: 'genus-species',
                q: 'gs',
                label: 'Genus Species'
            }]
        },
        tagBadgeFormat: {
            name: 'tag-badge-format',
            q: 'tbf',
            value: 'observation-count',
            options: [{
                value: 'observation-count',
                q: 'oc',
                label: 'Observation Count'
            },{
                value: 'station-count',
                q: 'sc',
                label: 'Station Count'
            },{
                value: 'station-observation-count',
                q: 'soc',
                label: 'Station Count/Observation Count'
            }]
        }
    };
    return {
        getSettings: function() { return settings; },
        getSetting: function(key) { return settings[key]; },
        getSettingValue: function(key) { return settings[key].value; },
        getSharingUrlArgs: function() {
            var arg = '',key,s,i;
            for(key in settings) {
                s = settings[key];
                arg+=(arg !== '' ? ';':'')+s.q+'=';
                if(!s.options) {
                    arg+=s.value;
                } else {
                    for(i = 0; i < s.options.length; i++) {
                        if(s.value === s.options[i].value) {
                            arg += s.options[i].q;
                            break;
                        }
                    }
                }
            }
            return 'ss='+encodeURIComponent(arg);
        },
        populateFromSharingUrlArgs: function(ss) {
            if(ss) {
                ss.split(';').forEach(function(st){
                    var pts = st.split('='),
                        q = pts[0], v = pts[1],key,i;
                    for(key in settings) {
                        if(settings[key].q === q) {
                            if(settings[key].options) {
                                for(i = 0; i < settings[key].options.length; i++) {
                                    if(settings[key].options[i].q === v) {
                                        settings[key].value = settings[key].options[i].value;
                                        break;
                                    }
                                }
                            } else {
                                settings[key].value = (v === 'true' || v === 'false') ? (v === 'true') : v;
                            }
                            break;
                        }
                    }
                });
            }
        }
    };
}])
.directive('settingsControl',['$rootScope','$location','SettingsService',function($rootScope,$location,SettingsService){
    return {
        restrict: 'E',
        templateUrl: 'js/settings/settingsControl.html',
        controller: function($scope) {
            SettingsService.populateFromSharingUrlArgs($location.search()['ss']);
            $scope.settings = SettingsService.getSettings();
            function broadcastSettingChange(key) {
                console.log('broadcastSettingChange',$scope.settings[key]);
                $rootScope.$broadcast('setting-update-'+key,$scope.settings[key]);
            }
            function setupBroadcast(key) {
                $scope.$watch('settings.'+key+'.value',function(oldV,newV){
                    broadcastSettingChange(key);
                });
            }
            for(var key in $scope.settings) {
                setupBroadcast(key);
            }
        }
    };
}]);
angular.module('npn-viz-tool.share',[
    'npn-viz-tool.filter',
    'npn-viz-tool.layers',
    'npn-viz-tool.settings',
    'uiGmapgoogle-maps'
])
/**
 * Important one and only one instance of this directive should ever be in use in the application
 * because upon instantiation it examines the current URL query args and uses its contents to
 * populate the filter, etc.
 */
.directive('shareControl',['uiGmapIsReady','FilterService','LayerService','DateFilterArg','SpeciesFilterArg','GeoFilterArg','$location','SettingsService',
    function(uiGmapIsReady,FilterService,LayerService,DateFilterArg,SpeciesFilterArg,GeoFilterArg,$location,SettingsService){
    return {
        restrict: 'E',
        template: '<a title="Share" href id="share-control" class="btn btn-default btn-xs" ng-disabled="!getFilter().hasSufficientCriteria()" ng-click="share()"><i class="fa fa-share"></i></a><div ng-show="url" id="share-content"><input type="text" class="form-control" ng-model="url" ng-blur="url = null" onClick="this.setSelectionRange(0, this.value.length)"/></div>',
        scope: {},
        controller: function($scope){
            FilterService.pause();
            uiGmapIsReady.promise(1).then(function(){
                var qargs = $location.search(),
                    speciesFilterCount = 0,
                    speciesFilterReadyCount = 0,
                    layersReady = false,
                    layerListener,speciesListener;
                function checkReady() {
                    if(layersReady && speciesFilterReadyCount === speciesFilterCount) {
                        console.log('ready..');
                        // unsubscribe
                        layerListener();
                        speciesListener();
                        FilterService.resume();
                    }
                }
                layerListener = $scope.$on('layers-ready',function(event,data){
                    console.log('layers ready...');
                    layersReady = true;
                    checkReady();
                });
                speciesListener = $scope.$on('species-filter-ready',function(event,data){
                    console.log('species filter ready...',data);
                    speciesFilterReadyCount++;
                    checkReady();
                });
                function addSpeciesToFilter(s){
                    SpeciesFilterArg.fromString(s).then(FilterService.addToFilter);
                }
                console.log('qargs',qargs);
                if(qargs['d'] && qargs['s']) {
                    // we have sufficient criteria to alter the filter...
                    FilterService.addToFilter(DateFilterArg.fromString(qargs['d']));
                    var speciesList = qargs['s'].split(';');
                    speciesFilterCount = speciesList.length;
                    speciesList.forEach(addSpeciesToFilter);
                } else {
                    FilterService.resume();
                }
            });

            $scope.getFilter = FilterService.getFilter;
            $scope.share = function() {
                if($scope.url) {
                    $scope.url = null;
                    return;
                }
                var filter = FilterService.getFilter(),
                    params = {},
                    absUrl = $location.absUrl(),
                    q = absUrl.indexOf('?');
                params['d'] = filter.getDateArg().toString();
                filter.getSpeciesArgs().forEach(function(s){
                    if(!params['s']) {
                        params['s'] = s.toString();
                    } else {
                        params['s'] += ';'+s.toString();
                    }
                });
                filter.getGeoArgs().forEach(function(g){
                    if(!params['g']) {
                        params['g'] = g.toString();
                    } else {
                        params['g'] += ';'+g.toString();
                    }
                });
                if(q != -1) {
                    absUrl = absUrl.substring(0,q);
                }
                absUrl += absUrl.indexOf('#') === -1 ? '#?' : '?';
                Object.keys(params).forEach(function(key,i){
                    absUrl += (i > 0 ? '&' : '') + key + '=' + encodeURIComponent(params[key]);
                });
                absUrl+='&'+SettingsService.getSharingUrlArgs();
                console.log('absUrl',absUrl);
                $scope.url = absUrl;
            };
        }
    };
}]);
angular.module('npn-viz-tool.stations',[
    'npn-viz-tool.settings',
    'npn-viz-tool.layers'
])
.directive('npnStations',['$http','LayerService','SettingsService',function($http,LayerService,SettingsService){
    return {
        restrict: 'E',
        template: '<ui-gmap-markers models="regions.markers" idKey="\'name\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" isLabel="true"></ui-gmap-markers><ui-gmap-markers models="stations.markers" idKey="\'station_id\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" doCluster="doCluster"></ui-gmap-markers>',
        scope: {
        },
        controller: ['$scope',function($scope) {
            $scope.doCluster = SettingsService.getSettingValue('clusterMarkers');
            $scope.$on('setting-update-clusterMarkers',function(event,data){
                $scope.doCluster = data.value;
            });
            $scope.regions = {
                markers: []
            };
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
                                        title: name,
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
                                        // remove the station count marker
                                        // UGH splice isn't triggering the marker to get removed so re-build the
                                        // marker array...
                                        var region_markers = [];
                                        for(var i = 0; i < $scope.regions.markers.length; i++) {
                                            if($scope.regions.markers[i].name !== state) {
                                                region_markers.push($scope.regions.markers[i]);
                                            }
                                        }
                                        $scope.regions.markers = region_markers;
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
      function broadcastChange(t) {
        $rootScope.$broadcast('tool-'+(t.selected ? 'open' : 'close'),{
          tool: t
        });
      }
      $scope.select = function(t) {
        t.selected = !t.selected;
        $scope.open = t.selected;
        broadcastChange(t);
      };
      this.addTool = function(t) {
        tools.push(t);
      };
      this.closeTool = function(t) {
        $scope.open = t.selected = false;
        broadcastChange(t);
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
      scope.close = function() {
        tabsCtrl.closeTool(scope);
      };
    }
  };
}]);
angular.module('npn-viz-tool.vis',[
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'ui.bootstrap'
])
.directive('visDialog',[function(){
    return {
        restrict: 'E',
        templateUrl: 'js/vis/visDialog.html',
        transclude: true,
        scope: {
            title: '@',
            modal: '='
        },
        controller: ['$scope',function($scope) {
        }]
    };
}])
.directive('visControl',['$modal',function($modal){
    var visualizations = [{
        title: 'Scatter Plot',
        controller: 'ScatterPlotCtrl',
        template: 'js/vis/scatterPlot.html',
        description: 'This visualization uses site-level data and allows users to set different variables as the X and Y axes. The user can select a number of geographic or climatic variables on the X axis and phenometric type variables on the Y axis. The graph presents a legend for multiple species, as well as produces a regression line.'
    }];
    return {
        restrict: 'E',
        templateUrl: 'js/vis/visControl.html',
        scope: {

        },
        controller: function($scope) {
            $scope.visualizations = visualizations;
            $scope.open = function(vis) {
                $modal.open({
                    templateUrl: vis.template,
                    controller: vis.controller,
                    windowClass: 'vis-dialog-window',
                    backdrop: 'static',
                    keyboard: false,
                    size: 'lg'
                });
            };
        }
    };
}])
.controller('ScatterPlotCtrl',['$scope','$modalInstance',function($scope,$modalInstance){
    $scope.modal = $modalInstance;
    $scope.foo = 'bar';
}]);