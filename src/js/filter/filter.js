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
        if(range) {
            if(range.start_date && typeof(range.start_date) !== 'number') {
                range.start_date = parseInt(range.start_date);
            }
            if(range.end_date && typeof(range.end_date) !== 'number') {
                range.end_date = parseInt(range.end_date);
            }
        }
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
            hitCount = 0,
            filtered = Object.keys(species).filter(function(pid){
                self.phenophasesMap[pid].count++;
                if(self.phenophasesMap[pid].selected) {
                    hitCount++;
                }
                return self.phenophasesMap[pid].selected;
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
    NpnFilter.prototype.getUpdateCount = function() {
        return this.updateCount;
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
        this.updateCount++;
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
        this.updateCount++;
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
        this.updateCount = 0;
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
    var color_domain = d3.range(0,20),
        cat20 = d3.scale.category20().domain(color_domain),
        cat20b = d3.scale.category20b().domain(color_domain),
        colorScale = d3.scale.ordinal().domain(color_domain).range(color_domain.map(function(d,i){
            return (i%2) === 0 ? cat20(i) : cat20b(i-1);
        })),
        choroplethScales = color_domain.map(function(i) {
            var maxColor = colorScale(i),
                minColor = d3.rgb(maxColor).hsl().brighter(1.25).rgb().toString();
            return d3.scale.linear().range([minColor,maxColor]);
        }),
        filter = new NpnFilter(),
        filterUpdateCount,
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
        last,
        lastFiltered = [];
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
        var start = Date.now();
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

                station.observationCount = 0;

                for(sid in station.species) {
                    speciesFilter = filter.getSpeciesArg(sid);
                    hitMap[sid] = 0;
                    if(!speciesFilter) {
                        console.warn('species found in results but not in filter',station.species[sid]);
                        continue;
                    }
                    if((n=speciesFilter.$filter(station.species[sid]))) {
                        observationCount += n;
                        station.observationCount += n;
                        hitMap[sid]++;
                        keeps++;
                        if(keeps === 1) {
                            // this is the first "hit" and dictates the marker color
                            station.markerOpts.icon.fillColorIdx = speciesFilter.colorIdx;
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
            }).map(function(m){
                // simplify the contents of the filtered marker results o/w there's a ton of data that
                // angular copies on a watch which slows things WAY down for some browsers in particular (FireFox ahem)
                return {
                    $markerKey: m.$markerKey,
                    latitude: m.latitude,
                    longitude: m.longitude,
                    markerOpts: m.markerOpts,
                    station_id: m.station_id,
                    station_name: m.station_name,
                    observationCount: m.observationCount
                };
            });
        // sort markers into buckets based on color and then choropleth colors based on observationCount
        filter.getSpeciesArgs().forEach(function(arg) {
            var argMarkers = filtered.filter(function(m) {
                    return arg.colorIdx === m.markerOpts.icon.fillColorIdx;
                }),
                minCount = d3.min(argMarkers,function(m) { return m.observationCount; }),
                maxCount = d3.max(argMarkers,function(m) { return m.observationCount; });
            if(minCount !== maxCount) {
                console.log('there is variability in observationCounts', minCount, maxCount);
                console.log('arg markers',arg,argMarkers);
                var choroplethScale = choroplethScales[arg.colorIdx];
                choroplethScale.domain([minCount,maxCount]);
                argMarkers.forEach(function(marker){
                    marker.markerOpts.icon.fillColor = choroplethScale(marker.observationCount);
                    marker.$markerKey = marker.station_id+'.'+marker.markerOpts.icon.fillColor+'.'+marker.markerOpts.icon.strokeColor;
                });
            }
        });
        $rootScope.$broadcast('filter-phase2-end',{
            station: filtered.length,
            observation: observationCount
        });
        console.log('phase2 time:',(Date.now()-start));
        return (lastFiltered = filtered);
    }
    function execute() {
        var def = $q.defer(),
            filterParams = getFilterParams();
        if(!paused && filterParams && filterUpdateCount != filter.getUpdateCount()) {
            filterUpdateCount = filter.getUpdateCount();
            var start = Date.now();
            console.log('execute',filterUpdateCount,filterParams);
            $rootScope.$broadcast('filter-phase1-start',{});
            $http.get('/npn_portal/observations/getAllObservationsForSpecies.json',{
                params: filterParams
            }).success(function(d) {
                angular.forEach(d.station_list,function(station){
                    station.markerOpts = {
                        title: station.station_name,
                        icon: angular.extend({},defaultIcon)
                    };
                });
                $rootScope.$broadcast('filter-phase1-end',{
                    count: d.station_list.length
                });
                // now need to walk through the station_list and post-filter by phenophases...
                console.log('phase1 time:',(Date.now()-start));
                console.log('results-pre',d);
                def.resolve(post_filter(last=d.station_list));
            });
        } else {
            // either no filter or a request to re-execute a filter that hasn't changed...
            def.resolve(lastFiltered);
        }
        return def.promise;
    }
    function broadcastFilterUpdate() {
        if(!paused) {
            $rootScope.$broadcast('filter-update',{});
        }
    }
    function broadcastFilterReset() {
        lastFiltered = [];
        $rootScope.$broadcast('filter-reset',{});
    }
    function updateColors() {
        filter.getSpeciesArgs().forEach(function(arg,i){
            arg.colorIdx = i;
            arg.color = colorScale(i);
        });
    }
    return {
        execute: execute,
        getFilteredMarkers: function() {
            return lastFiltered;
        },
        pause: function() {
            console.log('PAUSE');
            paused = true;
        },
        resume: function() {
            console.log('RESUME');
            paused = false;
            broadcastFilterUpdate();
        },
        getFilter: function() {
            return filter;
        },
        hasFilterChanged: function() {
            return filterUpdateCount !== filter.getUpdateCount();
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
        },
        getColorScale: function() {
            return colorScale;
        }
    };
}])
.directive('npnFilterResults',['$rootScope','$http','$timeout','FilterService','SettingsService',function($rootScope,$http,$timeout,FilterService,SettingsService){
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
                if(!FilterService.isFilterEmpty() && FilterService.hasFilterChanged()) {
                    $timeout(function(){
                        $scope.results.markers = [];
                        $timeout(function(){
                            FilterService.execute().then(function(markers) {
console.log('markers',markers);
                                $scope.results.markers = markers;
                            });
                        },500);
                    },500);
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
.filter('speciesTitle',['SettingsService',function(SettingsService){
    return function(item,format) {
        var fmt = format||SettingsService.getSettingValue('tagSpeciesTitle');
        if(fmt === 'common-name') {
            if(item.common_name) {
                var lower = item.common_name.toLowerCase();
                return lower.substring(0,1).toUpperCase()+lower.substring(1);
            }
            return item.common_name;
        } else if (fmt === 'scientific-name') {
            return item.genus+' '+item.species;
        }
        return item;
    };
}])
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
            $scope.badgeTooltip = SettingsService.getSettingValueLabel('tagBadgeFormat');
            $scope.$on('setting-update-tagBadgeFormat',function(event,data){
                $scope.badgeFormat = data.value;
                $scope.badgeTooltip = SettingsService.getSettingValueLabel('tagBadgeFormat');
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
            $scope.hasCount = function(v,i) {
                return v.count > 0;
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
            $scope.badgeTooltip = SettingsService.getSettingValueLabel('tagBadgeFormat');
            $scope.$on('setting-update-tagBadgeFormat',function(event,data){
                $scope.badgeFormat = data.value;
                $scope.badgeTooltip = SettingsService.getSettingValueLabel('tagBadgeFormat');
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
                validYears = d3.range(1900,thisYear+1);
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
                    idx = 0;
                angular.forEach([].concat($scope.speciesInput.animals).concat($scope.speciesInput.plants),function(s){
                    params['group_ids['+(idx++)+']'] = s['species_type_id'];
                });
                idx = 0;
                angular.forEach($scope.speciesInput.networks,function(n){
                    params['network_id['+(idx++)+']'] = n['network_id'];
                });
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
            $http.get('/npn_portal/networks/getPartnerNetworks.json?active_only=true').success(function(partners){
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