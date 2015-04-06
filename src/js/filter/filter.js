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
.factory('NetworkFilterArg',['$http','$rootScope','$log','FilterArg','SpeciesFilterArg',function($http,$rootScope,$log,FilterArg,SpeciesFilterArg){
    /**
     * Constructs a NetworkFilterArg.  TODO over-ride $filter??
     *
     * @param {Object} A network record as returned by getPartnerNetworks.json.
     */
    var NetworkFilterArg = function(network) {
        FilterArg.apply(this,arguments);
        this.counts = {
            station: '?',
            observation: '?'
        };
        this.stations = [];
        var self = this;
        $rootScope.$broadcast('network-filter-ready',{filter:self});
    };
    NetworkFilterArg.prototype.getId = function() {
        return parseInt(this.arg.network_id);
    };
    NetworkFilterArg.prototype.toString = function() {
        return this.arg.network_id;
    };
    NetworkFilterArg.prototype.resetCounts = function(c) {
        this.counts.station = this.counts.observation = c;
        this.stations = [];
    };
    NetworkFilterArg.prototype.updateCounts = function(station,species) {
        var id = this.getId(),pid;
        if(station.networks.indexOf(id) !== -1) {
            // station is IN this network
            if(this.stations.indexOf(station.station_id) === -1) {
                // first time we've seen this station.
                this.stations.push(station.station_id);
                this.counts.station++;
            }
            // TODO, how to know which phenophases to add to counts??
            for(pid in species) {
                if(species[pid].$match) { // matched some species/phenophase filter
                    this.counts.observation += SpeciesFilterArg.countObservationsForPhenophase(species[pid]);
                }
            }
        }
    };
    NetworkFilterArg.fromString = function(s) {
        // TODO can I just fetch a SINGLE network??  the network_id parameter of
        // getPartnerNetworks.json doesn't appear to work.
        return $http.get('/npn_portal/networks/getPartnerNetworks.json',{
            params: {
                active_only: true,
                // network_id: s
            }
        }).then(function(response){
            var nets = response.data;
            for(var i = 0; nets && i  < nets.length; i++) {
                if(s === nets[i].network_id) {
                    return new NetworkFilterArg(nets[i]);
                }
            }
            $log.warn('NO NETWORK FOUND WITH ID '+s);
        });
    };
    return NetworkFilterArg;
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
    SpeciesFilterArg.countObservationsForPhenophase = function(phenophase) {
        var n = 0;
        if(phenophase.y) {
            n += phenophase.y;
        }
        if(phenophase.n) {
            n += phenophase.n;
        }
        if(phenophase.q) {
            n += phenophase.q;
        }
        return n;
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
                var oCount = SpeciesFilterArg.countObservationsForPhenophase(species[pid]);
                self.phenophasesMap[pid].count += oCount;
                // LEAKY this $match is something that the NetworkFilterArg uses to decide which
                // observations to include in its counts
                species[pid].$match = self.phenophasesMap[pid].selected;
                if(species[pid].$match) {
                    hitCount += oCount;
                }
                return species[pid].$match;
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
    GeoFilterArg.prototype.getUid = function(){
        return this.getSourceId()+'-'+this.getId();
    };
    GeoFilterArg.prototype.$filter = function(marker) {
        return geoContains(new google.maps.LatLng(parseFloat(marker.latitude), parseFloat(marker.longitude)),this.arg.getGeometry());
    };
    GeoFilterArg.prototype.toString = function() {
        return this.sourceId+':'+this.arg.getProperty('NAME');
    };
    return GeoFilterArg;
}])
.factory('NpnFilter',['DateFilterArg','SpeciesFilterArg','NetworkFilterArg','GeoFilterArg',function(DateFilterArg,SpeciesFilterArg,NetworkFilterArg,GeoFilterArg){
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
        return Object.keys(this.species).length > 0 || Object.keys(this.networks).length > 0;
    };
    NpnFilter.prototype.hasSufficientCriteria = function() {
        return this.date && (Object.keys(this.species).length > 0 || Object.keys(this.networks).length > 0);
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
    NpnFilter.prototype.getNetworkArg = function(id) {
        return this.networks[id];
    };
    NpnFilter.prototype.getNetworkArgs = function() {
        return getValues(this.networks);
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
        } else if (item instanceof NetworkFilterArg) {
            this.networks[item.getId()] = item;
        } else if (item instanceof GeoFilterArg) {
            this.geo[item.getId()] = item;
        }
        return (!(item instanceof GeoFilterArg));
    };
    NpnFilter.prototype.remove = function(item) {
        this.updateCount++;
        if(item instanceof DateFilterArg) {
            this.date = undefined;
            // removal of date invalidates filter.
            this.species = {};
            this.networks = {};
        } else if(item instanceof SpeciesFilterArg) {
            delete this.species[item.getId()];
        } else if(item instanceof NetworkFilterArg){
            delete this.networks[item.getId()];
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
        this.networks = {};
    };
    return NpnFilter;
}])
/**
 * TODO - need to nail down the event model and probably even formalize it via a service because it's all
 * pretty loosey goosey at the moment.  Bad enough duplicating strings around...
 */
.factory('FilterService',['$q','$http','$rootScope','$timeout','$log','uiGmapGoogleMapApi','NpnFilter','SpeciesFilterArg',
    function($q,$http,$rootScope,$timeout,$log,uiGmapGoogleMapApi,NpnFilter,SpeciesFilterArg){
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
            filter.getNetworkArgs().forEach(function(arg,i){
                params['network_id['+(i)+']'] = arg.getId();
            });
            return params;
        }
    }
    $rootScope.$on('filter-rerun-phase2',function(event,data){
        if(!paused) {
            $timeout(function(){
                if(last) {
                    var markers = post_filter(last,true);
                    $rootScope.$broadcast('filter-marker-updates',{markers: markers});
                }
            },500);
        }
    });

    var geoResults = {
            previousFilterCount: 0,
            previousFilterMap: {},
            hits: [],
            misses: []
        };
    function geo_filter(markers,refilter) {
        function _mapdiff(a,b) { // a should have one more key than b, what is that key's value?
            var aKeys = Object.keys(a),
                bKeys = Object.keys(b),
                i;
            if(aKeys.length !== (bKeys.length+1)) {
                $log.warn('Issue with usage of _mapdiff, unexpected key lengths',a,b);
            }
            if(aKeys.length === 1) {
                return a[aKeys[0]];
            }
            for(i = 0; i < aKeys.length; i++) {
                if(!b[aKeys[i]]) {
                    return a[aKeys[i]];
                }
            }
            $log.warn('Issue with usage of _mapdiff, unfound diff',a,b);
        }
        function _filtermap() {
            var map = {};
            angular.forEach(filter.getGeoArgs(),function(arg){
                map[arg.getUid()] = arg;
            });
            return map;
        }
        function _runfilter(toFilter,filterFunc) {
            var results = {
                hits: [],
                misses: []
            };
            angular.forEach(toFilter,function(m){
                if(filterFunc(m)) {
                    results.hits.push(m);
                } else {
                    results.misses.push(m);
                }
            });
            return results;
        }
        var start = Date.now(),
            filters = filter.getGeoArgs(),
            geoCount = filters.length,
            geoAdd = geoCount > geoResults.previousFilterCount,
            newMap = _filtermap(),
            filtered;
        geoResults.previousFilterCount = geoCount;
        if(geoCount === 0) {
            geoResults.misses = [];
            geoResults.hits = [].concat(markers);
        } else if(!refilter || Object.keys(newMap).length === 1) {
            // this is a new filter execution need to apply the filter to all markers
            // this use case may perform poorly in some cases like
            // FireFox >2 geo filters and a lot of markers
            // includes special case of first added geo filter
            filtered = _runfilter(markers,function(m){
                var hit = false,i;
                for(i = 0; i < filters.length; i++){
                    if((hit=filters[i].$filter(m))) {
                        break;
                    }
                }
                return hit;
            });
            geoResults.hits = filtered.hits;
            geoResults.misses = filtered.misses;
        } else if (geoAdd) {
            var addedFilter = _mapdiff(newMap,geoResults.previousFilterMap);
            // applying new filter against what was missed last time around
            filtered = _runfilter(geoResults.misses,function(m){
                return addedFilter.$filter(m);
            });
            geoResults.hits = geoResults.hits.concat(filtered.hits);
            geoResults.misses = filtered.misses;
        } else {
            var removedFilter = _mapdiff(geoResults.previousFilterMap,newMap);
            // test filter being removed against previous hits to see which should be removed
            filtered = _runfilter(geoResults.hits,function(m){
                return removedFilter.$filter(m);
            });
            geoResults.hits = filtered.misses;
            geoResults.misses = geoResults.misses.concat(filtered.hits);
        }
        geoResults.previousFilterMap = newMap;
        $log.debug('geo time:'+(Date.now()-start));
        //$log.debug('geoResults',geoResults);
        return geoResults.hits;
    }
    function post_filter(markers,refilter) {
        var start = Date.now();
        $rootScope.$broadcast('filter-phase2-start',{
            count: markers.length
        });
        var observationCount = 0,
            geos = filter.getGeoArgs(),
            hasSpeciesArgs = filter.getSpeciesArgs().length > 0,
            networkArgs = filter.getNetworkArgs(),
            updateNetworkCounts = function(station,species) {
                if(networkArgs.length) {
                    angular.forEach(networkArgs,function(networkArg){
                        networkArg.updateCounts(station,species);
                    });
                }
            },
            filtered =  geo_filter(markers,refilter).filter(function(station){
                station.markerOpts.icon.fillColor = defaultIcon.fillColor;
                var i,sid,speciesFilter,keeps = 0,
                    n,hitMap = {},pid;

                station.observationCount = 0;

                for(sid in station.species) {
                    speciesFilter = filter.getSpeciesArg(sid);
                    hitMap[sid] = 0;
                    if(!speciesFilter && hasSpeciesArgs) {
                        $log.warn('species found in results but not in filter',station.species[sid]);
                        continue;
                    }
                    if(speciesFilter && (n=speciesFilter.$filter(station.species[sid]))) {
                        observationCount += n;
                        station.observationCount += n;
                        hitMap[sid]++;
                        keeps++;
                        if(keeps === 1) {
                            // this is the first "hit" and dictates the marker color
                            station.markerOpts.icon.fillColorIdx = speciesFilter.colorIdx;
                            station.markerOpts.icon.fillColor = speciesFilter.color;
                        }
                        updateNetworkCounts(station,station.species[sid]);
                    } else if(!speciesFilter) {
                        // if we're here it means we have network filters but not species filters
                        // just update observation counts and hold onto all markers
                        for(pid in station.species[sid]) {
                            station.species[sid][pid].$match = true; // potentially LEAKY but attribute shared by Species/NetworkFilterArg
                            n = SpeciesFilterArg.countObservationsForPhenophase(station.species[sid][pid]);
                            station.observationCount += n;
                            observationCount += n;
                        }
                        keeps++;
                        updateNetworkCounts(station,station.species[sid]);
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
                //$log.debug('there is variability in observationCounts', minCount, maxCount);
                //$log.debug('arg markers',arg,argMarkers);
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
        $log.debug('phase2 time:',(Date.now()-start));
        return (lastFiltered = filtered);
    }
    function execute() {
        var def = $q.defer(),
            filterParams = getFilterParams();
        if(!paused && filterParams && filterUpdateCount != filter.getUpdateCount()) {
            filterUpdateCount = filter.getUpdateCount();
            var start = Date.now();
            $log.debug('execute',filterUpdateCount,filterParams);
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
                $log.debug('phase1 time:',(Date.now()-start));
                //$log.debug('results-pre',d);
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
            $log.debug('PAUSE');
            paused = true;
        },
        resume: function() {
            $log.debug('RESUME');
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
.directive('npnFilterResults',['$rootScope','$http','$timeout','$filter','$log','FilterService','SettingsService',
    function($rootScope,$http,$timeout,$filter,$log,FilterService,SettingsService){
    return {
        restrict: 'E',
        template: '<ui-gmap-markers models="results.markers" idKey="\'$markerKey\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" doCluster="doCluster" clusterOptions="clusterOptions" control="mapControl"></ui-gmap-markers>',
        scope: {
        },
        controller: function($scope) {
            var filter_control_open = false;
            $scope.results = {
                markers: []
            };
            $scope.mapControl = {};
            $scope.doCluster = SettingsService.getSettingValue('clusterMarkers');
            var styles = [0,1,2,4,8,16,32,64,128,256].map(function(i){
                return {
                    n: (i*1000),
                    url: 'cluster/m'+i+'.png',
                    width: 52,
                    height: 52,
                    textColor: '#fff'
                    //textColor: i > 8 ? '#fff' : '#000'
                };
            }),
            badgeFormatter = $filter('speciesBadge');
            $scope.clusterOptions = {
                styles: styles,
                maxZoom: 12,
                calculator: function(markers,styleCount) {
                    var oCount = 0,
                        fmt = SettingsService.getSettingValue('tagBadgeFormat'),r = {index:1};
                    markers.values().forEach(function(marker) {
                        oCount += marker.model.observationCount;
                    });
                    r.text = badgeFormatter({station: markers.length,observation: oCount},SettingsService.getSettingValue('tagBadgeFormat'));
                    for(var i = 0; i <styles.length;i++) {
                        if(oCount >= styles[i].n) {
                            r.index = (i+1);
                        }
                    }
                    return r;
                }
            };
            $scope.$on('setting-update-tagBadgeFormat',function(event,data){
                if($scope.mapControl && $scope.mapControl.managerDraw) {
                    $scope.mapControl.managerDraw();
                }
            });
            $scope.$on('setting-update-clusterMarkers',function(event,data){
                $scope.doCluster = data.value;
            });
            function executeFilter() {
                if(FilterService.hasFilterChanged() && FilterService.hasSufficientCriteria()) {
                    $timeout(function(){
                        $scope.results.markers = [];
                        $timeout(function(){
                            FilterService.execute().then(function(markers) {
                                //$log.debug('markers',markers);
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
                $log.debug('update data',data);
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
.directive('networkFilterTag',['FilterService','SettingsService',function(FilterService,SettingsService){
    return {
        restrict: 'E',
        require: '^filterTags',
        templateUrl: 'js/filter/networkFilterTag.html',
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
            $scope.$on('filter-phase1-start',function(event,data) {
                $scope.arg.resetCounts('?');
            });
            $scope.$on('filter-phase2-start',function(event,data) {
                $scope.arg.resetCounts(0);
            });
        }
    };
}])
.directive('filterControl',['$http','$filter','$timeout','FilterService','DateFilterArg','SpeciesFilterArg','NetworkFilterArg',
    function($http,$filter,$timeout,FilterService,DateFilterArg,SpeciesFilterArg,NetworkFilterArg){
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

            $scope.selected = {
                date: {
                    start_date: (thisYear-1),
                    end_date: thisYear
                },
                species: []
            };

            $scope.addNetworksToFilter = function() {
                angular.forEach($scope.speciesInput.networks,function(network){
                    FilterService.addToFilter(new NetworkFilterArg(network));
                });
            };
            $scope.addSpeciesToFilter = function() {
                angular.forEach($scope.selected.species,function(species){
                    FilterService.addToFilter(new SpeciesFilterArg(species));
                });
            };
            $scope.speciesInput = {
                animals: [],
                plants: [],
                networks: []
            };
            $scope.findSpeciesParamsEmpty = true;

            var findSpeciesParams,
                findSpeciesPromise,
                allSpecies,
                filterInvalidated = true;

            function invalidateResults() {
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
                filterInvalidated = true;
            }

            $scope.$watch('speciesInput.animals',invalidateResults);
            $scope.$watch('speciesInput.plants',invalidateResults);
            $scope.$watch('speciesInput.networks',invalidateResults);

            $scope.findSpecies = function() {
                if(filterInvalidated) {
                    filterInvalidated = false;
                    angular.forEach($scope.selected.species,function(species){
                        species.selected = false;
                    });
                    $scope.selected.species = [];
                    if($scope.findSpeciesParamsEmpty && allSpecies && allSpecies.length) {
                        $scope.speciesList = allSpecies;
                    } else {
                        $scope.findingSpecies = true;
                        $scope.serverResults = $http.get('/npn_portal/species/getSpeciesFilter.json',{
                            params: findSpeciesParams
                        }).then(function(response){
                            var species = [];
                            angular.forEach(response.data,function(s){
                                s.number_observations = parseInt(s.number_observations);
                                s.display = $filter('speciesTitle')(s)+' ('+s.number_observations+')';
                                species.push(s);
                            });
                            var results = ($scope.speciesList = species.sort(function(a,b){
                                if(a.number_observations < b.number_observations) {
                                    return 1;
                                }
                                if(a.number_observations > b.number_observations) {
                                    return -1;
                                }
                                return 0;
                            }));
                            if($scope.findSpeciesParamsEmpty) {
                                allSpecies = results;
                            }
                            // this is a workaround to an issue where ng-class isn't getting kicked
                            // when this flag changes...
                            $timeout(function(){
                                $scope.findingSpecies = false;
                            },250);
                            return results;
                        });
                    }
                }
            };
            // update labels if the setting changes.
            $scope.$on('setting-update-tagSpeciesTitle',function(event,data){
                $timeout(function(){
                    angular.forEach($scope.speciesList,function(s){
                        s.display = $filter('speciesTitle')(s)+' ('+s.number_observations+')';
                    });
                },250);
            });
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
            // load up "all" species...
            $scope.findSpecies();
        }]
    };
}]);