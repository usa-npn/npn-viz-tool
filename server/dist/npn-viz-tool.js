/*
 * Regs-Dot-Gov-Directives
 * Version: 0.1.0 - 2015-04-09
 */

angular.module('npn-viz-tool.bounds',[
    'npn-viz-tool.filter',
    'uiGmapgoogle-maps'
])
.directive('boundsManager',['$rootScope','$log','uiGmapGoogleMapApi','FilterService','BoundsFilterArg',
    function($rootScope,$log,uiGmapGoogleMapApi,FilterService,BoundsFilterArg){
    return {
        restrict: 'E',
        template: '<ui-gmap-drawing-manager options="options" control="control"></ui-gmap-drawing-manager>',
        controller: ['$scope',function($scope) {
            function refilter() {
                if(FilterService.getFilter().hasSufficientCriteria()) {
                    $rootScope.$broadcast('filter-rerun-phase2',{});
                }
            }
            uiGmapGoogleMapApi.then(function(maps) {
                var mapsApi = maps,
                    dcOptions = {
                        drawingModes: [mapsApi.drawing.OverlayType.RECTANGLE],
                        position: mapsApi.ControlPosition.BOTTOM_LEFT,
                        drawingControl: false
                    };
                $log.debug('api',maps);
                $scope.options = {
                    drawingControlOptions: dcOptions,
                    rectangleOptions: BoundsFilterArg.RECTANGLE_OPTIONS
                };
                $scope.control = {};
                $scope.$on('bounds-filter-ready',function(event,data){
                    mapsApi.event.addListener(data.filter.arg,'mouseover',function(){
                        data.filter.arg.setOptions(angular.extend({},BoundsFilterArg.RECTANGLE_OPTIONS,{strokeWeight: 2}));
                    });
                    mapsApi.event.addListener(data.filter.arg,'mouseout',function(){
                        data.filter.arg.setOptions(BoundsFilterArg.RECTANGLE_OPTIONS);
                    });
                    mapsApi.event.addListener(data.filter.arg,'click',function(){
                        FilterService.removeFromFilter(data.filter);
                        refilter();
                    });
                });
                $scope.$watch('control.getDrawingManager',function(){
                    if($scope.control.getDrawingManager){
                        var drawingManager = $scope.control.getDrawingManager();
                        mapsApi.event.addListener(drawingManager,'rectanglecomplete',function(rectangle){
                            FilterService.addToFilter(new BoundsFilterArg(rectangle));
                            refilter();
                        });
                        $scope.$on('filter-reset',function(event,data){
                            dcOptions.drawingControl = false;
                            drawingManager.setOptions(dcOptions);
                        });
                        $scope.$on('filter-update',function(event,data){
                            dcOptions.drawingControl = FilterService.hasSufficientCriteria();
                            drawingManager.setOptions(dcOptions);
                        });
                    }
                });

            });
        }]
    };
}]);
angular.module('npn-viz-tool.vis-calendar',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'ui.bootstrap'
])
.controller('CalendarVisCtrl',['$scope','$modalInstance','$http','$timeout','$filter','$log','FilterService','ChartService',
    function($scope,$modalInstance,$http,$timeout,$filter,$log,FilterService,ChartService){
    var data, // the data from the server....
        dateArg = FilterService.getFilter().getDateArg(),
        sizing = ChartService.getSizeInfo({top: 20, right: 30, bottom: 35, left: 30}),
        chart,
        d3_month_fmt = d3.time.format('%B'),
        x = d3.scale.ordinal().rangeBands([0,sizing.width]).domain(d3.range(1,366)),
        xAxis = d3.svg.axis().scale(x).orient('bottom').tickValues(xTickValues()).tickFormat(formatXTickLabels),
        y = d3.scale.ordinal().rangeBands([sizing.height,0]).domain(d3.range(0,6)),
        yAxis = d3.svg.axis().scale(y).orient('right').tickSize(sizing.width).tickFormat(function(d) {
            return d;
        }).tickFormat(formatYTickLabels);

    $scope.validYears = d3.range(1900,((new Date()).getFullYear()+1));
    $scope.modal = $modalInstance;
    $scope.colorScale = FilterService.getColorScale();
    $scope.colors = $scope.colorScale.domain();
    $scope.selection = {
        color: 0,
        year: (new Date()).getFullYear()
    };
    $scope.plottable = [];
    angular.forEach(FilterService.getFilter().getSpeciesArgs(),function(sarg) {
        $scope.plottable.push(angular.extend({},sarg.arg,{phenophase_id: -1, phenophase_name: 'All phenophases'}));
        angular.forEach(sarg.phenophases,function(pp){
            $scope.plottable.push(angular.extend({},sarg.arg,pp));
        });
    });
    $log.debug('plottable',$scope.plottable);
    $scope.toPlotYears = [];
    $scope.toPlot = [];

    $scope.addYear = function() {
        if($scope.selection.year) {
            $scope.toPlotYears.push($scope.selection.year);
            $scope.toPlotYears.sort();
            $scope.data = data = undefined;
        }
    };
    $scope.canAddYear = function() {
        return $scope.toPlotYears.length < 2 && // no more than 2
               $scope.selection.year && // anything to add?
               $scope.toPlotYears.indexOf($scope.selection.year) === -1 && // already added?
               $scope.validYears.indexOf($scope.selection.year) !== -1; // valid to add period?
    };
    $scope.removeYear = function(idx) {
        $scope.toPlotYears.splice(idx,1);
        $scope.data = data = undefined;
    };

    function getNewToPlot(tp) {
        var base = tp||$scope.selection.toPlot;
        return angular.extend({},base,{color: $scope.selection.color});
    }
    $scope.canAddToPlot = function() {
        if(!$scope.selection.toPlot) {
            return false;
        }
        if($scope.toPlot.length === 0) {
            return true;
        }
        var next = getNewToPlot(),i;
        for(i = 0; i < $scope.toPlot.length; i++) {
            if(angular.equals($scope.toPlot[i],next)) {
                return false;
            }
        }
        for(i = 0; i < $scope.toPlot.length; i++) {
            if(next.color === $scope.toPlot[i].color) {
                return false;
            }
        }
        return true;
    };

    // can't initialize the chart until the dialog is rendered so postpone its initialization a short time.
    $timeout(function(){
        chart = d3.select('.chart')
            .attr('width', sizing.width + sizing.margin.left + sizing.margin.right)
            .attr('height', sizing.height + sizing.margin.top + sizing.margin.bottom)
          .append('g')
            .attr('transform', 'translate(' + sizing.margin.left + ',' + sizing.margin.top + ')');

          chart.append('g')
              .attr('class', 'x axis')
              .attr('transform', 'translate(0,' + sizing.height + ')')
              .call(xAxis);

          chart.append('g')
              .attr('class', 'y axis')
              .call(yAxis)
              .call(moveYTickLabels);
    },500);

    function advanceColor() {
        if($scope.selection.color < 19) {
            $scope.selection.color++;
        } else {
            $scope.selection.color = 0;
        }
    }
    function removeSpeciesFromPlot(species_id) {
        for(;;){
            var idx = -1,i;
            for(i = 0; i < $scope.toPlot.length; i++) {
                if($scope.toPlot[i].species_id === species_id) {
                    idx = i;
                    break;
                }
            }
            if(idx === -1) {
                break;
            } else {
                $scope.removeFromPlot(idx);
            }
        }
    }
    function addToPlot(toPlot) {
        $log.debug('addToPlot',toPlot);
        if(toPlot) {
            if(toPlot.phenophase_id === -1) {
                $log.debug('add all phenophases...');
                removeSpeciesFromPlot(toPlot.species_id);
                $scope.plottable.filter(function(p){
                    return p.phenophase_id !== -1 && p.species_id === toPlot.species_id;
                }).forEach(function(tp){
                    addToPlot(tp);
                });
            } else {
                $scope.toPlot.push(getNewToPlot(toPlot));
                advanceColor();
            }
            $scope.data = data = undefined;
        }
    }
    $scope.addToPlot = function() {
        addToPlot($scope.selection.toPlot);
    };
    $scope.removeFromPlot = function(idx) {
        $scope.toPlot.splice(idx,1);
        $scope.data = data = undefined;
    };

    $scope.yAxisConfig = {
        labelOffset: 4,
        bandPadding: 0.5,
        fontSize: 0.9
    };
    function moveYTickLabels(g) {
      var dy = -1*((y.rangeBand()/2)+$scope.yAxisConfig.labelOffset);
      g.selectAll('text')
          .attr('x', 0)
          .attr('dy', dy)
          .attr('style', 'text-anchor: start; font-size: '+$scope.yAxisConfig.fontSize+'em;');
    }
    function updateYAxis(){
        y.rangeBands([sizing.height,0],$scope.yAxisConfig.bandPadding,0.5);
        if(data && data.labels) {
            y.domain(d3.range(0,data.labels.length));
        }
        yAxis.scale(y);
        if(chart) {
            chart.selectAll('g .y.axis').call(yAxis).call(moveYTickLabels);
        }
    }
    $scope.$watch('yAxisConfig.labelOffset',draw);
    $scope.$watch('yAxisConfig.bandPadding',draw);
    $scope.$watch('yAxisConfig.fontSize',draw);
    function addFloatFixed(v,add,precision) {
        var n = v+add;
        return Number(n.toFixed(precision));
    }
    $scope.incrBandPadding = function() {
        $scope.yAxisConfig.bandPadding = addFloatFixed($scope.yAxisConfig.bandPadding,0.05,2);
    };
    $scope.decrBandPadding = function() {
        $scope.yAxisConfig.bandPadding = addFloatFixed($scope.yAxisConfig.bandPadding,-0.05,2);
    };
    $scope.incrFontSize = function() {
        $scope.yAxisConfig.fontSize = addFloatFixed($scope.yAxisConfig.fontSize,-0.05,2);
    };
    $scope.decrFontSize = function() {
        $scope.yAxisConfig.fontSize = addFloatFixed($scope.yAxisConfig.fontSize,0.05,2);
    };

    function formatYTickLabels(i) {
        return (data && data.labels && i < data.labels.length ) ? data.labels[i] : '';
    }

    // the doy of the first of each month doesn't change from year to year just what
    // day of the week days fall on so what year is used to calculate them is irrelevant
    function xTickValues() {
        var firsts = [1],i,count = 1;
        for(i = 1; i < 12; i++) {
            var date = new Date(1900,i);
            // back up 1 day
            date.setTime(date.getTime()-ChartService.ONE_DAY_MILLIS);
            count += date.getDate();
            firsts.push(count);
        }
        return x.domain().filter(function(d){
            return firsts.indexOf(d) !== -1;
        });
    }
    function formatXTickLabels(i) {
        var date = new Date(1900,0);
        date.setTime(date.getTime()+(ChartService.ONE_DAY_MILLIS*i));
        return d3_month_fmt(date);
    }

    function draw() {
        if(!data) {
            return;
        }
        $scope.working = true;
        // update the x-axis
        // since each doy is an independent line depending on the x rangeband with, etc.
        // at some sizes lines drawn side by side for subsequent days might have a tiny bit of
        // whitespace between them which isn't desired since we want them to appear as a solid band
        // SO doing two things; using a tiny but negative padding AND rounding up dx (below).
        x.rangeBands([0,sizing.width],-0.1,0.5);
        xAxis.scale(x);
        chart.selectAll('g .x.axis').call(xAxis);
        // update the y-axis
        updateYAxis();

        var doys = chart.selectAll('.doy').data(data.data);
        doys.exit().remove();
        doys.enter().insert('line',':first-child').attr('class','doy');

        var dx = Math.ceil(x.rangeBand()/2),
            dy = y.rangeBand()/2;

        doys.attr('x1', function(d) { return x(d.x)-dx; })
            .attr('y1', function(d,i) { return y(d.y)+dy; })
            .attr('x2', function(d) { return x(d.x)+dx; })
            .attr('y2', function(d,i) { return y(d.y)+dy; })
            .attr('doy-point',function(d) { return '('+d.x+','+d.y+')'; })
            .attr('stroke', function(d) { return $scope.colorScale(d.color); })
            .attr('stroke-width', y.rangeBand());

        $scope.working = false;
    }

    $scope.visualize = function() {
        if(data) {
            return draw();
        }
        $scope.working = true;
        $log.debug('visualize',$scope.selection.axis,$scope.toPlot);
        var dateArg = FilterService.getFilter().getDateArg(),
            params = {
                request_src: 'npn-vis-calendar'
            },
            colorMap = {};
        $scope.toPlotYears.forEach(function(d,i){
            params['year['+i+']'] = d;
        });
        angular.forEach($scope.toPlot,function(tp,i) {
            colorMap[tp.species_id+'.'+tp.phenophase_id] = tp.color;
            params['species_id['+i+']'] = tp.species_id;
            params['phenophase_id['+i+']'] = tp.phenophase_id;
        });
        ChartService.getPositiveDates(params,function(response){
            var speciesMap = {},toChart = {
                labels:[],
                data:[]
            },
            // starting with the largest y and decrementing down because we want to display
            // the selected data in that order (year1/1st pair, year2/1st pair, ..., year2/last pair)
            y = ($scope.toPlot.length*$scope.toPlotYears.length)-1;

            // translate arrays into maps
            angular.forEach(response,function(species){
                speciesMap[species.species_id] = species;
                var ppMap = {};
                angular.forEach(species.phenophases,function(pp){
                    ppMap[pp.phenophase_id] = pp;
                });
                species.phenophases = ppMap;
            });

            $log.debug('speciesMap',speciesMap);
            angular.forEach($scope.toPlot,function(tp){
                $log.debug('toPlot',tp);
                var species = speciesMap[tp.species_id],
                    phenophase = species.phenophases[tp.phenophase_id];
                angular.forEach($scope.toPlotYears,function(year){
                    if(phenophase) {
                        var doys = phenophase.years[year];
                        $log.debug('year',y,year,species.common_name,phenophase,doys);
                        angular.forEach(doys,function(doy){
                            toChart.data.push({
                                y: y,
                                x: doy,
                                color: tp.color // TODO - what else is needed here??
                            });
                        });
                    }
                    toChart.labels.splice(0,0,$filter('speciesTitle')(tp)+'/'+tp.phenophase_name+' ('+year+')');
                    $log.debug('y of '+y+' is for '+toChart.labels[0]);
                    y--;
                });
            });
            $scope.data = data = toChart;
            $log.debug('calendar data',data);
            draw();
        });
    };
}]);
angular.module('npn-viz-tool.filter',[
    'npn-viz-tool.settings',
    'npn-viz-tool.stations',
    'angular-md5',
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
    FilterArg.prototype.$removed = function() {
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
.factory('BoundsFilterArg',['$rootScope','FilterArg',function($rootScope,FilterArg){
    /**
     * Constructs a BoundsFilterArg.  This is just a post-processing type of filter argument which tests
     * to see if markers (stations) are within a bounding box.
     *
     * @param {Object} rectangle A Google Maps Rectangle object.
     */
    var BoundsFilterArg = function(rectangle){
        FilterArg.apply(this,arguments);
        var self = this;
        $rootScope.$broadcast('bounds-filter-ready',{filter:self});
    };
    BoundsFilterArg.RECTANGLE_OPTIONS = {
        strokeColor: '#fff',
        strokeWeight: 1,
        fillColor: '#000080',
        fillOpacity: 0.5,
        visible: true,
        zIndex: 1
    };
    BoundsFilterArg.prototype.getId = function() {
        return this.arg.getBounds().getCenter().toString();
    };
    BoundsFilterArg.prototype.getUid = function() {
        return this.getId();
    };
    BoundsFilterArg.prototype.$filter = function(marker) {
        return this.arg.getBounds().contains(new google.maps.LatLng(parseFloat(marker.latitude), parseFloat(marker.longitude)));
    };
    BoundsFilterArg.prototype.$removed = function() {
        this.arg.setMap(null);
    };
    BoundsFilterArg.prototype.toString = function() {
        var bounds = this.arg.getBounds(),
            sw = bounds.getSouthWest(),
            ne = bounds.getNorthEast();
        return sw.lat()+','+sw.lng()+':'+ne.lat()+','+ne.lng();
    };
    BoundsFilterArg.fromString = function(s,map) {
        var parts = s.split(':'),
            sw_parts = parts[0].split(','),
            sw = new google.maps.LatLng(parseFloat(sw_parts[0]),parseFloat(sw_parts[1])),
            ne_parts = parts[1].split(','),
            ne = new google.maps.LatLng(parseFloat(ne_parts[0]),parseFloat(ne_parts[1])),
            bounds = new google.maps.LatLngBounds(sw,ne),
            rect = new google.maps.Rectangle(BoundsFilterArg.RECTANGLE_OPTIONS);
        rect.setBounds(bounds);
        rect.setMap(map);
        return new BoundsFilterArg(rect);
    };
    return BoundsFilterArg;
}])
.factory('NpnFilter',['DateFilterArg','SpeciesFilterArg','NetworkFilterArg','GeoFilterArg','BoundsFilterArg',
    function(DateFilterArg,SpeciesFilterArg,NetworkFilterArg,GeoFilterArg,BoundsFilterArg){
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
    NpnFilter.prototype.getBoundsArgs = function() {
        return getValues(this.bounds);
    };
    NpnFilter.prototype.getGeographicArgs = function() {
        return this.getGeoArgs().concat(this.getBoundsArgs());
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
        } else if (item instanceof BoundsFilterArg) {
            this.bounds[item.getId()] = item;
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
            this.bounds = {};
        } else if(item instanceof SpeciesFilterArg) {
            delete this.species[item.getId()];
        } else if(item instanceof NetworkFilterArg){
            delete this.networks[item.getId()];
        } else if(item instanceof GeoFilterArg) {
            delete this.geo[item.getId()];
        } else if(item instanceof BoundsFilterArg) {
            delete this.bounds[item.getId()];
        }
        if(item.$removed) {
            item.$removed();
        }
        return (!(item instanceof GeoFilterArg) && !(item instanceof BoundsFilterArg));
    };
    function _reset(argMap) {
        if(argMap) {
            Object.keys(argMap).forEach(function(key){
                if(argMap[key].$removed) {
                    argMap[key].$removed();
                }
            });
        }
        return {};
    }
    NpnFilter.prototype.reset = function() {
        this.updateCount = 0;
        this.date = undefined;
        this.species = _reset(this.species);
        this.geo = _reset(this.geo);
        this.networks = _reset(this.networks);
        this.bounds = _reset(this.bounds);
    };
    return NpnFilter;
}])
/**
 * TODO - need to nail down the event model and probably even formalize it via a service because it's all
 * pretty loosey goosey at the moment.  Bad enough duplicating strings around...
 */
.factory('FilterService',['$q','$http','$rootScope','$timeout','$log','$filter','uiGmapGoogleMapApi','md5','NpnFilter','SpeciesFilterArg','SettingsService',
    function($q,$http,$rootScope,$timeout,$log,$filter,uiGmapGoogleMapApi,md5,NpnFilter,SpeciesFilterArg,SettingsService){
    // NOTE: this scale is limited to 20 colors
    var colors = [
          '#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#7b4173','#bcbd22', '#637939', '#843c39',
          '#e377c2', '#5254a3', '#e7ba52', '#222299', '#636363', '#f03b20', '#c51b8a', '#1b9e77', '#ef8a62', '#91cf60'
        ],
        color_domain = d3.range(0,colors.length),
        colorScale = d3.scale.ordinal().domain(color_domain).range(color_domain.map(function(i){
          return d3.rgb(colors[i]).darker(1.0).toString();
        })),
        choroplethScales = color_domain.map(function(i) {
            var maxColor = colorScale(i),
                minColor = d3.rgb(maxColor).brighter(4.0).toString();
            return d3.scale.linear().range([minColor,maxColor]);
        }),
        filter = new NpnFilter(),
        filterUpdateCount,
        paused = false,
        defaultIcon = {
            //path: google.maps.SymbolPath.CIRCLE,
            //'M 125,5 155,90 245,90 175,145 200,230 125,180 50,230 75,145 5,90 95,90 z',
            fillColor: '#00ff00',
            fillOpacity: 1.0,
            scale: 8,
            strokeColor: '#204d74',
            strokeWeight: 1
        },
        last,
        lastFiltered = [];
    // now that the boundaries of the choropleth scales have been built
    // reset the color scale to use the median color rather than the darkest
    choroplethScales.forEach(function(s){
        s.domain([0,20]);
    });
    colorScale = d3.scale.ordinal().domain(color_domain).range(color_domain.map(function(d){
        return choroplethScales[d](11);
    }));
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
            angular.forEach(filter.getGeographicArgs(),function(arg){
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
            filters = filter.getGeographicArgs(),
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
            hasSpeciesArgs = filter.getSpeciesArgs().length > 0,
            networkArgs = filter.getNetworkArgs(),
            speciesTitle = $filter('speciesTitle'),
            speciesTitleFormat = SettingsService.getSettingValue('tagSpeciesTitle'),
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
                station.speciesInfo = undefined;

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
                        updateNetworkCounts(station,station.species[sid]);
                        if(!station.speciesInfo){
                            station.speciesInfo = {
                                titles: {},
                                counts: {}
                            };
                        }
                        station.speciesInfo.titles[sid] = speciesTitle(speciesFilter.arg,speciesTitleFormat);
                        station.speciesInfo.counts[sid] = n;
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
                station.markerOpts.title = station.station_name + ' ('+station.observationCount+')';
                if(station.speciesInfo) {
                    station.markerOpts.title += ' ['+
                        Object.keys(station.speciesInfo.titles).map(function(sid){
                            return station.speciesInfo.titles[sid];
                        }).join(',')+']';
                }
                station.markerOpts.icon.strokeColor = (hitMap['n'] > 1) ? '#00ff00' : defaultIcon.strokeColor;
                station.markerOpts.zIndex = station.observationCount + 2; // layers are on 0 and bounds 1 so make sure a marker's zIndex is at least 3
                return keeps > 0;
            }).map(function(m){
                // simplify the contents of the filtered marker results o/w there's a ton of data that
                // angular copies on a watch which slows things WAY down for some browsers in particular (FireFox ahem)
                return {
                    latitude: m.latitude,
                    longitude: m.longitude,
                    markerOpts: m.markerOpts,
                    station_id: m.station_id,
                    station_name: m.station_name,
                    observationCount: m.observationCount,
                    speciesInfo: m.speciesInfo
                };
            });
        if(hasSpeciesArgs) {
            // for all markers pick the species with the highest observation density as its color
            // on this pass build spRanges which will contain the min/max count for every species
            // for use the next pass.
            var spRanges = {};
            filtered.forEach(function(m){
                var sids = Object.keys(m.speciesInfo.counts),
                    maxSid = sids.length === 1 ?
                        sids[0] :
                        sids.reduce(function(p,c){
                            if(!spRanges[c]) {
                                spRanges[c] = {
                                    min: m.speciesInfo.counts[c],
                                    max: m.speciesInfo.counts[c]
                                };
                            } else {
                                if(m.speciesInfo.counts[c] < spRanges[c].min) {
                                    spRanges[c].min = m.speciesInfo.counts[c];
                                }
                                if(m.speciesInfo.counts[c] > spRanges[c].max) {
                                    spRanges[c].max = m.speciesInfo.counts[c];
                                }
                            }
                            return (m.speciesInfo.counts[c] > m.speciesInfo.counts[p]) ? c : p;
                        },sids[0]),
                    arg = filter.getSpeciesArg(maxSid);
                m.markerOpts.icon.fillColorIdx = arg.colorIdx;
            });
            // sort markers into buckets based on color and then choropleth colors based on observationCount
            filter.getSpeciesArgs().forEach(function(arg) {
                var argMarkers = filtered.filter(function(m) {
                        return arg.colorIdx === m.markerOpts.icon.fillColorIdx;
                    }),
                    sid = arg.arg.species_id,
                    minCount = spRanges[sid].min,
                    maxCount = spRanges[sid].max;
                $log.debug('observationCount variability for '+arg.toString()+ ' ('+arg.arg.common_name+') ['+ minCount + '-' + maxCount + ']');
                var choroplethScale = choroplethScales[arg.colorIdx];
                choroplethScale.domain([minCount,maxCount]);
                argMarkers.forEach(function(marker){
                    marker.markerOpts.icon.fillColor = choroplethScale(marker.speciesInfo.counts[sid]);
                });
            });
        } else {
            // network only filter, choropleth markers based on overall observation counts
            var minCount = d3.min(filtered,function(d) { return d.observationCount; }),
                maxCount = d3.max(filtered,function(d) { return d.observationCount; });
            $log.debug('observationCount variability for network only results ['+ minCount + '-' + maxCount + ']');
            choroplethScales[0].domain([minCount,maxCount]);
            filtered.forEach(function(marker){
                marker.markerOpts.icon.fillColorIdx = 0;
                marker.markerOpts.icon.fillColor = choroplethScales[0](marker.observationCount);
            });
        }
        // build $markerKey based on marker contents -last- so the key encompasses all marker content.
        filtered.forEach(function(m){
            // use a hash for the markerKey so that only when things have changed is the marker
            // updated by the map for performance.  turns out that using things like colors was insufficient
            // in cases where the counts changed but choropleth colors amazingly stayed the same (relative counts)
            // would result in bad behavior.
            m.$markerKey = md5.createHash(JSON.stringify(m));
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
        },
        getChoroplethScale: function(sid) {
            var arg = filter.getSpeciesArg(sid);
            if(arg) {
                return choroplethScales[arg.colorIdx];
            }
        },
        getChoroplethScales: function() {
            return choroplethScales;
        }
    };
}])
.directive('npnFilterResults',['$rootScope','$http','$timeout','$filter','$log','FilterService','SettingsService','StationService',
    function($rootScope,$http,$timeout,$filter,$log,FilterService,SettingsService,StationService){
    return {
        restrict: 'E',
        template: '<ui-gmap-markers models="results.markers" idKey="\'$markerKey\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" doCluster="doCluster" clusterOptions="clusterOptions" control="mapControl" events="markerEvents"></ui-gmap-markers>',
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
            function updateMarkers(markers) {
                var totalOcount = markers.reduce(function(n,c) { return n+c.observationCount; },0),
                    n = (totalOcount > 512 ? Math.round(totalOcount/2) : 512),i;
                for(i = styles.length-1; i >= 0; i--) {
                    styles[i].n = n;
                    n = Math.round(n/2);
                }
                $scope.results.markers = markers;
            }
            function executeFilter() {
                if(FilterService.hasFilterChanged() && FilterService.hasSufficientCriteria()) {
                    $timeout(function(){
                        $scope.results.markers = [];
                        $timeout(function(){
                            FilterService.execute().then(function(markers) {
                                updateMarkers(markers);
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
                updateMarkers(data.markers);
            });
            var markerEvents = StationService.getMarkerEvents();
            $scope.markerEvents = {
                'click' : markerEvents.click,
                'mouseover' : function(m){
                    $rootScope.$broadcast('marker-mouseover',{ marker: m });
                },
                'mouseout' : function(m){
                    $rootScope.$broadcast('marker-mouseout',{ marker: m });
                }
            };
        }
    };
}])
.directive('choroplethInfo',['$log','$timeout','FilterService',function($log,$timeout,FilterService){
    return {
        restrict: 'E',
        templateUrl: 'js/filter/choroplethInfo.html',
        controller: function($scope) {
            var mouseIn = false;
            $scope.show = false;
            function selectColor(val) {
                var range = Math.ceil(val.domain[1]/20),i,n;
                for(i = 0;i < 20; i++) {
                    n = (range*i)+1;
                    val.colors[i] = val.scale(n);
                    if(val.count >= n) {
                       val.color = val.colors[i]; // this isn't exact but pick the "closest" color
                    }
                }
                return val;
            }
            $scope.$on('marker-mouseover',function(event,data){
                $log.debug('mouseover',data);
                if(data.marker.model.speciesInfo || data.marker.model.observationCount) {
                    mouseIn = true;
                    $timeout(function(){
                        if($scope.show = mouseIn) {
                            $scope.station_name = data.marker.model.station_name;
                            var scales = FilterService.getChoroplethScales();
                            if(data.marker.model.speciesInfo) {
                                var sids = Object.keys(data.marker.model.speciesInfo.counts);

                                $scope.data = sids.map(function(sid){
                                    var arg = FilterService.getFilter().getSpeciesArg(sid),
                                        val = {
                                            sid: sid,
                                            count: data.marker.model.speciesInfo.counts[sid],
                                            title: data.marker.model.speciesInfo.titles[sid],
                                            arg: arg,
                                            scale: scales[arg.colorIdx],
                                            domain: scales[arg.colorIdx].domain(),
                                            colors: []
                                        };
                                    return selectColor(val);
                                });
                            } else if (data.marker.model.observationCount) {
                                var v = {
                                    count: data.marker.model.observationCount,
                                    title: 'All Observations',
                                    scale: scales[0],
                                    domain: scales[0].domain(),
                                    colors: []
                                };
                                $scope.data = [selectColor(v)];
                            }
                            $log.debug($scope.data);
                        }
                    },500);
                }
            });
            $scope.$on('marker-mouseout',function(event,data){
                $log.debug('mouseout',data);
                mouseIn = false;
                if($scope.show) {
                    $timeout(function(){
                        if(!mouseIn){
                            $scope.show = false;
                            $scope.data = undefined;
                        }
                    },500);

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
.factory('LayerService',['$rootScope','$http','$q','$log','uiGmapIsReady',function($rootScope,$http,$q,$log,uiGmapIsReady){
    var layers = null,
        map = null,
        readyPromise = uiGmapIsReady.promise(1).then(function(instances){
            map = instances[0].map;
            $log.debug('LayerService - map is ready');
            return $http.get('layers/layers.json').success(function(data) {
                layers = {};
                data.forEach(function(layer,idx){
                    layer.index = idx;
                    layers[layer.id] = layer;
                });
                $log.debug('LayerService - layer list is loaded', layers);
            });
        }),
        baseStyle = {
            strokeColor: '#ffffff',
            strokeOpacity: null,
            strokeWeight: 1,
            fillColor: '#c0c5b8',
            fillOpacity: null,
            zIndex: 0
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
                    $log.debug('Translating GeometryCollection to FeatureCollection');
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
                    $log.debug('no such layer with id',id);
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
                    $log.debug('no such layer with id',id);
                    return def.reject(id);
                }
                var unloaded = unloadLayer(layer);
                def.resolve(unloaded);
            });
            return def.promise;
        }
    };
}])
.directive('layerControl',['$rootScope','$q','$location','$log','LayerService','FilterService','GeoFilterArg',function($rootScope,$q,$location,$log,LayerService,FilterService,GeoFilterArg){
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
                $log.debug('av.layers',layers);
                $scope.layers = layers;
                var qargs = $location.search();
                if(qargs['g']) {
                    $log.debug('init layers from query arg',qargs['g']);
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
                    if(FilterService.getFilter().hasSufficientCriteria()) {
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
                        var geoArgs = FilterService.getFilter().getGeoArgs(),
                            filterUpdate = geoArgs.length > 0;
                        geoArgs.forEach(function(filterArg){
                            FilterService.removeFromFilter(filterArg);
                        });
                        unloaded.forEach(function(feature) {
                            feature.setProperty('$FILTER',null);
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
.config(['uiGmapGoogleMapApiProvider','$logProvider',function(uiGmapGoogleMapApiProvider,$logProvider) {
    uiGmapGoogleMapApiProvider.configure({
        //    key: 'your api key',
        v: '3.17',
        libraries: ['geometry','drawing']
    });
    $logProvider.debugEnabled(window.location.hash && window.location.hash.match(/^#\/debug/));
}]);

angular.module('npn-viz-tool.map',[
    'npn-viz-tool.layers',
    'npn-viz-tool.stations',
    'npn-viz-tool.toolbar',
    'npn-viz-tool.filter',
    'npn-viz-tool.bounds',
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
                api,
                map;
            $scope.stationView = false;
            uiGmapGoogleMapApi.then(function(maps) {
                api = maps;
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
                // this is a little leaky, the map knows which args the "share" control cares about...
                // date is the minimum requirement for filtering.
                var qargs = $location.search(),
                    qArgFilter = qargs['d'] && (qargs['s'] || qargs['n']);
                $scope.stationView = !qArgFilter;

                // constrain map movement to N America
                var allowedBounds = new api.LatLngBounds(
                         new google.maps.LatLng(0.0,-174.0),// SW - out in the pacific SWof HI
                         new google.maps.LatLng(75.0,-43.0) // NE - somewhere in greenland
                    ),
                    lastValidCenter = map.getCenter();
                if(qargs['allowedBounds']) {
                    var allowedBoundsRectangle = new api.Rectangle();
                    allowedBoundsRectangle.setOptions({
                      strokeColor: '#FFF',
                      strokeOpacity: 0.8,
                      strokeWeight: 2,
                      fillColor: '#FFF',
                      fillOpacity: 0.35,
                      map: map,
                      bounds: allowedBounds
                    });
                }
                api.event.addListener(map,'center_changed',function(){
                    if(allowedBounds.contains(map.getCenter())) {
                        lastValidCenter = map.getCenter();
                        return;
                    }
                    map.panTo(lastValidCenter);
                });
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
angular.module('templates-npnvis', ['js/calendar/calendar.html', 'js/filter/choroplethInfo.html', 'js/filter/dateFilterTag.html', 'js/filter/filterControl.html', 'js/filter/filterTags.html', 'js/filter/networkFilterTag.html', 'js/filter/speciesFilterTag.html', 'js/layers/layerControl.html', 'js/map/map.html', 'js/scatter/scatter.html', 'js/settings/settingsControl.html', 'js/toolbar/tool.html', 'js/toolbar/toolbar.html', 'js/vis/visControl.html', 'js/vis/visDialog.html']);

angular.module("js/calendar/calendar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/calendar/calendar.html",
    "<vis-dialog title=\"Calendar\" modal=\"modal\">\n" +
    "<form class=\"form-inline plot-criteria-form\">\n" +
    "    <div class=\"form-group\">\n" +
    "        <label for=\"yearsOneInput\">Select up to two years</label>\n" +
    "        <input id=\"yearsOneInput\" type=\"number\" class=\"form-control\"\n" +
    "               ng-model=\"selection.year\"\n" +
    "               typeahead=\"year for year in validYears | filter:$viewValue\"\n" +
    "               required placeholder=\"Year\" />\n" +
    "        <button class=\"btn btn-default\" ng-click=\"addYear()\" ng-disabled=\"!canAddYear()\"><i class=\"fa fa-plus\"></i></button>\n" +
    "    </div>\n" +
    "    <div class=\"form-group animated-show-hide\">\n" +
    "        <label for=\"toPlotInput\">Species phenophase combinations</label>\n" +
    "        <select name=\"toPlotInput\" class=\"form-control\" ng-model=\"selection.toPlot\" ng-options=\"o.phenophase_name group by (o|speciesTitle) for o in plottable\"></select>\n" +
    "        <div class=\"btn-group\" dropdown is-open=\"selection.color_isopen\">\n" +
    "          <button type=\"button\" class=\"btn btn-default dropdown-toggle\" dropdown-toggle style=\"background-color: {{colorScale(selection.color)}};\">\n" +
    "            &nbsp; <span class=\"caret\"></span>\n" +
    "          </button>\n" +
    "          <ul class=\"dropdown-menu\" role=\"menu\">\n" +
    "            <li ng-repeat=\"i in colors track by $index\" style=\"background-color: {{colorScale($index)}};\"><a href ng-click=\"selection.color=$index;\">&nbsp;</a></li>\n" +
    "          </ul>\n" +
    "        </div>\n" +
    "        <button class=\"btn btn-default\" ng-click=\"addToPlot()\" ng-disabled=\"!canAddToPlot()\"><i class=\"fa fa-plus\"></i></button>\n" +
    "    </div>\n" +
    "</form>\n" +
    "\n" +
    "<div class=\"panel panel-default main-vis-panel\" >\n" +
    "    <div class=\"panel-body\">\n" +
    "        <center>\n" +
    "        <ul class=\"to-plot list-inline animated-show-hide\" ng-if=\"toPlot.length || toPlotYears.length\">\n" +
    "            <li class=\"criteria\" ng-repeat=\"y in toPlotYears\">{{y}}\n" +
    "                <a href ng-click=\"removeYear($index)\"><i class=\"fa fa-times-circle-o\"></i></a>\n" +
    "            </li>\n" +
    "            <li class=\"criteria\" ng-repeat=\"tp in toPlot\">{{tp|speciesTitle}}/{{tp.phenophase_name}} <i style=\"color: {{colorScale(tp.color)}};\" class=\"fa fa-circle\"></i>\n" +
    "                <a href ng-click=\"removeFromPlot($index)\"><i class=\"fa fa-times-circle-o\"></i></a>\n" +
    "            </li>\n" +
    "            <li ng-if=\"!data && toPlotYears.length && toPlot.length\"><button class=\"btn btn-primary\" ng-click=\"visualize()\">Visualize</button></li>\n" +
    "        </ul>\n" +
    "        <div id=\"vis-container\">\n" +
    "            <div id=\"vis-working\" ng-show=\"working\"><i class=\"fa fa-circle-o-notch fa-spin fa-5x\"></i></div>\n" +
    "            <svg class=\"chart\"></svg>\n" +
    "        </div>\n" +
    "        </center>\n" +
    "        <ul class=\"list-inline calendar-chart-controls\" ng-if=\"data\" style=\"float: right;\">\n" +
    "            <li>Label Size\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"incrFontSize()\" ng-disabled=\"yAxisConfig.fontSize <= 0.5\"><i class=\"fa fa-minus\"></i></a>\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"decrFontSize()\"><i class=\"fa fa-plus\"></i></a>\n" +
    "            </li>\n" +
    "            <li>Label Position\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"yAxisConfig.labelOffset=(yAxisConfig.labelOffset-1)\"><i class=\"fa fa-minus\"></i></a>\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"yAxisConfig.labelOffset=(yAxisConfig.labelOffset+1)\"><i class=\"fa fa-plus\"></i></a>\n" +
    "            </li>\n" +
    "            <li>Band Size\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"incrBandPadding()\" ng-disabled=\"yAxisConfig.bandPadding >= 0.95\"><i class=\"fa fa-minus\"></i></a>\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"decrBandPadding()\" ng-disabled=\"yAxisConfig.bandPadding <= 0.05\"><i class=\"fa fa-plus\"></i></a>\n" +
    "            </li>\n" +
    "        </ul>\n" +
    "    </div>\n" +
    "</div>\n" +
    "\n" +
    "</vis-dialog>");
}]);

angular.module("js/filter/choroplethInfo.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/choroplethInfo.html",
    "<div id=\"choroplethHelp\" ng-show=\"show\">\n" +
    "    <h4>{{station_name}}</h4>\n" +
    "    <h5>Observation Densit{{data.length == 1 ? 'y' : 'ies'}}</h5>\n" +
    "    <ul class=\"list-unstyled\">\n" +
    "        <li ng-repeat=\"scale in data\">\n" +
    "            <label>{{scale.title}} ({{scale.count}})</label>\n" +
    "            <ul class=\"list-inline color-scale\">\n" +
    "                <li ng-repeat=\"color in scale.colors\" style=\"background-color: {{color}};\" class=\"{{scale.color === color ? 'selected' :''}}\">\n" +
    "                    <div ng-if=\"$first\">{{scale.domain[0]}}</div>\n" +
    "                    <div ng-if=\"$last\">{{scale.domain[1]}}</div>\n" +
    "                </li>\n" +
    "            </ul>\n" +
    "        </li>\n" +
    "    </li>\n" +
    "</div>");
}]);

angular.module("js/filter/dateFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/dateFilterTag.html",
    "<div class=\"btn-group filter-tag date\">\n" +
    "    <a class=\"btn btn-default\">\n" +
    "        <span popover-placement=\"bottom\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "              popover-trigger=\"mouseenter\" popover=\"Indicates the span of time represented on the map\">{{arg.arg.start_date}} - {{arg.arg.end_date}} </span>\n" +
    "        <span class=\"badge\"\n" +
    "              popover-placement=\"bottom\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "              popover-trigger=\"mouseenter\" popover=\"{{badgeTooltip}}\">{{counts | speciesBadge:badgeFormat}}</span>\n" +
    "    </a>\n" +
    "    <a class=\"btn btn-default\" ng-click=\"removeFromFilter(arg)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </a>\n" +
    "</div>");
}]);

angular.module("js/filter/filterControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/filterControl.html",
    "<ul class=\"list-unstyled\">\n" +
    "    <li>\n" +
    "        <label for=\"yearInputForm\">Select up to ten (consecutive) years</label>\n" +
    "        <form id=\"yearInputForm\" name=\"yearInputForm\">\n" +
    "        <input id=\"start_date\" type=\"number\" class=\"form-control\"\n" +
    "               max=\"{{selected.date.end_date || thisYear}}\"\n" +
    "               ng-model=\"selected.date.start_date\"\n" +
    "               typeahead=\"year for year in validYears | lte:selected.date.end_date | filter:$viewValue\"\n" +
    "               required placeholder=\"From\" /> - \n" +
    "        <input id=\"end_date\" type=\"number\" class=\"form-control\"\n" +
    "                min=\"{{selected.date.start_date || 1900}}\"\n" +
    "                ng-model=\"selected.date.end_date\"\n" +
    "                typeahead=\"year for year in validYears | gte:selected.date.start_date | filter:$viewValue\"\n" +
    "                required placeholder=\"To\" />\n" +
    "        <button class=\"btn btn-default\"\n" +
    "                ng-disabled=\"yearInputForm.$invalid || ((selected.date.end_date - selected.date.start_date) > 10)\"\n" +
    "                ng-click=\"addDateRangeToFilter()\"\n" +
    "                popover-placement=\"right\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "                popover-trigger=\"mouseenter\" popover=\"Add this filter to the map\"><i class=\"fa fa-plus\"></i></button>\n" +
    "        </form>\n" +
    "        <p ng-if=\"selected.date.start_date < 2008\" class=\"disclaimer\">\n" +
    "            You have selected a starting year prior to 2008 when the contemprary phenology data begins.  Prior to 2008 there is\n" +
    "            a much more limited set of historical data and a limited number of species (E.g. lilac and honeysuckle).\n" +
    "        </p>\n" +
    "    </li>\n" +
    "    <li class=\"divider\" ng-if=\"filterHasDate()\"></li>\n" +
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
    "            helper-elements=\"all none reset filter\"\n" +
    "            on-close=\"findSpecies()\"></div>\n" +
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
    "            helper-elements=\"all none reset filter\"\n" +
    "            on-close=\"findSpecies()\"></div>\n" +
    "    </li>\n" +
    "    <li ng-if=\"filterHasDate()\">\n" +
    "        <label>Partners</label>\n" +
    "        <div class=\"row\">\n" +
    "            <div class=\"col-xs-9\">\n" +
    "                <div isteven-multi-select\n" +
    "                    max-labels=\"3\"\n" +
    "                    input-model=\"partners\"\n" +
    "                    output-model=\"speciesInput.networks\"\n" +
    "                    button-label=\"network_name\"\n" +
    "                    item-label=\"network_name\"\n" +
    "                    tick-property=\"selected\"\n" +
    "                    orientation=\"horizontal\"\n" +
    "                    helper-elements=\"all none reset filter\"\n" +
    "                    on-close=\"findSpecies()\"></div>\n" +
    "            </div>\n" +
    "            <div class=\"col-xs-3\">\n" +
    "                <button class=\"btn btn-default\" ng-disabled=\"!speciesInput.networks.length\" ng-click=\"addNetworksToFilter()\"\n" +
    "                        popover-placement=\"right\" popover-popup-delay=\"500\"\n" +
    "                        popover-trigger=\"mouseenter\" popover=\"Add this filter to the map\" popover-append-to-body=\"true\">\n" +
    "                    <i class=\"fa fa-plus\"></i>\n" +
    "                </button>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "\n" +
    "    </li>\n" +
    "    <li ng-if=\"filterHasDate()\">\n" +
    "        <label for=\"species\">Species</label>\n" +
    "        <div class=\"row\">\n" +
    "            <div class=\"col-xs-9\">\n" +
    "                <div isteven-multi-select\n" +
    "                    max-labels=\"3\"\n" +
    "                    input-model=\"speciesList\"\n" +
    "                    output-model=\"selected.species\"\n" +
    "                    button-label=\"display\"\n" +
    "                    item-label=\"display\"\n" +
    "                    tick-property=\"selected\"\n" +
    "                    orientation=\"horizontal\"\n" +
    "                    helper-elements=\"none reset filter\"></div>\n" +
    "            </div>\n" +
    "            <div class=\"col-xs-3\">\n" +
    "                <button class=\"btn btn-default\" ng-disabled=\"!selected.species.length\" ng-click=\"addSpeciesToFilter()\"\n" +
    "                        popover-placement=\"right\" popover-popup-delay=\"500\"\n" +
    "                        popover-trigger=\"mouseenter\" popover=\"Add this filter to the map\" popover-append-to-body=\"true\">\n" +
    "                    <i class=\"fa\" ng-class=\"{'fa-refresh fa-spin': findingSpecies, 'fa-plus': !findingSpecies}\"></i>\n" +
    "                </button>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </li>\n" +
    "    <li ng-if=\"filterHasDate()\" style=\"text-align: right;\">\n" +
    "        <a class=\"btn btn-lg btn-primary\" id=\"filter-placebo\" href ng-click=\"$parent.$parent.close()\" ng-disabled=\"!filterHasSufficientCriteria()\">Execute Filter <i class=\"fa fa-search\"></i></a>\n" +
    "    </li>\n" +
    "</ul>\n" +
    "");
}]);

angular.module("js/filter/filterTags.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/filterTags.html",
    "<ul class=\"list-inline filter-tags\">\n" +
    "    <li ng-repeat=\"s in getFilter().getSpeciesArgs()\"><species-filter-tag arg=\"s\"></species-filter-tag></li>\n" +
    "    <li ng-repeat=\"n in getFilter().getNetworkArgs()\"><network-filter-tag arg=\"n\"></network-filter-tag></li>\n" +
    "    <li ng-if=\"(date = getFilter().getDateArg())\"><date-filter-tag arg=\"date\"></date-filter-tag></li>\n" +
    "</ul>");
}]);

angular.module("js/filter/networkFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/networkFilterTag.html",
    "<div class=\"btn-group filter-tag date\">\n" +
    "    <a class=\"btn btn-default\">\n" +
    "        <span popover-placement=\"bottom\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "              popover-trigger=\"mouseenter\" popover=\"Indicates the span of time represented on the map\">{{arg.arg.network_name}} </span>\n" +
    "        <span class=\"badge\"\n" +
    "              popover-placement=\"bottom\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "              popover-trigger=\"mouseenter\" popover=\"{{badgeTooltip}}\">{{arg.counts | speciesBadge:badgeFormat}}</span>\n" +
    "    </a>\n" +
    "    <a class=\"btn btn-default\" ng-click=\"removeFromFilter(arg)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </a>\n" +
    "</div>");
}]);

angular.module("js/filter/speciesFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/speciesFilterTag.html",
    "<div class=\"btn-group filter-tag\" ng-class=\"{open: status.isopen}\">\n" +
    "    <a class=\"btn btn-primary\" style=\"background-color: {{arg.color}};\" ng-disabled=\"!arg.phenophases\" ng-click=\"status.isopen = !status.isopen\">\n" +
    "        {{arg.arg | speciesTitle:titleFormat}} \n" +
    "        <span class=\"badge\"\n" +
    "              popover-placement=\"bottom\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "              popover-trigger=\"mouseenter\" popover=\"{{badgeTooltip}}\">{{arg.counts | speciesBadge:badgeFormat}}</span> \n" +
    "        <span class=\"caret\"></span>\n" +
    "    </a>\n" +
    "    <ul class=\"dropdown-menu phenophase-list\" role=\"menu\">\n" +
    "        <li class=\"inline\">Select <a href ng-click=\"selectAll(true)\">all</a> <a href ng-click=\"selectAll(false)\">none</a></li>\n" +
    "        <li class=\"divider\"></li>\n" +
    "        <li ng-repeat=\"phenophase in arg.phenophases | filter:hasCount\">\n" +
    "            <input type=\"checkbox\" ng-model=\"phenophase.selected\"> <span class=\"badge\">{{phenophase.count}}</span> {{phenophase.phenophase_name}}\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "    <a class=\"btn btn-primary\" style=\"background-color: {{arg.color}};\" ng-click=\"removeFromFilter(arg)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </a>\n" +
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
    "    <bounds-manager></bounds-manager>\n" +
    "</ui-gmap-google-map>\n" +
    "\n" +
    "<share-control></share-control>\n" +
    "<filter-tags></filter-tags>\n" +
    "<choropleth-info></choropleth-info>\n" +
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

angular.module("js/scatter/scatter.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/scatter/scatter.html",
    "<vis-dialog title=\"Scatter Plot\" modal=\"modal\">\n" +
    "<form class=\"form-inline plot-criteria-form\">\n" +
    "    <div class=\"form-group\">\n" +
    "        <label for=\"toPlotInput\">Select up to three species phenophase combinations</label>\n" +
    "        <select name=\"toPlotInput\" class=\"form-control\" ng-model=\"selection.toPlot\" ng-options=\"o.phenophase_name group by (o|speciesTitle) for o in plottable\"></select>\n" +
    "        <div class=\"btn-group\" dropdown is-open=\"selection.color_isopen\">\n" +
    "          <button type=\"button\" class=\"btn btn-default dropdown-toggle\" dropdown-toggle style=\"background-color: {{colorScale(selection.color)}};\">\n" +
    "            &nbsp; <span class=\"caret\"></span>\n" +
    "          </button>\n" +
    "          <ul class=\"dropdown-menu\" role=\"menu\">\n" +
    "            <li ng-repeat=\"i in colors track by $index\" style=\"background-color: {{colorScale($index)}};\"><a href ng-click=\"selection.color=$index;\">&nbsp;</a></li>\n" +
    "          </ul>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <button class=\"btn btn-default\" ng-click=\"addToPlot()\" ng-disabled=\"!canAddToPlot()\"><i class=\"fa fa-plus\"></i></button>\n" +
    "</form>\n" +
    "\n" +
    "<div class=\"panel panel-default main-vis-panel\" >\n" +
    "    <div class=\"panel-body\">\n" +
    "        <center>\n" +
    "        <ul class=\"to-plot list-inline animated-show-hide\" ng-if=\"toPlot.length\">\n" +
    "            <li class=\"criteria\" ng-repeat=\"tp in toPlot\">{{tp|speciesTitle}}/{{tp.phenophase_name}} <i style=\"color: {{colorScale(tp.color)}};\" class=\"fa fa-circle\"></i>\n" +
    "                <a href ng-click=\"removeFromPlot($index)\"><i class=\"fa fa-times-circle-o\"></i></a>\n" +
    "            </li>\n" +
    "            <li>\n" +
    "                <select class=\"form-control vis-axis\" ng-model=\"selection.axis\" ng-options=\"o as o.label for o in axis\"></select>\n" +
    "            </li>\n" +
    "            <li>\n" +
    "                <label for=\"fitLinesInput\">Fit Line{{toPlot.length > 1 ? 's' : ''}}</label>\n" +
    "                <input type=\"checkbox\" id=\"fitLinesInput\" ng-model=\"selection.regressionLines\" />\n" +
    "            </li>\n" +
    "            <li ng-if=\"!data\"><button class=\"btn btn-primary\" ng-click=\"visualize()\">Visualize</button></li>\n" +
    "        </ul>\n" +
    "        <div id=\"vis-container\">\n" +
    "            <div id=\"vis-working\" ng-show=\"working\"><i class=\"fa fa-circle-o-notch fa-spin fa-5x\"></i></div>\n" +
    "            <svg class=\"chart\"></svg>\n" +
    "            <div ng-if=\"filteredDisclaimer\" class=\"filter-disclaimer\">For quality assurance purposes, only onset dates that are preceded by negative observations are included in the visualization.</div>\n" +
    "        </div>\n" +
    "        </center>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<pre ng-if=\"record\">{{record | json}}</pre>\n" +
    "\n" +
    "</vis-dialog>");
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
    "    </li>\n" +
    "    <li class=\"divider\"></li>\n" +
    "    <li>\n" +
    "        <Label for=\"clusterMarkersSetting\">Exclude low quality data from visualizations</label>\n" +
    "        <ul class=\"list-unstyled\">\n" +
    "            <li ng-repeat=\"option in [true,false]\">\n" +
    "                <input type=\"radio\" id=\"filterLqdSummary{{option}}\" ng-model=\"settings.filterLqdSummary.value\"\n" +
    "                       ng-value=\"{{option}}\" /> <label for=\"filterLqdSummary{{option}}\">{{option | yesNo}}</label>\n" +
    "            </li>\n" +
    "        </ul>\n" +
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

angular.module("js/vis/visControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/vis/visControl.html",
    "<p class=\"empty-filter-notes\" ng-if=\"isFilterEmpty()\">\n" +
    "    Before using a visualization you must create and execute a filter.\n" +
    "    Visualizations use the species, and sometimes, date ranges you've identified\n" +
    "    in your filter as the basis for what you want to visualize.\n" +
    "</p>\n" +
    "<ul class=\"list-unstyled\">\n" +
    "    <li ng-repeat=\"vis in visualizations\">\n" +
    "        <a href ng-click=\"open(vis)\" ng-class=\"{disabled: isFilterEmpty()}\">{{vis.title}}</a>\n" +
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

angular.module('npn-viz-tool.vis-scatter',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.settings',
    'ui.bootstrap'
])
.controller('ScatterVisCtrl',['$scope','$modalInstance','$http','$timeout','$filter','$log','FilterService','ChartService','SettingsService',
    function($scope,$modalInstance,$http,$timeout,$filter,$log,FilterService,ChartService,SettingsService){
    $scope.modal = $modalInstance;
    $scope.colorScale = FilterService.getColorScale();
    $scope.colors = $scope.colorScale.domain();
    $scope.axis = [{key: 'latitude', label: 'Latitude'},{key: 'longitude', label: 'Longitude'},{key:'elevation_in_meters',label:'Elevation (m)'}];
    $scope.selection = {
        color: 0,
        axis: $scope.axis[0],
        regressionLines: false
    };
    $scope.$watch('selection.regressionLines',function(nv,ov) {
        if(nv !== ov) {
            draw();
        }
    });
    $scope.$watch('selection.axis',function(nv,ov) {
        if(nv !== ov) {
            draw();
        }
    });
    $scope.plottable = [];
    angular.forEach(FilterService.getFilter().getSpeciesArgs(),function(sarg) {
        angular.forEach(sarg.phenophases,function(pp){
            $scope.plottable.push(angular.extend({},sarg.arg,pp));
        });
    });
    $scope.toPlot = [];
    function getNewToPlot() {
        return angular.extend({},$scope.selection.toPlot,{color: $scope.selection.color});
    }
    $scope.canAddToPlot = function() {
        if(!$scope.selection.toPlot || $scope.toPlot.length === 3) {
            return false;
        }
        if($scope.toPlot.length === 0) {
            return true;
        }
        var next = getNewToPlot(),i;
        for(i = 0; i < $scope.toPlot.length; i++) {
            if(angular.equals($scope.toPlot[i],next)) {
                return false;
            }
        }
        for(i = 0; i < $scope.toPlot.length; i++) {
            if(next.color === $scope.toPlot[i].color) {
                return false;
            }
        }
        return true;
    };

    var data, // the data from the server....
        dateArg = FilterService.getFilter().getDateArg(),
        start_year = dateArg.arg.start_date,
        start_date = new Date(start_year,0),
        end_year = dateArg.arg.end_date,
        sizing = ChartService.getSizeInfo({top: 80,left: 60}),
        chart,
        x = d3.scale.linear().range([0,sizing.width]).domain([0,100]), // bogus domain initially
        xAxis = d3.svg.axis().scale(x).orient('bottom'),
        y = d3.scale.linear().range([sizing.height,0]).domain([1,365]),
        d3_date_fmt = d3.time.format('%x'),
        local_date_fmt = function(d){
                var time = ((d-1)*ChartService.ONE_DAY_MILLIS)+start_date.getTime(),
                    date = new Date(time);
                return d3_date_fmt(date);
            },
        yAxis = d3.svg.axis().scale(y).orient('left');
    // can't initialize the chart until the dialog is rendered so postpone its initialization a short time.
    $timeout(function(){
        chart = d3.select('.chart')
            .attr('width', sizing.width + sizing.margin.left + sizing.margin.right)
            .attr('height', sizing.height + sizing.margin.top + sizing.margin.bottom)
          .append('g')
            .attr('transform', 'translate(' + sizing.margin.left + ',' + sizing.margin.top + ')');

          chart.append('g')
              .attr('class', 'x axis')
              .attr('transform', 'translate(0,' + sizing.height + ')')
              .call(xAxis);

          chart.append('g')
              .attr('class', 'y axis')
              .call(yAxis)
            .append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', '0')
            .attr('dy','-3.5em')
            .attr('x',-1*(sizing.height/2)) // looks odd but to move in the Y we need to change X because of transform
            .style('text-anchor', 'middle')
            .text('Onset DOY');
    },500);

    $scope.addToPlot = function() {
        if($scope.selection.toPlot) {
            $scope.toPlot.push(getNewToPlot());
            $scope.selection.color++;
            $scope.data = data = undefined;
        }
    };
    $scope.removeFromPlot = function(idx) {
        $scope.toPlot.splice(idx,1);
        $scope.data = data = undefined;
    };

    function draw() {
        if(!data) {
            return;
        }
        $scope.working = true;
        // update the x-axis
        var padding = 1;
        function xData(d) { return d[$scope.selection.axis.key]; }
        x.domain([d3.min(data,xData)-padding,d3.max(data,xData)+padding]);
        xAxis.scale(x).tickFormat(d3.format('.2f')); // TODO per-selection tick formatting
        var xA = chart.selectAll('g .x.axis');
        xA.call(xAxis);
        xA.selectAll('.axis-label').remove();
        xA.append('text')
          .attr('class','axis-label')
          .attr('x',(sizing.width/2))
          .attr('dy', '3em')
          .style('text-anchor', 'middle')
          .text($scope.selection.axis.label);

        // update the chart data (TODO transitions??)
        var circles = chart.selectAll('.circle').data(data,function(d) { return d.id; });
        circles.exit().remove();
        circles.enter().append('circle')
          .attr('class', 'circle');

        circles.attr('cx', function(d) { return x(d[$scope.selection.axis.key]); })
          .attr('cy', function(d) { return y(d.first_yes_doy); })
          .attr('r', '5')
          .attr('fill',function(d) { return d.color; })
          .on('click',function(d){
            if (d3.event.defaultPrevented){
                return;
            }
            $scope.$apply(function(){
                $scope.record = d;
            });
          })
          .append('title')
          .text(function(d) { return local_date_fmt(d.day_in_range)+ ' ['+d.latitude+','+d.longitude+']'; });

        var regressionLines = [],float_fmt = d3.format('.2f');
        angular.forEach($scope.toPlot,function(pair){
            var color = $scope.colorScale(pair.color),
                seriesData = data.filter(function(d) { return d.color === color; });
            if(seriesData.length > 0) {
                var datas = seriesData.sort(function(o1,o2){ // sorting isn't necessary but makes it easy to pick min/max x
                        return o1[$scope.selection.axis.key] - o2[$scope.selection.axis.key];
                    }),
                    xSeries = datas.map(function(d) { return d[$scope.selection.axis.key]; }),
                    ySeries = datas.map(function(d) { return d.first_yes_doy; }),
                    leastSquaresCoeff = ChartService.leastSquares(xSeries,ySeries),
                    x1 = xSeries[0],
                    y1 = ChartService.approxY(leastSquaresCoeff,x1),
                    x2 = xSeries[xSeries.length-1],
                    y2 = ChartService.approxY(leastSquaresCoeff,x2);
                regressionLines.push({
                    id: pair.species_id+'.'+pair.phenophase_id,
                    legend: $filter('speciesTitle')(pair)+'/'+pair.phenophase_name+
                            ($scope.selection.regressionLines ? ' (R^2 = '+float_fmt(leastSquaresCoeff[2])+')' : ''),
                    color: color,
                    p1: [x1,y1],
                    p2: [x2,y2]
                });
            }
        });
        var regression = chart.selectAll('.regression')
            .data(regressionLines,function(d) { return d.id; });
        regression.exit().remove();
        regression.enter().append('line')
            .attr('class','regression');

        regression
            .attr('data-legend',function(d) { return d.legend; } )
            .attr('data-legend-color',function(d) { return d.color; })
            .attr('x1', function(d) { return x(d.p1[0]); })
            .attr('y1', function(d) { return y(d.p1[1]); })
            .attr('x2', function(d) { return x(d.p2[0]); })
            .attr('y2', function(d) { return y(d.p2[1]); })
            .attr('stroke', function(d) { return d.color; })
            .attr('stroke-width', $scope.selection.regressionLines ? 2 : 0);
            // FF doesn't like the use of display, so using stroke-width to hide
            // regression lines.
            //.style('display', $scope.selection.regressionLines ? 'inherit' : 'none');


        chart.select('.legend').remove();
        var legend = chart.append('g')
          .attr('class','legend')
          .attr('transform','translate(30,-45)') // relative to the chart, not the svg
          .style('font-size','12px')
          .call(d3.legend);

        if($scope.selection.regressionLines) {
            // IMPORTANT: This may not work perfectly on all browsers because of support for
            // innerHtml on SVG elements (or lack thereof) so using shim
            // https://code.google.com/p/innersvg/
            // d3.legend deals with, not onreasonably, data-legend as a simple string
            // alternatively extend d3.legend or do what it does here manually...
            // replace 'R^2' with 'R<tspan ...>2</tspan>'
            // the baseline-shift doesn't appear to work on firefox however
            chart.selectAll('.legend text').html(function(d) {
                    return d.key.replace('R^2','R<tspan style="baseline-shift: super; font-size: 8px;">2</tspan>');
                });
        }
        $scope.working = false;
    }
    $scope.visualize = function() {
        if(data) {
            return draw();
        }
        $scope.working = true;
        $log.debug('visualize',$scope.selection.axis,$scope.toPlot);
        var dateArg = FilterService.getFilter().getDateArg(),
            params = {
                request_src: 'npn-vis-scatter-plot',
                start_date: dateArg.getStartDate(),
                end_date: dateArg.getEndDate()
            },
            i = 0,
            colorMap = {};
        angular.forEach($scope.toPlot,function(tp) {
            colorMap[tp.species_id+'.'+tp.phenophase_id] = tp.color;
            params['species_id['+i+']'] = tp.species_id;
            params['phenophase_id['+(i++)+']'] = tp.phenophase_id;
        });
        ChartService.getSummarizedData(params,function(response){
            var filterLqd = SettingsService.getSettingValue('filterLqdSummary');
            $scope.data = data = response.filter(function(d,i) {
                var keep = !filterLqd||d.numdays_since_prior_no >= 0;
                if(keep) {
                    d.id = i;
                    // this is the day # that will get plotted 1 being the first day of the start_year
                    // 366 being the first day of start_year+1, etc.
                    d.day_in_range = ((d.first_yes_year-start_year)*365)+d.first_yes_doy;
                    d.color = $scope.colorScale(colorMap[d.species_id+'.'+d.phenophase_id]);
                }
                return keep;
            });
            $log.debug('filtered out '+(response.length-data.length)+'/'+response.length+' records with negative num_days_prior_no.');
            $scope.filteredDisclaimer = response.length != data.length;
            $log.debug('scatterPlot data',data);
            draw();
        });
    };
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
                value: 'scientific-name',
                q: 'sn',
                label: 'Scientific Name'
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
        },
        filterLqdSummary: {
            name: 'filter-lqd-summary',
            q: 'flqdf',
            value: true
        }
    };
    return {
        getSettings: function() { return settings; },
        getSetting: function(key) { return settings[key]; },
        getSettingValue: function(key) { return settings[key].value; },
        // @return the label of the currently selected value for a setting with options (or undefined).
        getSettingValueLabel: function(key) {
            var s = settings[key],
                v = s.value,i;
            for(i = 0; s.options && i < s.options.length; i++) {
                if(s.options[i].value === v) {
                    return s.options[i].label;
                }
            }
        },
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
.directive('settingsControl',['$rootScope','$location','$log','SettingsService',function($rootScope,$location,$log,SettingsService){
    return {
        restrict: 'E',
        templateUrl: 'js/settings/settingsControl.html',
        controller: function($scope) {
            SettingsService.populateFromSharingUrlArgs($location.search()['ss']);
            $scope.settings = SettingsService.getSettings();
            function broadcastSettingChange(key) {
                $log.debug('broadcastSettingChange',$scope.settings[key]);
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
.directive('shareControl',['uiGmapIsReady','FilterService','LayerService','DateFilterArg','SpeciesFilterArg','NetworkFilterArg','GeoFilterArg','BoundsFilterArg','$location','$log','SettingsService',
    function(uiGmapIsReady,FilterService,LayerService,DateFilterArg,SpeciesFilterArg,NetworkFilterArg,GeoFilterArg,BoundsFilterArg,$location,$log,SettingsService){
    return {
        restrict: 'E',
        template: '<a title="Share" href id="share-control" class="btn btn-default btn-xs" ng-disabled="!getFilter().hasSufficientCriteria()" ng-click="share()"><i class="fa fa-share"></i></a><div ng-show="url" id="share-content"><input type="text" class="form-control" ng-model="url" ng-blur="url = null" onClick="this.setSelectionRange(0, this.value.length)"/></div>',
        scope: {},
        controller: function($scope){
            FilterService.pause();
            uiGmapIsReady.promise(1).then(function(instances){
                var map = instances[0],
                    qargs = $location.search(),
                    speciesFilterCount = 0,
                    speciesFilterReadyCount = 0,
                    networksFilterCount = 0,
                    networksFilterReadyCount = 0,
                    layersReady = false,
                    layerListener,speciesListener,networksListener;
                function checkReady() {
                    if(layersReady && speciesFilterReadyCount === speciesFilterCount && networksFilterCount === networksFilterReadyCount) {
                        $log.debug('ready..');
                        // unsubscribe
                        layerListener();
                        speciesListener();
                        networksListener();
                        FilterService.resume();
                    }
                }
                layerListener = $scope.$on('layers-ready',function(event,data){
                    $log.debug('layers ready...');
                    layersReady = true;
                    checkReady();
                });
                speciesListener = $scope.$on('species-filter-ready',function(event,data){
                    $log.debug('species filter ready...',data);
                    speciesFilterReadyCount++;
                    checkReady();
                });
                networksListener = $scope.$on('network-filter-ready',function(event,data){
                    $log.debug('network filter ready...',data);
                    networksFilterReadyCount++;
                    checkReady();
                });
                function addSpeciesToFilter(s){
                    SpeciesFilterArg.fromString(s).then(FilterService.addToFilter);
                }
                function addNetworkToFilter(s) {
                    NetworkFilterArg.fromString(s).then(FilterService.addToFilter);
                }
                $log.debug('qargs',qargs);
                if(qargs['d'] && (qargs['s'] || qargs['n'])) {
                    // we have sufficient criteria to alter the filter...
                    FilterService.addToFilter(DateFilterArg.fromString(qargs['d']));
                    if(qargs['b']) {
                        qargs['b'].split(';').forEach(function(bounds_s){
                            FilterService.addToFilter(BoundsFilterArg.fromString(bounds_s,map.map));
                        });
                    }
                    if(qargs['s']) {
                        var speciesList = qargs['s'].split(';');
                        speciesFilterCount = speciesList.length;
                        speciesList.forEach(addSpeciesToFilter);
                    }
                    if(qargs['n']) {
                        var networksList = qargs['n'].split(';');
                        networksFilterCount = networksList.length;
                        networksList.forEach(addNetworkToFilter);
                    }
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
                filter.getNetworkArgs().forEach(function(n){
                    if(!params['n']) {
                        params['n'] = n.toString();
                    } else {
                        params['n'] += ';'+n.toString();
                    }
                });
                filter.getGeoArgs().forEach(function(g){
                    if(!params['g']) {
                        params['g'] = g.toString();
                    } else {
                        params['g'] += ';'+g.toString();
                    }
                });
                filter.getBoundsArgs().forEach(function(b){
                    if(!params['b']) {
                        params['b'] = b.toString();
                    } else {
                        params['b'] += ';'+b.toString();
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
                $log.debug('absUrl',absUrl);
                $scope.url = absUrl;
            };
        }
    };
}]);
angular.module('npn-viz-tool.stations',[
    'npn-viz-tool.filter',
    'npn-viz-tool.settings',
    'npn-viz-tool.layers'
])
.factory('StationService',['$http','$log','FilterService',function($http,$log,FilterService){
    var markerEvents = {
        'click':function(m){
            //m.info = new google.maps.InfoWindow();
            //m.info.setContent('<div class="station-details"><i class="fa fa-circle-o-notch fa-spin"></i></div>');
            //m.info.open(m.map,m);
            $log.debug('Fetching info for station '+m.model.station_id);
            $http.get('/npn_portal/stations/getStationDetails.json',{params:{ids: m.model.station_id}}).success(function(info){
                function litem(label,value) {
                    return value && value !== '' ?
                     '<li><label>'+label+':</label> '+value+'</li>' : '';
                }
                if(info && info.length === 1) {
                    var i = info[0],
                        info_window,
                        html = '<div class="station-details">';
                    $log.debug(i);
                    //html += '<h5>'+i.site_name+'</h5>';
                    html += '<ul class="list-unstyled">';
                    html += litem('Site Name',i.site_name);
                    html += litem('Group',i.group_name);
                    if(m.model.observationCount) {
                        html += litem('Observations',m.model.observationCount);
                    } else {
                        html += litem('Individuals',i.num_individuals);
                        html += litem('Observations',i.num_records);
                    }

                    html += '</ul>';
                    if(m.model.speciesInfo) {
                        html += '<label>Species Observed</label>';
                        html += '<ul class="list-unstyled">';
                        Object.keys(m.model.speciesInfo.titles).forEach(function(key){
                            var scale = FilterService.getChoroplethScale(key),
                                count = m.model.speciesInfo.counts[key];
                            html += '<li><div class="choropleth-swatch" style="background-color: '+scale(count)+';"></div>'+m.model.speciesInfo.titles[key]+' ('+count+')</li>';
                        });
                        html += '</ul>';
                    }
                    html += '</div>';
                    info_window = new google.maps.InfoWindow({
                        maxWidth: 500,
                        content: html
                    });
                    info_window.open(m.map,m);
                }
            });
        }
    },
    service = {
        getMarkerEvents: function() { return markerEvents; }
    };
    return service;
}])
.directive('npnStations',['$http','$log','LayerService','SettingsService','StationService',function($http,$log,LayerService,SettingsService,StationService){
    return {
        restrict: 'E',
        template: '<ui-gmap-markers models="regions.markers" idKey="\'name\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" isLabel="true"></ui-gmap-markers><ui-gmap-markers models="stations.markers" idKey="\'station_id\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" doCluster="doCluster" events="markerEvents"></ui-gmap-markers>',
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
            $scope.markerEvents = StationService.getMarkerEvents();
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
                            $log.warn('no station count for '+name);
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
    'npn-viz-tool.vis-scatter',
    'npn-viz-tool.vis-calendar',
    'ui.bootstrap'
])
.factory('ChartService',['$window','$http','$log','FilterService',function($window,$http,$log,FilterService){
    // some hard coded values that will be massaged into generated
    // values at runtime.
    var CHART_W = 930,
        CHART_H =500,
        MARGIN = {top: 20, right: 30, bottom: 60, left: 40},
        WIDTH = CHART_W - MARGIN.left - MARGIN.right,
        HEIGHT = CHART_H - MARGIN.top - MARGIN.bottom,
        SIZING = {
            margin: MARGIN,
            width: WIDTH,
            height: HEIGHT
        };
    function filterSuspectSummaryData (d){
        var bad = (d.latitude === 0.0 || d.longitude === 0.0 || d.elevation_in_meters < 0);
        if(bad) {
            $log.warn('suspect station data',d);
        }
        return !bad;
    }
    function addGeoParams(params) {
        // if geo filtering add the explicit station_ids in question.
        if(FilterService.getFilter().getGeoArgs().length) {
            FilterService.getFilteredMarkers().forEach(function(marker,i){
                params['station_id['+i+']'] = marker.station_id;
            });
        }
        return params;
    }
    function txformUrlEncoded(obj) {
        var encoded = [],key;
        for(key in obj) {
            encoded.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
        }
        return encoded.join('&');
    }
    var service = {
        ONE_DAY_MILLIS: (24*60*60*1000),
        getSizeInfo: function(marginOverride){
            // make the chart 92% of the window width
            var margin = angular.extend({},MARGIN,marginOverride),
                cw = Math.round($window.innerWidth*0.90),
                ch = Math.round(cw*0.5376), // ratio based on initial w/h of 930/500
                w = cw  - margin.left - margin.right,
                h = ch  - margin.top - margin.bottom,
                sizing = {width: w, height : h, margin: margin};
            $log.debug('sizing',sizing);
            return sizing;
        },
        leastSquares: function(xSeries,ySeries) {
            var reduceSumFunc = function(prev, cur) { return prev + cur; };

            var xBar = xSeries.reduce(reduceSumFunc) * 1.0 / xSeries.length;
            var yBar = ySeries.reduce(reduceSumFunc) * 1.0 / ySeries.length;

            var ssXX = xSeries.map(function(d) { return Math.pow(d - xBar, 2); })
                .reduce(reduceSumFunc);

            var ssYY = ySeries.map(function(d) { return Math.pow(d - yBar, 2); })
                .reduce(reduceSumFunc);

            var ssXY = xSeries.map(function(d, i) { return (d - xBar) * (ySeries[i] - yBar); })
                .reduce(reduceSumFunc);

            var slope = ssXY / ssXX;
            var intercept = yBar - (xBar * slope);
            var rSquare = Math.pow(ssXY, 2) / (ssXX * ssYY);

            return [slope, intercept, rSquare];
        },
        approxY: function(leastSquaresCoeff,x) {
            // y = a + bx
            var a = leastSquaresCoeff[1],
                b = leastSquaresCoeff[0];
            return a + (b*x);
        },
        getSummarizedData: function(params,success) {
            $http({
                method: 'POST',
                url: '/npn_portal/observations/getSummarizedData.json',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                transformRequest: txformUrlEncoded,
                data: addGeoParams(params)
            }).success(function(response){
                success(response.filter(filterSuspectSummaryData));
            });
        },
        getPositiveDates: function(params,success) {
            $http({
                method: 'POST',
                url: '/npn_portal/observations/getPositiveDates.json',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                transformRequest: txformUrlEncoded,
                data: addGeoParams(params)
            }).success(success);
        }
    };
    return service;
}])
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
.directive('visControl',['$modal','FilterService',function($modal,FilterService){
    var visualizations = [{
        title: 'Scatter Plot',
        controller: 'ScatterVisCtrl',
        template: 'js/scatter/scatter.html',
        description: 'This visualization allows you to plot various geographic or climactic variables on the X axis against Onset Day Of Year on the Y axis.  Up to three Species/Phenophase pairs may be plotted.'
    },{
        title: 'Calendar',
        controller: 'CalendarVisCtrl',
        template: 'js/calendar/calendar.html',
        description: 'This visualization illustrates phenophase activity for various species/phenophase pairs of your choosing.  Horizontal bars are graphed representing a "calendar" of phenological activity at a regional level for up to two years allowing year to year comparison of activity.'
    }];
    return {
        restrict: 'E',
        templateUrl: 'js/vis/visControl.html',
        scope: {

        },
        controller: function($scope) {
            $scope.isFilterEmpty = FilterService.isFilterEmpty;
            $scope.visualizations = visualizations;
            $scope.open = function(vis) {
                if(!FilterService.isFilterEmpty()) {
                    $modal.open({
                        templateUrl: vis.template,
                        controller: vis.controller,
                        windowClass: 'vis-dialog-window',
                        backdrop: 'static',
                        keyboard: false,
                        size: 'lg'
                    });
                }
            };
        }
    };
}]);