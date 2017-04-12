/*
 * USANPN-Visualization-Tool
 * Version: 1.0.0 - 2017-04-11
 */

/**
 * @ngdoc overview
 * @name npn-viz-tool.bounds
 * @description
 *
 * Bounds related functionality.
 */
angular.module('npn-viz-tool.bounds',[
    'npn-viz-tool.filter',
    'uiGmapgoogle-maps'
])
/**
 * @ngdoc service
 * @name npn-viz-tool.bounds:RestrictedBoundsService
 * @module npn-viz-tool.bounds
 * @description
 *
 * Provides objects that can be used to handle Google Map 'center_changed' events to keep the user
 * from moving a map outside a set of defined boundaries.
 *
 * If you add the query argument <code>allowedBounds</code> to the app then the first time the user tries to
 * recenter the map a partially opaque white rectangle will be added to the map showing the bounds the given map
 * will be restricted to.
 */
.service('RestrictedBoundsService',['$log','$location','uiGmapGoogleMapApi',function($log,$location,uiGmapGoogleMapApi){
    var DEBUG = $location.search()['allowedBounds'],
        instances = {},
        service = {
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.bounds:RestrictedBoundsService
             * @name  getRestrictor
             * @description
             *
             * Fetch an object that can be used to keep a user from panning a map outside of a
             * set of defined bounds.
             *
             * E.g.
             * <pre>
             * var restrictor = RestrictedBoundsService.getRestrictor('main_map',latLngBounds);
             * $scope.map.events.center_changed = restrictor.center_changned;
             * </pre>
             *
             * @param {string} key A unique key to identifiy the map instance the restrictor is associated with.
             * @param {google.maps.LatLngBounds} bounds The initial set of bounds to restrict movements to.  Can be changed via setBounds.
             * @return {object} A "BoundsRestrictor" object.
             */
            getRestrictor: function(key,bounds) {
                if(!instances[key]) {
                    instances[key] = new BoundsRestrictor(key);
                }
                instances[key].setBounds(bounds);
                return instances[key];
            }
        };
    var BoundsRestrictor = function(key) {
        this.key = key;
        var self = this;
        self.center_changed = function(map,ename,args) {
            $log.debug('['+self.key+'].center_changed');
            if(!self.bounds) {
                $log.debug('['+self.key+'] no bounds set ignoring.');
                return;
            }
            if(DEBUG && !self.rectangle) {
                self.rectangle = new google.maps.Rectangle({
                    strokeColor: '#FFF',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: '#FFF',
                    fillOpacity: 0.35,
                    map: map,
                    bounds: self.bounds
                });
            }
            if(self.bounds.contains(map.getCenter())) {
                self.lastValidCenter = map.getCenter();
                return;
            }
            $log.debug('['+self.key+'] attempted to pan center out of bounds, panning back to ',self.lastValidCenter);
            map.panTo(self.lastValidCenter);
        };
    };
    BoundsRestrictor.prototype.setBounds = function(newBounds) {
        $log.debug('['+this.key+'].setBounds:',newBounds);
        this.bounds = newBounds;
        this.lastValidCenter = newBounds ? newBounds.getCenter() : undefined;
        if(this.rectangle) {
            this.rectangle.setMap(null);
        }
        this.rectangle = undefined;
    };
    BoundsRestrictor.prototype.getBounds = function() {
        return this.bounds;
    };
    return service;
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.bounds:bounds-manager
 * @module npn-viz-tool.bounds
 * @description
 *
 * Handles the ability for users to draw rectangles on the main map and have it affect the underlying filter.
 */
.directive('boundsManager',['$rootScope','$log','uiGmapGoogleMapApi','FilterService','BoundsFilterArg',
    function($rootScope,$log,uiGmapGoogleMapApi,FilterService,BoundsFilterArg){
    return {
        restrict: 'E',
        template: '<ui-gmap-drawing-manager ng-if="!isFilterEmpty()" options="options" control="control"></ui-gmap-drawing-manager>',
        controller: ['$scope',function($scope) {
            $scope.isFilterEmpty = FilterService.isFilterEmpty;
            function refilter() {
                if(FilterService.getFilter().hasSufficientCriteria()) {
                    $rootScope.$broadcast('filter-rerun-phase2',{});
                }
            }
            uiGmapGoogleMapApi.then(function(maps) {
                var mapsApi = maps,
                    dcOptions = {
                        drawingModes: [mapsApi.drawing.OverlayType.RECTANGLE],
                        position: mapsApi.ControlPosition.TOP_RIGHT,
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
                    mapsApi.event.addListener(data.filter.arg,'rightclick',function(){
                        FilterService.removeFromFilter(data.filter);
                        refilter();
                    });
                });
                $scope.$watch('control.getDrawingManager',function(){
                    if($scope.control.getDrawingManager){
                        var drawingManager = $scope.control.getDrawingManager();
                        mapsApi.event.addListener(drawingManager,'rectanglecomplete',function(rectangle){
                            drawingManager.setDrawingMode(null);
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
/**
 * @ngdoc overview
 * @name npn-viz-tool.cache
 * @description
 *
 * Caching functionality.
 */
angular.module('npn-viz-tool.vis-cache',[
    'angular-md5'
])
/**
 * @ngdoc service
 * @name npn-viz-tool.cache:CacheService
 * @module npn-viz-tool.cache
 * @description
 *
 * Simple service that can be used to store content for a period of time to avoid needing
 * to return to the server for it.
 */
.factory('CacheService',['$log','$timeout','md5',function($log,$timeout,md5){
    var cache = [];
    var service = {
      /**
       * @ngdoc method
       * @methodOf npn-viz-tool.cache:CacheService
       * @name  keyFromObject
       * @description
       *
       * Generates a unique key (md5 hash) based on an object that can be used as a cache key.
       *
       * @param {object} obj A JavaScript object to generate a key from.
       * @return {string} A unique key that can be used to cache/retrieve something from the cache.
       */
      keyFromObject : function(obj) {
        return md5.createHash(JSON.stringify(obj));
      },
      /**
       * @ngdoc method
       * @methodOf npn-viz-tool.cache:CacheService
       * @name  dump
       * @description
       *
       * Dump the contents of the cache the log (for debug purposes).
       */
      dump : function() {
        $log.debug('cache',cache);
      },
      /**
       * @ngdoc method
       * @methodOf npn-viz-tool.cache:CacheService
       * @name  put
       * @description
       *
       * Place an object in the cache.  The default time to live for an object in the cache is 5 minutes.
       *
       * @param {string} key The cache key to store the object under.
       * @param {object} obj The object to cache.  If null will drop the key from the cache if it exists.
       * @param {int} ttl Optional argument that specifies how long in milliseconds the object should remained cached.  A negative value means the object won't expire.
       */
      put : function(key,obj) {
        if ( key == null ) {
          return;
        }
        if ( obj == null ) {
          $log.debug( 'removing cached object \''+key+'\'', cache[key]);
          // probably should slice to shrink cache array but...
          cache[key] = null;
          return;
        }
        var ttl = (arguments.length > 2) ?
          arguments[2] :
          (5*60000); // default ttl is 5 minutes
        var expiry = (ttl < 0) ?
          -1 : // never expires
          (new Date()).getTime()+ttl;
        $log.debug('caching (expiry:'+expiry+') \''+key+'\'',obj);
        cache[key] = {
          data: obj,
          expiry : expiry
        };
        if(ttl > 0) {
            $timeout(function(){
                $log.debug('expiring cached object \''+key+'\'', cache[key]);
                cache[key] = null;
            },ttl);
        }
      },
	  
      /**
       * @ngdoc method
       * @methodOf npn-viz-tool.cache:CacheService
       * @name  get
       * @description
       *
       * Fetch an object from the cache.
       *
       * @param {string} key The cache key of the object to fetch.
       * @returns {object} The object in the cache if still valid or null if not found or expired.
       */
      get : function(key) {
        var obj = cache[key];
        if ( obj == null ) {
          return arguments.length > 1 ? arguments[1] : null;
        }
        if ( obj.expiry < 0 || obj.expiry > (new Date()).getTime() ) {
            $log.debug('cache entry \''+key+'\' is valid returning.');
          return obj.data;
        }
        $log.debug('cache entry \''+key+'\' has expired.');
        // probably should slice to shrink cache array but...
        delete cache[key];
        return arguments.length > 1 ? arguments[1] : null;
      }
    };
    return service;
}]);
angular.module('npn-viz-tool.vis-calendar',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'ui.bootstrap'
])
.controller('CalendarVisCtrl',['$scope','$uibModalInstance','$http','$timeout','$filter','$log','FilterService','ChartService',
    function($scope,$uibModalInstance,$http,$timeout,$filter,$log,FilterService,ChartService){
    var response, // raw response from the server
        data, // processed data from the server
        dateArg = FilterService.getFilter().getDateArg(),
        sizing = ChartService.getSizeInfo({top: 20, right: 35, bottom: 45, left: 35}),
        chart,
        d3_month_fmt = d3.time.format('%B'),
        x = d3.scale.ordinal().rangeBands([0,sizing.width]).domain(d3.range(1,366)),
        xAxis = d3.svg.axis().scale(x).orient('bottom').tickValues(xTickValues()).tickFormat(formatXTickLabels),
        y = d3.scale.ordinal().rangeBands([sizing.height,0]).domain(d3.range(0,6)),
        yAxis = d3.svg.axis().scale(y).orient('right').tickSize(sizing.width).tickFormat(function(d) {
            return d;
        }).tickFormat(formatYTickLabels);

    $scope.validYears = d3.range(1900,((new Date()).getFullYear()+1));
    $scope.modal = $uibModalInstance;

    var colorScale = FilterService.getColorScale();
    $scope.colors = colorScale.domain();
    $scope.colorRange = colorScale.range();

    $scope.selection = {
        color: 0,
        year: (new Date()).getFullYear(),
        netagive: false,
    };

    $scope.toPlotYears = [];
    $scope.toPlot = [];
    FilterService.getFilter().getSpeciesList().then(function(list){
        $log.debug('speciesList',list);
        $scope.speciesList = list;
        if(list.length) {
            $scope.selection.species = list[0];
        }
    });

	function phenophaseListUpdate() {
		$log.debug('Calling phenophase list update');
		$scope.phenophaseList = [];
		var species = $scope.selection.species.species_id,
			year = $scope.selection.year;

		if(species && year) {
			$scope.phenophaseList = [];
			FilterService.getFilter().getPhenophasesForSpecies(species,true,[year]).then(function(list){
				$log.debug('phenophaseList',list);
				if(list.length) {
					list.splice(0,0,{phenophase_id: -1, phenophase_name: 'All phenophases'});

					$scope.selection.phenophase = list.length ? list[0] : undefined;

				}

				$scope.phenophaseList = list;

			});



		}
	}

    $scope.$watch('selection.species',phenophaseListUpdate);
    $scope.$watch('selection.year',phenophaseListUpdate);

    function advanceColor() {
        if($scope.selection.color < $scope.colors.length) {
            $scope.selection.color++;
        } else {
            $scope.selection.color = 0;
        }
    }
    function addToPlot(toPlot) {
        $log.debug('addToPlot',toPlot);
        if(toPlot) {
            if(toPlot.phenophase_id === -1) {
                $log.debug('add all phenophases...');
                removeSpeciesFromPlot(toPlot.species_id);
                $scope.phenophaseList.filter(function(p){
                    return p.phenophase_id !== -1;
                }).forEach(function(pp) {
                    addToPlot(angular.extend($scope.selection.species,pp));
                });
            } else {
                $scope.toPlot.push(getNewToPlot(toPlot));
                advanceColor();
            }
            $scope.data = data = undefined;
        }
    }
    function getNewToPlot(tp) {
        var base = tp||angular.extend({},$scope.selection.species,$scope.selection.phenophase);
        return angular.extend({},base,{color: $scope.selection.color});
    }
    $scope.canAddToPlot = function() {
        if(!$scope.selection.species || !$scope.selection.phenophase) {
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

        return true;
    };
    $scope.addToPlot = function() {
        addToPlot(getNewToPlot());
    };
    $scope.removeFromPlot = function(idx) {
        $scope.toPlot.splice(idx,1);
        $scope.data = data = undefined;
    };
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

    function commonChartUpdates() {
        var chart = d3.select('.chart');

        chart.selectAll('g .y.axis line')
            .style('stroke','#777')
            .style('stroke-dasharray','2,2');

        chart.selectAll('.axis path')
            .style('fill','none')
            .style('stroke','#000')
            .style('shape-rendering','crispEdges');
        chart.selectAll('.axis line')
            .style('fill','none')
            .style('stroke','#000')
            .style('shape-rendering','crispEdges');

        chart.selectAll('text')
            .style('font-family','Arial');
    }

    // can't initialize the chart until the dialog is rendered so postpone its initialization a short time.
    $timeout(function(){
        var svg = d3.select('.chart')
            .attr('width', sizing.width + sizing.margin.left + sizing.margin.right)
            .attr('height', sizing.height + sizing.margin.top + sizing.margin.bottom);
        svg.append('g').append('rect').attr('width','100%').attr('height','100%').attr('fill','#fff');

        chart = svg
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
          chart.selectAll('g .x.axis text')
            .attr('style','font-size: 14px');

          // hide y axis
          chart.selectAll('g .y.axis path')
            .style('display','none');

		  svg.append('g').append('text').attr('dx',5)
			   .attr('dy',sizing.height + 61)
			   .attr('font-size', '11px')
			   .attr('font-style','italic')
			   .attr('text-anchor','right').text('USA National Phenology Network, www.usanpn.org');

          commonChartUpdates();
    },500);


    $scope.yAxisConfig = {
        labelOffset: 4,
        bandPadding: 0.5,
        fontSize: 14
    };
    function moveYTickLabels(g) {
      var dy = -1*((y.rangeBand()/2)+$scope.yAxisConfig.labelOffset);
      g.selectAll('text')
          .attr('x', 0)
          .attr('dy', dy)
          .attr('style', 'text-anchor: start; font-size: '+$scope.yAxisConfig.fontSize+'px;');
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
        $scope.yAxisConfig.fontSize++;// = addFloatFixed($scope.yAxisConfig.fontSize,-0.05,2);
    };
    $scope.decrFontSize = function() {
        $scope.yAxisConfig.fontSize--;// = addFloatFixed($scope.yAxisConfig.fontSize,0.05,2);
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

    var negativeColor = '#aaa';

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

        var doys = chart.selectAll('.doy').data(data.data,function(d){ return d.y+'-'+d.x+'-'+d.color; });
        doys.exit().remove();
        doys.enter().insert('line',':first-child').attr('class','doy');

        var dx = Math.ceil(x.rangeBand()/2),
            dy = y.rangeBand()/2;

        doys.attr('x1', function(d) { return x(d.x)-dx; })
            .attr('y1', function(d,i) { return y(d.y)+dy; })
            .attr('x2', function(d) { return x(d.x)+dx; })
            .attr('y2', function(d,i) { return y(d.y)+dy; })
            .attr('doy-point',function(d) { return '('+d.x+','+d.y+')'; })
            .attr('stroke', function(d) { return d.color === negativeColor ? negativeColor : $scope.colorRange[d.color]; })
            .attr('stroke-width', y.rangeBand())
            .append('title')
            .text(function(d) {
                return d.x; // x is the doy
            });

        commonChartUpdates();

        $scope.working = false;
    }

    function updateData() {
        if(!response) {
            return;
        }
        if(response.error_message) {
            $log.warn('Received error',response);
            $scope.error_message = response.error_message;
            $scope.working = false;
            return;
        }
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
        function addDoys(doys,color) {
            angular.forEach(doys,function(doy){
                toChart.data.push({
                    y: y,
                    x: doy,
                    color: color
                });
            });
        }
        angular.forEach($scope.toPlot,function(tp){
            $log.debug('toPlot',tp);
            var species = speciesMap[tp.species_id],
                phenophase = species.phenophases[tp.phenophase_id];
            angular.forEach($scope.toPlotYears,function(year){
                if(phenophase && phenophase.years && phenophase.years[year]) {
                    // conditionally add negative data
                    if($scope.selection.negative) {
                        $log.debug('year negative',y,year,species.common_name,phenophase,phenophase.years[year].negative);
                        addDoys(phenophase.years[year].negative,negativeColor);
                    }
                    // add positive data
                    $log.debug('year positive',y,year,species.common_name,phenophase,phenophase.years[year].positive);
                    addDoys(phenophase.years[year].positive,tp.color);
                }
                toChart.labels.splice(0,0,$filter('speciesTitle')(tp)+'/'+tp.phenophase_name+' ('+year+')');
                $log.debug('y of '+y+' is for '+toChart.labels[0]);
                y--;
            });
        });
        $scope.data = data = toChart;
        $log.debug('calendar data',data);
        draw();
    }
    $scope.$watch('selection.negative',updateData);

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
        $scope.error_message = undefined;
        ChartService.getObservationDates(params,function(serverResponse){
            response = serverResponse;
            updateData();
        });
    };
}]);

angular.module('npn-viz-tool.cluster',[
])
.factory('ClusterService',[function(){
    var service = {
        getDefaultClusterOptions: function() {
            var styles = [0,1,2,4,8,16,32,64,128,256].map(function(i){
                return {
                    n: (i*1000),
                    url: 'cluster/m'+i+'.png',
                    width: 52,
                    height: 52,
                    textColor: '#fff'
                };
            });
            return {
                styles: styles,
                maxZoom: 12
            };
        }
    };
    return service;
}]);
angular.module('npn-viz-tool.export',[
    'npn-viz-tool.filter'
])
.directive('exportControl',['$log','$http','$window','FilterService',function($log,$http,$window,FilterService){
    return {
        restrict: 'E',
        template: '<a title="Export" href id="export-control" class="btn btn-default btn-xs" ng-disabled="!getFilteredMarkers().length" ng-click="exportData()"><i class="fa fa-download"></i></a>',
        controller: ['$scope',function($scope){
            $scope.getFilteredMarkers = FilterService.getFilteredMarkers;
            $scope.exportData = function() {
                var filter = FilterService.getFilter();
                var params = filter.getDateArg().toExportParam();
                params.downloadType = 'selectable';
                params.searchSource = 'visualization-tool';
                if (params.startYear === params.endYear) {
                    params.endYear += 1;
                    params.endDate = params.endYear + '-01-01';
                }
                if(filter.getSpeciesArgs().length) {
                    params.species = [];
                    filter.getSpeciesArgs().forEach(function(s){
                        params.species.push(s.getId());
                    });
                }
                if(filter.getNetworkArgs().length) {
                    params.partnerGroups = [];
                    filter.getNetworkArgs().forEach(function(n){
                        params.partnerGroups.push(n.getId());
                    });
                }
                if(filter.getGeographicArgs().length) {
                    params.stations = [];
                    FilterService.getFilteredMarkers().forEach(function(marker,i){
                        params.stations.push(marker.station_id);
                    });
                }
                $log.debug('export.params',params);
                var serverUrl = '';
                var popServerUrl = '';
                if(location.hostname.includes('local')) {
                    serverUrl = location.protocol + '//' + location.hostname;
                    popServerUrl = serverUrl;
                }
                else if(location.hostname.includes('dev')) {
                    serverUrl = '//data-dev.usanpn.org';
                    popServerUrl = 'http://data-dev.usanpn.org';
                }
                else {
                    serverUrl = '//data.usanpn.org';
                    popServerUrl = 'http://data.usanpn.org';
                }
                $http({
                    method: 'POST',
                    url: popServerUrl + ':3002/pop/search',
                    data: {'searchJson': params}
                }).then(function(result){
                    if(location.hostname.includes('local')) {
                        $window.open(serverUrl + ':8080?search='+result.data.saved_search_hash);
                    }
                    else {
                        console.log(serverUrl + '/observations?search='+result.data.saved_search_hash);
                        $window.open(serverUrl + '/observations?search='+result.data.saved_search_hash);
                    }
                });
            };
        }]
    };
}]);
angular.module('npn-viz-tool.filter',[
    'npn-viz-tool.settings',
    'npn-viz-tool.stations',
    'npn-viz-tool.cluster',
    'npn-viz-tool.vis-cache',
    'npn-viz-tool.help',
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
    DateFilterArg.prototype.getStartYear = function() {
        return this.arg.start_date;
    };
    DateFilterArg.prototype.getStartDate = function() {
        return this.arg.start_date+'-01-01';
    };
    DateFilterArg.prototype.getEndYear = function() {
        return this.arg.end_date;
    };
    DateFilterArg.prototype.getEndDate = function() {
        return this.arg.end_date+'-12-31';
    };
    DateFilterArg.prototype.toExportParam = function() {
        return {
            startDate: this.arg.start_date + '-01-01',
            endDate: this.arg.end_date + '-01-01',
            startYear: this.arg.start_date,
            startMonth: 'January',
            startDay: 1,
            endYear: this.arg.end_date,
            endMonth: 'January',
            endDay: 1,
            rangeType: 'Calendar'
        };
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
.factory('NetworkFilterArg',['$http','$rootScope','$log','$url','FilterArg','SpeciesFilterArg','SettingsService',function($http,$rootScope,$log,$url,FilterArg,SpeciesFilterArg,SettingsService){
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
        this.ydo = arguments.length > 1 ? arguments[1] : SettingsService.getSettingValue('onlyYesData');
        $log.debug('NetworkFilterArg',this.arg,this.ydo);
        var self = this;
        $rootScope.$broadcast('network-filter-ready',{filter:self});
    };
    NetworkFilterArg.prototype.getId = function() {
        return parseInt(this.arg.network_id);
    };
    NetworkFilterArg.prototype.getName = function() {
        return this.arg.network_name;
    };
    NetworkFilterArg.prototype.toExportParam = function() {
        return this.getId();
    };
    NetworkFilterArg.prototype.resetCounts = function(c) {
        this.counts.station = this.counts.observation = c;
        this.stations = [];
    };
    NetworkFilterArg.prototype.updateCounts = function(station,species,networkOnly) {
        var id = this.getId(),pid,n,
            counts = 0;
        if(station.networks.indexOf(id) !== -1) {
            // station is IN this network
            if(this.stations.indexOf(station.station_id) === -1) {
                // first time we've seen this station.
                this.stations.push(station.station_id);
                this.counts.station++;
            }
            // TODO, how to know which phenophases to add to counts??
            for(pid in species) {
                if(species[pid].$match || networkOnly) { // matched some species/phenophase filter
                    n = SpeciesFilterArg.countObservationsForPhenophase.call(this,species[pid]);
                    if(networkOnly) {
                        station.observationCount += n;
                    }
                    this.counts.observation += n;
                    counts += n;
                }
            }
        }
        return counts;
    };
    NetworkFilterArg.prototype.toString = function() {
        var s = this.arg.network_id;
        if(this.ydo) {
            s += ':1';
        }
        return s;
    };
    NetworkFilterArg.fromString = function(s) {
        var parts = s.split(':'),
            net_id = parts.length > 1 ? parts[0] : s,
            ydo = parts.length === 2 ? parts[1] === '1' : undefined;
        // TODO can I just fetch a SINGLE network??  the network_id parameter of
        // getPartnerNetworks.json doesn't appear to work.
        return $http.get($url('/npn_portal/networks/getPartnerNetworks.json'),{
            params: {
                active_only: true,
                // network_id: s
            }
        }).then(function(response){
            var nets = response.data;
            for(var i = 0; nets && i  < nets.length; i++) {
                if(net_id == nets[i].network_id) {
                    return ydo ? new NetworkFilterArg(nets[i],ydo) : new NetworkFilterArg(nets[i]);
                }
            }
            $log.warn('NO NETWORK FOUND WITH ID '+s);
        });
    };
    return NetworkFilterArg;
}])
.factory('SpeciesFilterArg',['$http','$rootScope','$log','$url','FilterArg','SettingsService',function($http,$rootScope,$log,$url,FilterArg,SettingsService){
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
        this.ydo = arguments.length > 2 ? arguments[2] : SettingsService.getSettingValue('onlyYesData');
        $log.debug('SpeciesFilterArg:',species,this.phenophaseSelections,this.ydo);
        var self = this;
        $http.get($url('/npn_portal/phenophases/getPhenophasesForSpecies.json'),{ // cache ??
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
    // IMPORTANT: this function is "static" (not on the prototype) and yet
    // makes use of this, shared invocations make use of call/apply to set
    // the "this" object which may be a SpeciesFilterArg or a NetworkFilterArg
    SpeciesFilterArg.countObservationsForPhenophase = function(phenophase) {
        var self = this||{},
            n = 0;
        if(phenophase.y) {
            n += phenophase.y;
        }
        if(!self.ydo) {
            if(phenophase.n) {
                n += phenophase.n;
            }
            if(phenophase.q) {
                n += phenophase.q;
            }
        }
        return n;
    };
    SpeciesFilterArg.prototype.getId = function() {
        return parseInt(this.arg.species_id);
    };
    SpeciesFilterArg.prototype.getPhenophaseList = function() {
        return angular.copy(this.phenophases);
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
                if(!self.phenophasesMap[pid]) {
                    $log.error('phenophase_id: ' + pid + ' not found for species: ' + self.arg.species_id);
                    return false;
                }
                var oCount = SpeciesFilterArg.countObservationsForPhenophase.call(self,species[pid]);
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
    SpeciesFilterArg.prototype.toExportParam = function() {
        var r = {
            species_id: this.getId(),
            common_name: this.arg.common_name
        },
        selected = this.phenophases.filter(function(pp){
                return pp.selected;
        });
        if(selected.length !== this.phenophases.length) {
            r.phenophases = selected.map(function(pp){ return parseInt(pp.phenophase_id); });
        }
        return r;
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
        if(this.ydo) {
            s += ':1';
        }
        return s;
    };
    SpeciesFilterArg.fromString = function(s) {
        var parts = s.split(':'),
            sid = parts[0],
            ppids = parts[1],
            ydo = parts.length === 3 ? parts[2] === '1' : undefined;
        return $http.get($url('/npn_portal/species/getSpeciesById.json'),{
            params: {
                species_id: sid
            }
        }).then(function(response){
            // odd that this ws call doesn't return the species_id...
            response.data['species_id'] = sid;
            return ydo ?
                new SpeciesFilterArg(response.data,ppids,ydo) : new SpeciesFilterArg(response.data,ppids);
        });
    };
    return SpeciesFilterArg;
}])
.factory('GeoFilterArg',['FilterArg',function(FilterArg){
    function geoContains(point,geo) {
        var polyType = geo.getType(),
            poly,arr,i;
        if(polyType == 'Polygon') {
            // this seems wrong but some GeoJson data has more than one index in geo.getArray() for Polygon
            // as if it were a 'MultiPolygon'...
            arr = geo.getArray();
            for(i = 0; i < arr.length; i++) {
                poly = new google.maps.Polygon({paths: arr[i].getArray()});
                if (google.maps.geometry.poly.containsLocation(point,poly) || google.maps.geometry.poly.isLocationOnEdge(point,poly)) {
                    return true;
                }
            }
            /*
            poly = new google.maps.Polygon({paths: geo.getArray()[0].getArray()});
            return google.maps.geometry.poly.containsLocation(point,poly) ||
                   google.maps.geometry.poly.isLocationOnEdge(point,poly);*/
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
        fillOpacity: 0.25,
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
            ne = bounds.getNorthEast(),
            digits = 4;
        return sw.lat().toFixed(digits)+','+sw.lng().toFixed(digits)+':'+ne.lat().toFixed(digits)+','+ne.lng().toFixed(digits);
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
.factory('NpnFilter',[ '$q','$log','$http','$url','DateFilterArg','SpeciesFilterArg','NetworkFilterArg','GeoFilterArg','BoundsFilterArg','CacheService',
    function($q,$log,$http,$url,DateFilterArg,SpeciesFilterArg,NetworkFilterArg,GeoFilterArg,BoundsFilterArg,CacheService){
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
        return this.getBoundsArgs().concat(this.getGeoArgs());
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

    /**
     * Fetches a list of species objects that correspond to this filter.  If the filter
     * has species args in it already then the contents of those args constitute the result.
     * If the filter has a list of networks then the list of species are those applicable to those
     * networks.
     * @return {Promise} A promise that will be resolved with the list.
     */
    NpnFilter.prototype.getSpeciesList = function() {
        var list = [],
            speciesArgs = this.getSpeciesArgs(),
            networkArgs = this.getNetworkArgs(),
            def = $q.defer();
        if(speciesArgs.length) {
            speciesArgs.forEach(function(arg) {
                list.push(arg.arg);
            });
            def.resolve(list);
        } else if (networkArgs.length) {
            var params = {},
                idx = 0;
            networkArgs.forEach(function(n){
                params['network_id['+(idx++)+']'] = n.getId();
            });
            var cacheKey = CacheService.keyFromObject(params);
            list = CacheService.get(cacheKey);
            if(list && list.length) {
                def.resolve(list);
            } else {
                $http.get($url('/npn_portal/species/getSpeciesFilter.json'),{params: params})
                     .success(function(species){
                        CacheService.put(cacheKey,species);
                        def.resolve(species);
                     });
                 }
        } else {
            def.resolve(list);
        }
        return def.promise;
    };
    function removeRedundantPhenophases(list) {
        var seen = [];
        return list.filter(function(pp){
            if(seen[pp.phenophase_id]) {
                return false;
            }
            seen[pp.phenophase_id] = pp;
            return true;
        });
    }
    function mergeRedundantPhenophaseLists(lists) {
        return removeRedundantPhenophases(
            lists.reduce(function(arr,l){
                return arr.concat(l);
            },[]));
    }
    function getPhenophasesForDate(sid,date) {
        var def = $q.defer(),
            params = {
                date: date,
                species_id: sid
            },
            cacheKey = CacheService.keyFromObject(params),
            cached = CacheService.get(cacheKey);
		if(cached) {
            def.resolve(cached);
        } else {
            $http.get($url('/npn_portal/phenophases/getPhenophasesForSpecies.json'),{
                params: params
            }).success(function(phases) {
				var list = phases[0].phenophases;
                list = removeRedundantPhenophases(list);
                CacheService.put(cacheKey,list);
                def.resolve(list);

            },def.reject);
        }
        return def.promise;
    }
    function getPhenophasesForYear(sid,year) {
        var def = $q.defer();
        $q.all([getPhenophasesForDate(sid,year+'-12-31'),getPhenophasesForDate(sid,year+'-01-01')]).then(function(results) {
            $log.debug('getPhenophasesForYear.results',results);
            def.resolve(mergeRedundantPhenophaseLists(results));
        });
        return def.promise;
    }
    function getPhenophasesForYears(sid,years) {
        var def = $q.defer(),
            year_promises = years.map(function(year) {
                return getPhenophasesForYear(sid,year);
            });
        $q.all(year_promises).then(function(results) {
            $log.debug('getPhenophasesForYears.results',results);
            def.resolve(mergeRedundantPhenophaseLists(results));
        });
        return def.promise;
    }
    /**
     * Fetches a list of phenophase objects that correspond to this filter.  If the filter has
     * species args in it then the sid must match one of the filter's species otherwise it's assumed
     * that there are network args in the filter and the phenophases are chased.
     *
     * @param  {Number} sid The species id
     * @param {boolean} force If set to true will get the list even if the species isn't part of this filter.
     * @param {Array} years The list of years to get valid phenophases for.
     * @return {Promise}    A promise that will be resolved with the list.
     */
    NpnFilter.prototype.getPhenophasesForSpecies = function(sid,force,years) {
        var speciesArgs = this.getSpeciesArgs(),
            dateArg = this.getDateArg(),
            def = $q.defer(),i;
        if(typeof(sid) === 'string') {
            sid = parseInt(sid);
        }
        if(!force && speciesArgs.length) {
            var found = false;
            for(i = 0; i < speciesArgs.length; i++) {
                if(speciesArgs[i].getId() === sid) {
                    def.resolve(speciesArgs[i].getPhenophaseList());
                    found = true;
                    break;
                }
            }
            if(!found) {
                def.resolve([]);
            }
        } else {
            years = years||d3.range(dateArg.getStartYear(),dateArg.getEndYear()+1);
            getPhenophasesForYears(sid,years).then(function(list) {
                def.resolve(list);
            });
        }
        return def.promise;
    };
    return NpnFilter;
}])
/**
 * TODO - need to nail down the event model and probably even formalize it via a service because it's all
 * pretty loosey goosey at the moment.  Bad enough duplicating strings around...
 */
.factory('FilterService',['$q','$http','$rootScope','$timeout','$log','$filter','$url','uiGmapGoogleMapApi','md5','NpnFilter','SpeciesFilterArg','SettingsService',
    function($q,$http,$rootScope,$timeout,$log,$filter,$url,uiGmapGoogleMapApi,md5,NpnFilter,SpeciesFilterArg,SettingsService){
    // NOTE: this scale is limited to 20 colors
    var colors = [
          '#1f77b4','#ff7f0e','#2ca02c','#d62728','#222299', '#c51b8a',  '#8c564b', '#637939', '#843c39',
          '#5254a3','#636363',
          '#bcbd22', '#7b4173','#e7ba52', '#222299',  '#f03b20', '#1b9e77','#e377c2',  '#ef8a62', '#91cf60', '#9467bd'
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
    /*
    choroplethScales.forEach(function(s){
        s.domain([0,20]);
    });
    colorScale = d3.scale.ordinal().domain(color_domain).range(color_domain.map(function(d){
        return choroplethScales[d](11);
    }));*/
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
        if(geoCount > 0 && geoResults.previousFilterCount === geoCount) {
            if(angular.equals(Object.keys(newMap),Object.keys(geoResults.previousFilterMap))) {
                $log.debug('refilter but no change in geographic filters');
                return geoResults.hits;
            }
            $log.warn('refilter but no change in geo filter count');
        }
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
            updateNetworkCounts = function(station,species,networkOnly) {
                var n;
                if(networkArgs.length) {
                    angular.forEach(networkArgs,function(networkArg){
                        n = networkArg.updateCounts(station,species,networkOnly);
                        if(networkOnly) {
                            observationCount += n;
                        }
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
                        /*
                        for(pid in station.species[sid]) {
                            station.species[sid][pid].$match = true; // potentially LEAKY but attribute shared by Species/NetworkFilterArg
                            n = SpeciesFilterArg.countObservationsForPhenophase(station.species[sid][pid]);
                            station.observationCount += n;
                            observationCount += n;
                        }*/
                        keeps++;
                        updateNetworkCounts(station,station.species[sid],true);
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
                    maxSid = sids.reduce(function(p,c){
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
                if(!spRanges[arg.arg.species_id]) {
                    return; // no markers of this type?
                }
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
            $http.get($url('/npn_portal/observations/getAllObservationsForSpecies.json'),{
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
            filterUpdateCount = filter.getUpdateCount();
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
.directive('npnFilterResults',['$rootScope','$http','$timeout','$filter','$log','FilterService','SettingsService','StationService','ClusterService',
    function($rootScope,$http,$timeout,$filter,$log,FilterService,SettingsService,StationService,ClusterService){
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
            var clusterOptions = ClusterService.getDefaultClusterOptions(),
                badgeFormatter = $filter('speciesBadge');
            $scope.clusterOptions = angular.extend(clusterOptions,{
                calculator: function(markers,styleCount) {
                    var oCount = 0,
                        fmt = SettingsService.getSettingValue('tagBadgeFormat'),r = {index:1};
                    markers.values().forEach(function(marker) {
                        oCount += marker.model.observationCount;
                    });
                    r.text = badgeFormatter({station: markers.length,observation: oCount},SettingsService.getSettingValue('tagBadgeFormat'));
                    for(var i = 0; i <clusterOptions.styles.length;i++) {
                        if(oCount >= clusterOptions.styles[i].n) {
                            r.index = (i+1);
                        }
                    }
                    return r;
                }
            });
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
                for(i = clusterOptions.styles.length-1; i >= 0; i--) {
                    clusterOptions.styles[i].n = n;
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
            function buildColors(val) {
                // TODO BUG here when max of the domain gets too small..
                var range = Math.ceil(val.domain[1]/20),i,n,colors = [];
                for(i = 0;i < 20; i++) {
                    n = (range*i)+1;
                    colors[i] = val.scale(n);
                    if(val.count >= n) {
                       val.color = colors[i]; // this isn't exact but pick the "closest" color
                    }
                }
                colors.forEach(function(c){
                    if(val.colors.indexOf(c) === -1) {
                        val.colors.push(c);
                    }
                });
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
                                    return buildColors(val);
                                });
                            } else if (data.marker.model.observationCount) {
                                var v = {
                                    count: data.marker.model.observationCount,
                                    title: 'All Records',
                                    scale: scales[0],
                                    domain: scales[0].domain(),
                                    colors: []
                                };
                                $scope.data = [buildColors(v)];
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
            $scope.$on('setting-update-onlyYesData',function(event,data) {
                if(data.value !== $scope.arg.ydo) {
                    $scope.arg.ydo = data.value;
                    // this can change the phase2 results
                    $rootScope.$broadcast('filter-rerun-phase2',{});
                }
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
            var saved_pheno_state,saved_ydo;
            $scope.$watch('status.isopen',function() {
                if($scope.status.isopen) {
                    saved_pheno_state = $scope.arg.phenophases.map(function(pp) { return pp.selected; });
                    saved_ydo = $scope.arg.ydo;
                } else if (saved_pheno_state) {
                    var somethingChanged = false;
                    for(var i = 0; i < saved_pheno_state.length; i++) {
                        if(saved_pheno_state[i] != $scope.arg.phenophases[i].selected) {
                            somethingChanged = true;
                            break;
                        }
                    }
                    if(!somethingChanged) {
                        somethingChanged = saved_ydo != $scope.arg.ydo;
                    }
                    if(somethingChanged) {
                        $rootScope.$broadcast('filter-rerun-phase2',{});
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
.directive('networkFilterTag',['$rootScope','FilterService','SettingsService',function($rootScope,FilterService,SettingsService){
    return {
        restrict: 'E',
        require: '^filterTags',
        templateUrl: 'js/filter/networkFilterTag.html',
        scope: {
            arg: '='
        },
        controller: function($scope){
            $scope.status = {
                isopen: false
            };
            $scope.badgeFormat = SettingsService.getSettingValue('tagBadgeFormat');
            $scope.badgeTooltip = SettingsService.getSettingValueLabel('tagBadgeFormat');
            $scope.$on('setting-update-tagBadgeFormat',function(event,data){
                $scope.badgeFormat = data.value;
                $scope.badgeTooltip = SettingsService.getSettingValueLabel('tagBadgeFormat');
            });
            $scope.$on('setting-update-onlyYesData',function(event,data) {
                if(data.value !== $scope.arg.ydo) {
                    $scope.arg.ydo = data.value;
                    // this can change the phase2 results
                    $rootScope.$broadcast('filter-rerun-phase2',{});
                }
            });
            $scope.removeFromFilter = FilterService.removeFromFilter;
            $scope.$on('filter-phase1-start',function(event,data) {
                $scope.arg.resetCounts('?');
            });
            $scope.$on('filter-phase2-start',function(event,data) {
                $scope.arg.resetCounts(0);
            });
            // it would be perhaps cleaner to watch just arg.ydo
            // but the species dd only re-runs when the dd is closed
            var saved_ydo;
            $scope.$watch('status.isopen',function(open) {
                if(open) {
                    saved_ydo = $scope.arg.ydo;
                } else if(typeof(saved_ydo) !== 'undefined') {
                    if(saved_ydo !== $scope.arg.ydo) {
                        $rootScope.$broadcast('filter-rerun-phase2',{});
                    }
                }
            });
        }
    };
}])
.directive('filterControl',['$http','$filter','$timeout','$url','FilterService','DateFilterArg','SpeciesFilterArg','NetworkFilterArg','HelpService',
    function($http,$filter,$timeout,$url,FilterService,DateFilterArg,SpeciesFilterArg,NetworkFilterArg,HelpService){
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
            $scope.speciesInput = {
                animals: [],
                plants: [],
                networks: []
            };
            $scope.findSpeciesParamsEmpty = true;

            $scope.$watch('selected.species.length',function(length){
                if(length) {
                    HelpService.lookAtMe('#add-species-button');
                }
            });
            $scope.$watch('speciesInput.networks.length',function(length){
                if(length) {
                    HelpService.lookAtMe('#add-networks-button');
                }
            });

            $scope.networksMaxedOut = function() {
                return FilterService.getFilter().getNetworkArgs().length >= 10;
            };
            $scope.speciesMaxedOut = function() {
                return FilterService.getFilter().getSpeciesArgs().length >= 20;
            };
            $scope.addNetworksToFilter = function() {
                HelpService.stopLookingAtMe('#add-networks-button');
                angular.forEach($scope.speciesInput.networks,function(network){
                    if(!$scope.networksMaxedOut()) {
                        FilterService.addToFilter(new NetworkFilterArg(network));
                    }
                });
            };
            $scope.addSpeciesToFilter = function() {
                HelpService.stopLookingAtMe('#add-species-button');
                angular.forEach($scope.selected.species,function(species){
                    if(!$scope.speciesMaxedOut()) {
                        FilterService.addToFilter(new SpeciesFilterArg(species));
                    }
                });
            };

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
                        $scope.serverResults = $http.get($url('/npn_portal/species/getSpeciesFilter.json'),{
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
            $http.get($url('/npn_portal/networks/getPartnerNetworks.json?active_only=true')).success(function(partners){
                angular.forEach(partners,function(p) {
                    p.network_name = p.network_name.trim();
                });
                $scope.partners = partners;
            });
            // not selecting all by default to force the user to pick which should result
            // in less expensive type-ahead queries later (e.g. 4s vs 60s).
            $http.get($url('/npn_portal/species/getPlantTypes.json')).success(function(types){
                $scope.plantTypes = types;
            });
            $http.get($url('/npn_portal/species/getAnimalTypes.json')).success(function(types){
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
/**
 * @ngdoc overview
 * @name npn-viz-tool.gridded
 * @description
 *
 * Base module for controlling gridded map layers.
 */
angular.module('npn-viz-tool.gridded',[
    'npn-viz-tool.gridded-services'
])
/**
 * @ngdoc service
 * @name npn-viz-tool.gridded:GriddedControlService
 * @module npn-viz-tool.gridded
 * @description
 *
 * This is simply an empty object that can be shared between the gridded-control, gridded-legend-main
 * directives and the sharing control to expose currently the active layer/legend (if any).
 *
 * The gridded-control and gridded-legend-main directives are not placed hierarchically with respect to
 * one another so this object acts as an intermediary where the legend object can be referenced.
 */
.service('GriddedControlService',['$location',function($location){
    var service = {
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded:GriddedControlService
         * @name  getLegend
         * @description
         *
         * Gets the currently active legend, if any.
         *
         * @return {npn-viz-tool.gridded-services:WmsMapLegend} The legend, if one is active.
         */
        getLegend: function() { return service.legend; },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded:GriddedControlService
         * @name  getLayer
         * @description
         *
         * Gets the currently active layer, if any.
         *
         * @return {npn-viz-tool.gridded-services:WmsMapLayer} The layer, if one is active.
         */
        getLayer: function() { return service.layer; },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded:GriddedControlService
         * @name  addSharingUrlArgs
         * @description
         *
         * Populates any necessary sharing URL parameters for the share control.
         *
         * @param {object} params The params object that will be used to build a shared URL.
         */
        addSharingUrlArgs: function(params) {
            if(service.layer) {
                var args = service.layer.name+'/'+service.layer.extent.current.value,
                    range = service.layer.getStyleRange();
                if(range) {
                    args += '/'+range[0]+'/'+range[1];
                }
                params['gl'] = args;
            }
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.gridded:GriddedControlService
         * @name  getSharingUrlArgs
         * @description
         *
         * Pulls any sharing URL args from the current URL.
         *
         * @returns {Array} An array of strings or undefined.  Index 0 is the layer name and index 1 is the current extent value.
         */
        getSharingUrlArgs: function() {
            var gl = $location.search()['gl'];
            if(gl) {
                return gl.split(/\//);
            }
        }
    };
    return service;
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.gridded:gridded-legend-main
 * @module npn-viz-tool.gridded
 * @description
 *
 * Gridded legend for the main map which communicates with the gridded toolbar to display a legend for
 * any currently selected gridded layer.
 *
 * @scope
 */
.directive('griddedLegendMain',['GriddedControlService',function(GriddedControlService){
    return {
        restrict: 'E',
        template: '<div id="griddedLegendMain" ng-style="{display: shared.legend ? \'inherit\' : \'none\'}"><gridded-legend legend="shared.legend"></gridded-legend></div>',
        scope: {},
        link: function($scope) {
            $scope.shared = GriddedControlService;
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.gridded:gridded-control
 * @module npn-viz-tool.gridded
 * @description
 *
 * Gridded layers toolbar content.
 */
.directive('griddedControl',['$log','$rootScope','uiGmapGoogleMapApi','uiGmapIsReady','WmsService','GriddedControlService','GriddedInfoWindowHandler',function($log,$rootScope,uiGmapGoogleMapApi,uiGmapIsReady,WmsService,GriddedControlService,GriddedInfoWindowHandler){
    return {
        restrict: 'E',
        templateUrl: 'js/gridded/gridded-control.html',
        link: function($scope) {
            var griddedIwHandler;
            $scope.selection = {};
            $scope.actions = {
                reset: function() {
                    delete $scope.selection.layerCategory;
                    delete $scope.selection.layer;
                }
            };
            $scope.$on('filter-reset',$scope.actions.reset);
            var api,
                map,
                initCalled;
            function init() {
                if(initCalled) {
                    return;
                }
                initCalled = true;
                uiGmapGoogleMapApi.then(function(maps){
                    api = maps;
                    uiGmapIsReady.promise(1).then(function(instances){
                        map = instances[0].map;
                        griddedIwHandler = new GriddedInfoWindowHandler(map);
                        map.addListener('click',function(e){
                            griddedIwHandler.open(e.latLng,$scope.selection.activeLayer,$scope.legend);
                        });
                        WmsService.getLayers(map).then(function(layers){
                            $log.debug('layers',layers);
                            $scope.layers = layers;
                            var sharingUrlArgs = GriddedControlService.getSharingUrlArgs(),lname,ext,c,l;
                            if(sharingUrlArgs) {
                                $log.debug('arguments from shared url',sharingUrlArgs);
                                lname = sharingUrlArgs[0];
                                ext = sharingUrlArgs[1];
                                l = layers.categories.reduce(function(found,cat){
                                    if(!found){
                                        found = cat.layers.reduce(function(f,ly){
                                                return f||(ly.name === lname ? ly : undefined);
                                            },undefined);
                                        if(found) {
                                            c = cat;
                                        }
                                    }
                                    return found;
                                },undefined);
                                if(l) {
                                    l.extent.current = l.extent.values.reduce(function(found,extent){
                                                            return found||(extent.value === ext ? extent : undefined);
                                                        },undefined)||l.extent.current;
                                    $scope.selection.layerCategory = c;
                                    $scope.selection.layer = l;
                                    if(sharingUrlArgs.length === 4) {
                                        l.setStyleRange([parseInt(sharingUrlArgs[2]),parseInt(sharingUrlArgs[3])]);
                                    }
                                } else {
                                    $log.warn('unable to find gridded layer named '+lname);
                                }
                            }
                        },function(){
                            $log.error('unable to get map layers?');
                        });
                    });
                });
            }
            if(GriddedControlService.getSharingUrlArgs()) {
                init();
            } else {
                $scope.$on('tool-open',function(event,data){
                    if(data.tool.id === 'gridded') {
                        init();
                    }
                });
            }
            function noInfoWindows() {
                if(griddedIwHandler) {
                    griddedIwHandler.close();
                }
            }
            $scope.$watch('selection.layerCategory',function(category) {
                $log.debug('layer category change ',category);
                if($scope.selection.activeLayer) {
                    $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                    var layer = $scope.selection.activeLayer;
                    $scope.selection.activeLayer.off();
                    delete $scope.selection.activeLayer;
                    delete $scope.legend;
                    delete GriddedControlService.legend;
                    delete GriddedControlService.layer;
                    noInfoWindows();
                    $rootScope.$broadcast('gridded-layer-off',{layer:layer});
                }
            });
            $scope.$watch('selection.layer',function(layer) {
                if(!layer) {
                    return;
                }
                noInfoWindows();
                $log.debug('selection.layer',layer);
                if($scope.selection.activeLayer) {
                    $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                    $scope.selection.activeLayer.off();
                }
                // looks odd that we're not turning the layer on here
                // but updating the activeLayer reference will also result in
                // the selection.activeLayer.extent.current watch firing which
                // toggles the map off/on
                $log.debug('fitting new layer ',layer.name);
                GriddedControlService.layer = $scope.selection.activeLayer = layer.fit().on();
                //boundsRestrictor.setBounds(layer.getBounds());
                delete $scope.legend;
                $scope.selection.activeLayer.getLegend(layer).then(function(legend){
                    GriddedControlService.legend = $scope.legend = legend;
                });
                $rootScope.$broadcast('gridded-layer-on',{layer:$scope.selection.activeLayer});
            });
            $scope.$watch('selection.activeLayer.extent.current',function(v) {
                var layer;
                if(layer = $scope.selection.activeLayer) {
                    $log.debug('layer extent change ',layer.name,v);
                    noInfoWindows();
					layer.off().on();
                }
            });
        }
    };
}]);

/**
 * @ngdoc overview
 * @name npn-viz-tool.gridded-services
 * @description
 *
 * Service support for gridded data map visualization.
 */
angular.module('npn-viz-tool.gridded-services',[
])
.provider('$url',[function(){
    this.$get = ['$log',function($log){
        var BASE_URL = window.location.origin.replace('data', 'www');
        $log.debug('BASE_URL',BASE_URL);
        return function(path) {
            return BASE_URL+path;
        };
    }];
}])
.service('DateExtentUtil',[function(){
    var FMT_REGEX = /^(\d\d\d\d)-0?(\d+)-0?(\d+)/;
    return {
        parse: function(s) {
            var match = FMT_REGEX.exec(s.replace(/T.*$/,'')),
                year = parseInt(match[1]),
                month = parseInt(match[2])-1,
                day = parseInt(match[3]);
            return new Date(year,month,day);
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.gridded-services:gridded-point-info-window
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * The base info window contents for gridded point data.  This directive doesn't
 * open the InfoWindow but is just used to render its contents (not intended for general re-use).
 *
 * @scope
 * @param {number} point The point data returned by the layer.
 * @param {object} layer The currently selected map layer.
 * @param {object} legend The legend for the currently selected layer.
 * @param {google.maps.LatLng} latLng The LatLng where the InfoWindow has been be opened.
 */
.directive('griddedPointInfoWindow',['$log','$timeSeriesVis',function($log,$timeSeriesVis){
    return {
        restrict: 'E',
        template: '<div id="griddedPointInfoWindow" class="ng-cloak">'+
        '<div ng-if="gridded_point_legend" class="gridded-legend-color" style="background-color: {{gridded_point_legend.color}};">&nbsp;</div>'+
        '<div class="gridded-point-data">{{legend.formatPointData(point)}}</div>'+
        '<ul class="list-unstyled" ng-if="timeSeries">'+
        '<li><a href ng-click="timeSeries()">Show Time Series</a></li>'+
        '</ul>'+
        //'<pre>\n{{gridded_point_data}}\n{{gridded_point_legend}}</pre>'+
        '</div>',
        scope: {
            point: '=',
            layer: '=',
            legend: '=',
            latLng: '='
        },
        link: function($scope) {
            var latLng = $scope.latLng,
                point = $scope.point,
                layer = $scope.layer,
                legend = $scope.legend;
            $log.debug('griddedPointInfoWindow:latLng',latLng);
            $log.debug('griddedPointInfoWindow:point',point);
            $log.debug('griddedPointInfoWindow:layer',layer);
            $log.debug('griddedPointInfoWindow:legend',legend);
            $scope.gridded_point_legend = $scope.legend.getPointData(point);
            if(layer.supports_time_series) {
                $scope.timeSeries = function() {
                    $timeSeriesVis(layer,legend,latLng);
                };
            }
        }
    };
}])
/**
 * @ngdoc object
 * @name npn-viz-tool.gridded-services:GriddedInfoWindowHandler
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Injectable class that can be used to produce InfoWindows for a specific map given LatLng, Layer and Legend objects.
 */
.factory('GriddedInfoWindowHandler',['$log','$timeout','$compile','$rootScope',function($log,$timeout,$compile,$rootScope){
    function GriddedInfoWindowHandler(map) {
        this.map = map;
    }
    /**
     * @ngdoc method
     * @methodOf npn-viz-tool.gridded-services:GriddedInfoWindowHandler
     * @name  open
     * @description
     *
     * Open an InfoWindow containing gridded point data if all that's necessary is supplied.
     * This function can be called lazily without checking references, it will do nothing if any
     * of the required input is missing (all parameters).
     *
     * @param {google.maps.LatLng} latLng The LatLng where the InfoWindow should be opened.
     * @param {npn-viz-tool.gridded-services:WmsMapLayer} layer The layer the gridded data should come from.
     * @param {npn-viz-tool.gridded-services:WmsMapLegend} legnend The legend associated with the layer that can be used for format gridded response data.
     */
    GriddedInfoWindowHandler.prototype.open = function(latLng,layer,legend) {
        var map = this.map,infoWindow;
        if(latLng && layer && legend) {
            if(!this.infoWindow) {
                this.infoWindow = new google.maps.InfoWindow({
                    maxWidth: 200,
                    content: 'contents'
                });
            }
            infoWindow = this.infoWindow;
            layer.getGriddedData(latLng)
                .then(function(tuples){
                    $log.debug('tuples',tuples);
                    var compiled,
                        point = tuples && tuples.length ? tuples[0] : undefined,
                        $scope = $rootScope.$new();
                    if(point === -9999 || isNaN(point)) {
                        $log.debug('received -9999 or Nan ignoring');
                        return;
                    }
                    if(typeof($scope.point = point) === 'undefined') {
                        $log.debug('undefined point?');
                        return;
                    }
                    $scope.layer = layer;
                    $scope.legend = legend;
                    $scope.latLng = latLng;
                    compiled = $compile('<div><gridded-point-info-window point="point" layer="layer" legend="legend" lat-lng="latLng"></gridded-point-info-window></div>')($scope);
                    $timeout(function(){
                        infoWindow.setContent(compiled[0]);
                        infoWindow.setPosition(latLng);
                        infoWindow.open(map);
                    });
                },function() {
                    $log.error('unable to get gridded data.');
                });
        }
    };
    /**
     * @ngdoc method
     * @methodOf npn-viz-tool.gridded-services:GriddedInfoWindowHandler
     * @name  close
     * @description
     *
     * Closes any currently open InfoWindow.
     */
    GriddedInfoWindowHandler.prototype.close = function() {
        if(this.infoWindow) {
            this.infoWindow.close();
        }
    };
    return GriddedInfoWindowHandler;
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.gridded-services:gridded-opacity-slider
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Dynamically controls the opacity of map tiles.
 *
 * @scope
 * @param {object} layer The currently selected map layer.
 */
.directive('griddedOpacitySlider',['$log','$timeout','WmsService',function($log,$timeout,WmsService) {
    return {
        restrict: 'E',
        template: '<div ng-if="layer" class="form-group">'+
        '<label for="griddedOpacitySlider" style="margin-bottom: 15px;">Opacity</label>'+
        '<rzslider rz-slider-model="selection.opacity" rz-slider-options="options"></rzslider>'+
        '</div>',
        scope: {
            layer: '='
        },
        link: function($scope) {
            $scope.selection = {
                opacity: 75
            };
            $scope.options = {
                floor: 0,
                ceil: 100,
                step: 1
            };
            function updateOpacity() {
                if($scope.layer) {
                    $scope.layer.googleLayer.setOpacity($scope.selection.opacity/100.0);
                }
            }
            $scope.$watch('layer.extent.current',updateOpacity);
            $scope.$watch('selection.opacity',updateOpacity);
            $scope.$watch('layer',updateOpacity);
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.gridded-services:gridded-range-slider
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Dynamically controls the opacity ranges of the data from the WMS Server.
 *
 * @scope
 * @param {object} layer The currently selected map layer.
 */
.directive('griddedRangeSlider',['$log','$timeout','WmsService',function($log,$timeout,WmsService) {
    return {
        restrict: 'E',
        template: '<div ng-if="legend" class="form-group">'+
        '<label for="griddedRangeSlider" style="margin-bottom: 15px;">Range</label>'+
        '<rzslider rz-slider-model="selection.min" rz-slider-high="selection.max" rz-slider-options="options"></rzslider>'+
        '</div>',
        scope: {
            layer: '='
        },
        link: function($scope) {
            $scope.$watch('layer',function(layer) {
                delete $scope.legend;
                if(layer) {
                    layer.getLegend().then(function(legend){
                        $scope.legend = legend;
                        $log.debug('legend',legend);
                        var data = $scope.data = legend.getData(),
                            existingRange = layer.getStyleRange();
                        $scope.selection = {
                            min: (existingRange ? existingRange[0] : 0),
                            max: (existingRange ? existingRange[1] : (data.length-1))
                        };
                        $scope.options = {
                            //showTickValues: false,
                            floor: 0,
                            ceil: (data.length-1),
                            step: 1,
                            showTicks: true,
                            showSelectionBar: true,
                            translate: function(n) {
                                return data[n].label;
                            },
                            getTickColor: function(n) {
                                return data[n].color;
                            },
                            getPointerColor: function(n) {
                                return data[n].color;
                            }
                        };
                    });
                }
            });
            var timer;
            function updateRange() {
                if(timer) {
                    $timeout.cancel(timer);
                }
                timer = $timeout(function(){
                    var layer = $scope.layer,
                        legend = $scope.legend,
                        data = $scope.data;
                    if(legend && data){
                        if($scope.selection.min === $scope.options.floor &&
                           $scope.selection.max === $scope.options.ceil) {
                            // they have selected the complete range, don't send the style
                            // definition with map tile requests...
                            return layer.setStyleRange(undefined);
                        }
                        layer.setStyleRange([$scope.selection.min,$scope.selection.max]);
                    }
                },500);
            }
            $scope.$watch('selection.min',updateRange);
            $scope.$watch('selection.max',updateRange);
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.gridded-services:map-vis-doy-control
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * control for day of year extents.
 *
 * @scope
 * @param {object} layer The currently selected map layer.
 */
.directive('griddedDoyControl',['$log','thirtyYearAvgDayOfYearFilter',function($log,thirtyYearAvgDayOfYearFilter){
    var BASE_YEAR = thirtyYearAvgDayOfYearFilter(1,true).getFullYear(),
        ONE_DAY = (24*60*60*1000),
        MONTHS = d3.range(0,12).map(function(m) { return new Date(BASE_YEAR,m); });
    function getDaysInMonth(date) {
        var month = date.getMonth(),
            tmp;
        if(month === 11) {
            return 31;
        }
        tmp = new Date(date.getTime());
        tmp.setDate(1);
        tmp.setMonth(tmp.getMonth()+1);
        tmp.setTime(tmp.getTime()-ONE_DAY);
        $log.debug('last day of month '+(month+1)+' is '+tmp);
        return tmp.getDate();
    }
    return {
        restrict: 'E',
        templateUrl: 'js/gridded/doy-control.html',
        scope: {
            layer: '='
        },
        link: function($scope) {
            $scope.months = MONTHS;
            var currentDate;
            $scope.$watch('layer',function(layer) {
                currentDate = thirtyYearAvgDayOfYearFilter($scope.layer.extent.current.value,true);
                $scope.selection = {
                    month: MONTHS[currentDate.getMonth()],
                    date: currentDate.getDate()
                };
            });
            function dateWatch(date) {
                $scope.selection.month.setDate(date);
                // this feels a little hoakey matching on label but...
                var label = thirtyYearAvgDayOfYearFilter($scope.selection.month);
                $log.debug('doy-control:date '+label);
                $scope.layer.extent.current = $scope.layer.extent.values.reduce(function(current,v){
                    return current||(v.label === label ? v : undefined);
                },undefined);
            }
            $scope.$watch('selection.month',function(month) {
                $log.debug('doy-control:month '+(month.getMonth()+1),month);
                $scope.dates = d3.range(1,getDaysInMonth(month)+1);
                if(currentDate) {
                    currentDate = undefined; // ignore layer watch init'ed date
                } else if($scope.selection.date === 1) {
                    dateWatch(1); // month change without date change, need to force the extent to update.
                } else {
                    $scope.selection.date = 1;
                }
            });
            $scope.$watch('selection.date',dateWatch);
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.gridded-services:map-vis-year-control
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Control for year extents.
 *
 * @scope
 * @param {object} layer The currently selected map layer.
 */
.directive('griddedYearControl',['$log',function($log){
    return {
        restrict: 'E',
        templateUrl: 'js/gridded/year-control.html',
        scope: {
            layer: '='
        },
        link: function($scope) {
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.gridded-services:map-vis-date-control
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Control for date extents.
 *
 * @scope
 * @param {object} layer The currently selected map layer.
 */
.directive('griddedDateControl',['$log','dateFilter',function($log,dateFilter){
    return {
        restrict: 'E',
        templateUrl: 'js/gridded/date-control.html',
        scope: {
            layer: '='
        },
        link: function($scope) {
            // TODO - hide the today/clear buttons
            $scope.$watch('layer',function(layer) {
                if(layer) {
                    $scope.selection = layer.extent.current.date;
                    $scope.minDate = layer.extent.values[0].date;
                    $scope.maxDate = layer.extent.values[layer.extent.values.length-1].date;
                    $log.debug('minDate',$scope.minDate);
                    $log.debug('maxDate',$scope.maxDate);
                }
            });
            $scope.open = function() {
                $scope.isOpen = true;
            };
            $scope.$watch('selection',function(date) {
                $log.debug('selection',date);
                var fmt = 'longDate',
                    formattedDate = dateFilter(date,fmt);
                $scope.layer.extent.current = $scope.layer.extent.values.reduce(function(current,value){
                    return current||(formattedDate === dateFilter(value.date,fmt) ? value : undefined);
                },undefined);

            });
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.gridded-services:map-vis-layer-control
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Directive to control categorized selection of WMS layers.  This directive
 * shares the parent scope.
 */
.directive('griddedLayerControl',['$log',function($log){
    return {
        restrict: 'E',
        templateUrl: 'js/gridded/layer-control.html',
        link: function($scope) {
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.gridded-services:map-vis-legend
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Directive to dynamically display an interactive legend for a seleted map layer.
 *
 * @scope
 * @param {object} legend The legend of the currently selected layer.
 */
.directive('griddedLegend',['$log','$window',function($log,$window){
    return {
        restrict: 'E',
        templateUrl: 'js/gridded/legend.html',
        scope: {
            legendId: '@',
            legend: '='
        },
        link: function($scope,$element) {
            var svgElement = $element.find('svg')[0];
            function redraw() {
                var legend = $scope.legend,
                    svg = d3.select(svgElement);

                svg.selectAll('g').remove(); // clean slate
                if(!legend) {
                    return;
                }
                $log.debug('legend.title',legend.getTitle());
                $log.debug('legend.length',legend.length);
                $log.debug('legend.colors',legend.getColors());
                $log.debug('legend.quantities',legend.getQuantities());
                $log.debug('legend.labels',legend.getLabels());
                $log.debug('legend.original_labels',legend.getOriginalLabels());

                var width = parseFloat(svg.style('width').replace('px','')),
                    height = parseFloat(svg.style('height').replace('px','')),
                    data = legend.getData(),
                    cell_width = width/data.length,
                    cell_height = 30,
                    top_pad = 2;
                $log.debug('svg dimensions',width,height);
                $log.debug('legend cell width',cell_width);

                var g = svg.append('g'),
                    cell = g.selectAll('g.cell')
                 .data(data)
                 .enter()
                 .append('g')
                 .attr('class','cell')
                 .attr('transform',function(d,i) { return 'translate('+(i*cell_width)+','+top_pad+')'; })
                 .append('rect')
                 .attr('height',cell_height)
                 .attr('width',cell_width)
                 .style('stroke','black')
                 .style('stroke-width','1px')
                 .style('fill',function(d,i) { return d.color; });


                if(legend.ldef.legend_delimiter_every) {
                    var every = legend.ldef.legend_delimiter_every,
                        first_every = false,
                        running_total = 0,
                        separators = data.map(function(d,i){
                            if((i+1) === data.length) {
                                return true;
                            }
                            running_total += (data[i+1].quantity - data[i].quantity);
                            if(running_total >= every) {
                                running_total = 0;
                                return true;
                            }
                            return false;
                        }),
                        top_bottom = [(cell_width+1),cell_height,(cell_width+1),cell_height].join(','), //{ stroke-dasharray: $w,$h,$w,$h }
                        top_right_bottom = [((cell_width*2)+cell_height),cell_height].join(','), //{ stroke-dasharray: (($w*2)+$h),$h }
                        top_left_bottom = [(cell_width+1),cell_height,(cell_width+cell_height+1),0].join(','); ////{ stroke-dasharray: $w,$h,($w+$h),0 }

                    $log.debug('legend_delimiter_every',every);
                    cell.style('stroke-dasharray',function(d,i){
                        if(i === 0) {
                            return separators[i] ? undefined : top_left_bottom;
                        }
                        return separators[i] ? top_right_bottom : top_bottom;
                    })
                    // top_bottom removes the left/right borders which leaves a little whitespace
                    // which looks odd so in cases where there is no right border increase a cell's width
                    // by 1px to cover that gap
                    .attr('width',function(d,i){
                        var w = parseFloat(d3.select(this).attr('width'));
                        if(i === 0) {
                            return separators[i] ? w : w+1;
                        }
                        return separators[i] ? w : w+1;
                    });
                    g.selectAll('g.cell').append('line')
                         .attr('stroke',function(d,i){ return separators[i] ? 'black' : 'none'; })
                         .attr('stroke-width', 2)
                         .attr('x1',cell_width-1)
                         .attr('x2',cell_width-1)
                         .attr('y1',0)
                         .attr('y2',cell_height);
                }
                cell.append('title')
                 .text(function(d) { return d.label; });

                var tick_length = 5,
                    tick_padding = 3;

                function label_cell(cell,label,anchor) {
                    var tick_start = (top_pad+cell_height+tick_padding);
                    cell.append('line')
                        .attr('x1',(cell_width/2))
                        .attr('y1',tick_start)
                        .attr('x2',(cell_width/2))
                        .attr('y2',tick_start+tick_length)
                        .attr('stroke','black')
                        .attr('stroke-width','1');
                    cell.append('text')
                        .attr('dx',(cell_width/2))
                        .attr('dy','3.8em'/*cell_height+tick_length+(2*tick_padding)*/) // need to know line height of text
                        .style('text-anchor',anchor)
                        .text(label);
                }
                var cells = g.selectAll('g.cell')[0],
                    mid_idx = Math.floor(cells.length/2);
                label_cell(d3.select(cells[0]),data[0].label,'start');
                label_cell(d3.select(cells[mid_idx]),data[mid_idx].label,'middle');
                label_cell(d3.select(cells[cells.length-1]),data[data.length-1].label,'end');

                if(legend.ldef.legend_units) {
                    svg.append('g')
                       .append('text')
                       .attr('dx',(width/2))
                       .attr('dy',75+top_pad)
                       .attr('text-anchor','middle')
                       .text(legend.ldef.legend_units);
                }

				svg.append('g').append('text').attr('dx',5)
                       .attr('dy',100+top_pad)
					   .attr('font-size', '18px')
                       .attr('text-anchor','right').text(legend.ldef.title + ', ' + legend.ldef.extent.current.label);

				svg.append('g').append('text').attr('dx',5)
                       .attr('dy',118+top_pad)
					   .attr('font-size', '11px')
                       .attr('text-anchor','right').text('USA National Phenology Network, www.usanpn.org');

            }
            $scope.$watch('legend',redraw);

            $($window).bind('resize',redraw);
			$scope.$watch('legend.layer.extent.current',redraw);
            $scope.$on('$destroy',function(){
                $log.debug('legend removing resize handler');
                $($window).unbind('resize',redraw);
            });
        }
    };
}])
/**
 * @ngdoc filter
 * @name npn-viz-tool.gridded-services:thirtyYearAvgDayOfYear
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Filter that translates a doy value (number) into date text of 'Month day'
 * this filter uses a base year of 2010 since the 30 yr avg layers are based on
 * 1981-2010 and 2010 is known to have been a 365 day year (unlike, for instance,
 * 2016 which has 366 days).
 */
.filter('thirtyYearAvgDayOfYear',['dateFilter',function(dateFilter){
    var JAN_ONE = new Date(2010/*(new Date()).getFullYear()*/,0),
        ONE_DAY = (24*60*60*1000);
    return function(doy,return_date) {
        if(typeof(doy) === 'string') {
            doy = parseFloat(doy);
        }
        var date = doy instanceof Date ? doy : new Date(JAN_ONE.getTime()+((doy-1)*ONE_DAY));
        return return_date ? date : dateFilter(date,'MMMM d');
    };
}])
/**
 * @ngdoc filter
 * @name npn-viz-tool.gridded-services:legendDoy
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Simplified version of thirtyYearAvgDayOfYear that simply takes a number day of year
 * and returns a formatted date.  The optional second argument defines the date format
 * which defaults to 'MMM d'.  The optional third argument defines whether or not the
 * current year should be used as oposed to one known to have 365 days (2010).
 *
 * This filter equates doy 0 with doy 1 since legend scales are inconsistent in this regard.
 *
 * @example
 * <pre>
 * $filter('legendDoy')(1.0,undefined,true|false|undefined); // Jan 1
 * </pre>
 */
.filter('legendDoy',['dateFilter',function(dateFilter){
    var JAN_ONE_2010 = new Date(2010/*(new Date()).getFullYear()*/,0),
        JAN_ONE_THIS_YEAR = new Date((new Date()).getFullYear(),0),
        ONE_DAY = (24*60*60*1000);
    return function(doy,fmt,current_year) {
        doy = Math.round(doy);
        if(doy === 0) {
            doy = 1;
        }
        fmt = fmt||'MMM d'; // e.g. Jan 1
        return dateFilter(new Date((current_year ? JAN_ONE_THIS_YEAR : JAN_ONE_2010).getTime()+((doy-1)*ONE_DAY)),fmt);
    };
}])
/**
 * @ngdoc filter
 * @name npn-viz-tool.gridded-services:legendGddUnits
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Formats legend numbers for gdd units.
 *
 * @example
 * <pre>
 * $filter('legendGddUnits')(10.0) // 10 GDD
 * </pre>
 */
.filter('legendGddUnits',['numberFilter',function(numberFilter){
    return function(n,includeUnits) {
        return numberFilter(n,0)+(includeUnits ? ' AGDD' : '');
    };
}])
/**
 * @ngdoc filter
 * @name npn-viz-tool.gridded-services:legendDegrees
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Formats legend numbers in degrees, assumes F if no unit supplied.
 *
 * @example
 * <pre>
 * $filter('legendDegrees')(10) // 10&deg;F
 * </pre>
 */
.filter('legendDegrees',['numberFilter',function(numberFilter){
    return function(n,unit) {
        return numberFilter(n,0)+'\u00B0'+(unit||'F');
    };
}])
/**
 * @ngdoc filter
 * @name npn-viz-tool.gridded-services:legendAgddAnomaly
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Formats legend numbers for agdd anomaly layers.
 */
.filter('legendAgddAnomaly',['numberFilter',function(numberFilter){
    return function(n,includeUnits) {
        if(n === 0) {
            return 'No Difference';
        }
        var lt = n < 0;
        return numberFilter(Math.abs(n),0)+(includeUnits ? ' AGDD ' : ' ')+(lt ? '<' : '>') +' Avg';
    };
}])
/**
 * @ngdoc filter
 * @name npn-viz-tool.gridded-services:agddDefaultToday
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Selects a default extent value for a doy layer of "today" (if found among the possibilities).
 */
.filter('agddDefaultToday',['dateFilter',function(dateFilter){
    var todayLabel = dateFilter(new Date(),'MMMM d');
    return function(values) {
        return values.reduce(function(dflt,v){
            return dflt||(v.label == todayLabel ? v : undefined);
        },undefined);
    };
}])
/**
 * @ngdoc filter
 * @name npn-viz-tool.gridded-services:legendSixAnomaly
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Formats legend numbers for spring index anomaly layers
 */
.filter('legendSixAnomaly',[function(){
    return function(n) {
        if(n === 0) {
            return 'No Difference';
        }
        var lt = n < 0,
            abs = Math.abs(n);
        return abs+' Days '+(lt ? 'Early' : 'Late');
    };
}])
/**
 * @ngdoc filter
 * @name npn-viz-tool.gridded-services:extentDates
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Filters an array of extent dates relative to days.
 * @example
 * <pre>
 * //$filter('extentDates')(dates,<after>,<before>);
 * $filter('extentDates')(dates,undefined,'today'); // before today
 * $filter('extentDates')(dates,'today',undefined); // after today
 * $filter('extentDates')(dates,undefined,'05-01'); // before may 1st of this year
 * $filter('extentDates')(dates,undefined,'2020-05-01T00:00:00.000Z'); // before may 1st of 2020
 * </pre>
 */
.filter('extentDates',['$log','dateFilter','DateExtentUtil',function($log,dateFilter,DateExtentUtil){
    var ONE_DAY = (24*60*60*1000);
    function toTime(s) {
        var d = new Date();
        if(s === 'yesterday' || s === 'today' || s === 'tomorrow') {
            if(s === 'yesterday') {
                d.setTime(d.getTime()-ONE_DAY);
            } else if (s === 'tomorrow') {
                d.setTime(d.getTime()+ONE_DAY);
            }
            s = dateFilter(d,'yyyy-MM-dd 00:00:00');
        } else if(s.indexOf('T') === -1) {
            s = d.getFullYear()+'-'+s+' 00:00:00';
        }
        return DateExtentUtil.parse(s).getTime();
    }
    return function(arr,after,before) {
        var a = after ? toTime(after) : undefined,
            b = before ? toTime(before) : undefined;
        if(a || b) {
            arr = arr.filter(function(d) {
                var t = DateExtentUtil.parse(d).getTime();
                return (!a || (a && t > a)) && (!b || (b && t < b));
            });
        }
        return arr;
    };
}])
/**
 * @ngdoc service
 * @name npn-viz-tool.gridded-services:WmsService
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Interacts with the NPN geoserver WMS instance to supply map layer data.
 *
 * This service is driven by the <code>map-vis-layers.json</code> JSON document which
 * defines categorized organization for layers known to be supported by the geoserver instance.
 * In addition it specifies what UI code may be involved for formatting legend/gridded data points
 * as strings and valid extent values (despite what the geoserver capabilities may report).
 * The list of layers exposed by the map visualization will almost certainly be a re-organized subset
 * of those exposed by the geoserver.
 *
 * The JSON document exposes a single object with the properties:
 * <ul>
 *     <li><code>geo_server</code> - Contains configuration about the location of the geoserver to interact with.</li>
 *     <li><code>categories</code> - An array of category objects used to organize and configure the behavior of geo server map layers.</li>
 * </ul>
 *
 * The <code>categories</code> property is an array of objects.
 * Each "category" has, at a minimum, a <code>name</code> and <code>layers</code> property.
 * The <code>layers</code> property is an array of "layer" objects which, at a minimum, contain a <code>title</code>
 * and <code>name</code> properties.  The layer <code>name</code> contains the machine name of the associated WMS layer.
 *
 * Each category or layer can also have the following (optional) properties:
 * <ul>
 *   <li><code>legend_label_filter</code> - specifies an angular filter and optional arguments used to translate point data into strings for legends and map info windows.</li>
 *   <li><code>gridded_label_filter</code> - specifies an angular filter and optional arguments used to translate point data into strings for point data map info windows (if not specified then <code>legend_label_filter</code> will be used).</li>
 *   <li><code>extent_values_filter</code> - specifies an angualr filter and optional arguments used to filter extent values for layers.</li>
 *   <li><code>extent_default_filter</code> - specifies anangular filter and optional arguments used to select a default value.  (if not specified the default provided by the server will be used).</li>
 *   <li><code>legend_units</code> - specifies a string that should be placed on the legend below the cell labels (units separated from legend labels).</li>
 *   <li><code>supports_data</code> - specifies a boolean indicating if a layer supports plotting of data on it or not (default true).</li>
 *   <li><code>supports_time_series</code> - specifies a boolean indicating if a layer supports plotting of time series data (default false).</li>
 *   <li>code>current_year_only</code> - if <code>supports_data</code> is true (or unspecified) the indicates that a given layer should only support plotting of data for the year of the currently selected extent on it (default false).</li>
 *   <li><code>description</code> - contains a description of a given layer.  this value can also be specified at the top level so that it applies to all layers in all categories (as the default).</li>
 * </ul>
 *
 * If any of the above properties are defined at the category level then all of the category's layers will inherit the values.
 * Individual layers can define properties of the same name to over-ride the definition found at the category level.
 *
 * The <code>*_filter</code> properties define an object that names an angular <code>$filter</code>
 * instance and optional arguments to that filter.
 * E.g.
 * <pre>
{
    "geo_server": {
        "url": "//geoserver.usanpn.org/geoserver"
    },
    "description" : "this is the default layer description.",
    "categories": [
    ...
    ,{
        "name": "Current Year AGDD",
        "supports_data": false,
        "legend_label_filter": {
            "name": "legendDegrees",
            "args": ["F"]
        },
        "extent_values_filter": {
            "name": "extentDates",
            "args": [null,"today"]
        },
        "layers":[{
                "title": "32\u00B0F",
                "name": "gdd:agdd"
            },{
                "title": "50\u00B0F",
                "name": "gdd:agdd_50f"
            }]
    },
    ...
    ]
}
 * </pre>
 *
 * The "Current Year AGDD" category contains two layers.  For both layers the same <code>legend_label_filter</code>
 * will be applied to format numbers to strings for use in displaying the legend and gridded data retrived from the WCS.
 * Similarly both layers will use the same <code>extent_values_filter</code> whilch will filter valid extent values as reported
 * by the WMS to only those <em>before</em> "today".
 */
.service('WmsService',['$log','$q','$http','$sce','$httpParamSerializer','$filter','DateExtentUtil','WcsService',function($log,$q,$http,$sce,$httpParamSerializer,$filter,DateExtentUtil,WcsService){
    function setGeoServerUrl(url) {
        GEOSERVER_URL = url;
        WMS_BASE_URL = GEOSERVER_URL+'/wms';
        WMS_CAPABILITIES_URL = WMS_BASE_URL+'?service=wms&version='+WMS_VERSION+'&request=GetCapabilities';
    }
    var LAYER_CONFIG = $http.get('map-vis-layers.json'),
        GEOSERVER_URL,
        WMS_BASE_URL,
        WMS_CAPABILITIES_URL,
        // not safe to change since the capabilities document format changes based on version
        // so a version change -may- require code changes wrt interpreting the document
        WMS_VERSION = '1.1.1',
        wms_layer_config,
        wms_layer_defs,
        legends = {},
        service = {
            baseUrl: WMS_BASE_URL,
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsService
             * @name  getLayers
             * @description
             *
             * Get the layers supported by the WMS service (work in progress, list will be a categorized subset eventually).
             *
             * @param {google.maps.Map} map The base map the fetched layers will be added to.
             * @return {promise} A promise that will be resolved with the layers, or rejected.  The layers will be instances of {@link npn-viz-tool.gridded-services:WmsMapLayer}
             *                   and merged into the in categories as defined by <code>map-vis-layers.json</code>.
             */
            getLayers: function(map) {
                function mergeLayersIntoConfig() {
                    var result = angular.copy(wms_layer_config),
                        base_description = result.description;
                    result.categories.forEach(function(category){
                        // layers can inherit config like filters (if all in common) from
                        // the base category
                        var base_config = angular.copy(category);
                        delete base_config.name;
                        delete base_config.layers;
                        base_config.description = base_config.description||base_description;
                        category.layers = category.layers.map(function(l){
                            return new WmsMapLayer(map,angular.extend(angular.copy(base_config),wms_layer_defs[l.name],l));
                        });
                    });
                    return result;
                }
                var def = $q.defer();
                if(wms_layer_config && wms_layer_defs) {
                    def.resolve(mergeLayersIntoConfig());
                } else {
                    LAYER_CONFIG.then(function(response){
                        wms_layer_config = response.data;
                        setGeoServerUrl(wms_layer_config.geo_server.url);
                        $log.debug('layer_config',response.data);
                        $http.get(WMS_CAPABILITIES_URL).then(function(response){
                            var wms_capabilities = $($.parseXML(response.data));
                            wms_layer_defs = getLayers(wms_capabilities.find('Layer'));
                            $log.debug('wms_layer_defs',wms_layer_defs);
                            def.resolve(mergeLayersIntoConfig());
                        },def.reject);
                    },def.reject);

                }
                return def.promise;
            }
        };

    /**
     * @ngdoc object
     * @name npn-viz-tool.gridded-services:WmsMapLegend
     * @module  npn-viz-tool.gridded-services
     * @description
     *
     * A legend object associated with a specific map layer.
     */
    function WmsMapLegend(color_map,ldef,legend_data) {
        function get_filter(filter_def) {
            var filter = $filter(filter_def.name);
            return function(l,q) {
                var args = [q];
                if(filter_def.args) {
                    args = args.concat(filter_def.args);
                }
                return filter.apply(undefined, args);
            };
        }
        var lformat = ldef.legend_label_filter ? get_filter(ldef.legend_label_filter) : angular.identity,
            gformat = ldef.gridded_label_filter ? get_filter(ldef.gridded_label_filter) : undefined,
            entries,data;
        entries = color_map.find('ColorMapEntry');
        if(entries.length === 0) {
            entries = color_map.find('sld\\:ColorMapEntry');
        }
        data = entries.toArray().reduce(function(arr,entry,i){
            var e = $(entry),
                q = parseFloat(e.attr('quantity')),
                l = e.attr('label');
            arr.push({
                color: e.attr('color'),
                quantity: q,
                original_label: l,
                label: i === 0 ? l : lformat(l,q)
            });
            return arr;
        },[]);
        this.styleDefinition = legend_data;
        this.ldef = ldef;
        this.lformat = lformat;
        this.gformat = gformat;
        this.title_data = data[0];
        this.data = data.slice(1);
        this.length = this.data.length;
    }

    /**
     * @ngdoc method
     * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
     * @name  setLayer
     * @description Set the current layer associated with this legend.
     * @param {object} layer The new layer to associate with this legend.
     * @returns {object} This legend object.
     */
     WmsMapLegend.prototype.setLayer = function(layer) {
     this.layer = layer;
             return this;
     };

    /**
     * @ngdoc method
     * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
     * @name  getData
     * @description Get the raw legend cell data.
     * @returns {Array} The cell data.
     */
    WmsMapLegend.prototype.getData = function() {
        return this.data;
    };
    /**
     * @ngdoc method
     * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
     * @name  getStyleDefinition
     * @description Get the raw style definition DOM.
     * @returns {object}
     */
    WmsMapLegend.prototype.getStyleDefinition = function() {
        return this.styleDefinition;
    };
    /**
     * @ngdoc method
     * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
     * @name  getTitle
     * @description Get the legend title (from the original zero-index cell)
     * @returns {string} The legend title.
     */
    WmsMapLegend.prototype.getTitle = function() {
        return this.title_data.label;
    };

    /**
     * @ngdoc method
     * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
     * @name  getColors
     * @description Get the colors for the cells.
     * @returns {Array} Array of string hex colors.
     */
    WmsMapLegend.prototype.getColors = function() {
        return this.data.map(function(data){ return data.color; });
    };
    /**
     * @ngdoc method
     * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
     * @name  getQuantities
     * @description Get numberic quantities for the cells.
     * @returns {Array} Array of numbers.
     */
    WmsMapLegend.prototype.getQuantities = function() {
        return this.data.map(function(data){ return data.quantity; });
    };
    /**
     * @ngdoc method
     * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
     * @name  getLabels
     * @description Get cell labels (translated).
     * @returns {Array} Array of strings.
     */
    WmsMapLegend.prototype.getLabels = function() {
        return this.data.map(function(data){ return data.label; });
    };
    /**
     * @ngdoc method
     * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
     * @name  getOriginalLabels
     * @description Get cell labels (originals).
     * @returns {Array} Array of strings.
     */
    WmsMapLegend.prototype.getOriginalLabels = function() {
        return this.data.map(function(data){ return data.original_label; });
    };
    /**
     * @ngdoc method
     * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
     * @name  formatPointData
     * @description Translate point data for the associated layer into text.
     * @param {number} q The point data to format.
     * @returns {string} point data formatted.
     */
    WmsMapLegend.prototype.formatPointData = function(q) {
        return (this.gformat||this.lformat)(q,q);
    };
    /**
     * @ngdoc method
     * @methodOf npn-viz-tool.gridded-services:WmsMapLegend
     * @name  getPointData
     * @description Get the legend cell data for a given point.
     * @param {number} q The point data to get the associated legend cell for.
     * @returns {object} The cell data for the point or undefined if none.
     */
    WmsMapLegend.prototype.getPointData = function(q) {
        var i,d,n;
        for(i = 0; i < this.data.length; i++) {
            d = this.data[i];
            n = (i+1) < this.data.length ? this.data[i+1] : undefined;
            if(q == d.quantity) {
                return d;
            }
            if(n && q >= d.quantity && q < n.quantity) {
                return d;
            }
        }
    };

    /**
     * @ngdoc object
     * @name npn-viz-tool.gridded-services:WmsMapLayer
     * @module  npn-viz-tool.gridded-services
     * @description
     *
     * A map layer object associated with a specific google map.
     */
    function WmsMapLayer(map,layer_def) {
        if(layer_def.extent_values_filter) {
            $log.debug('layer '+layer_def.name+' has an extent_values_filter, processing',layer_def.extent_values_filter);
            var valuesFilter = $filter(layer_def.extent_values_filter.name),
                extentValues = layer_def.extent.values.map(function(e){ return e.value; }),
                filterArgs = [extentValues].concat(layer_def.extent_values_filter.args||[]),
                filteredValues;
            filteredValues = valuesFilter.apply(undefined,filterArgs);
            $log.debug('filteredValues',(filteredValues.length > 1 ? (filteredValues[0]+'...'+filteredValues[filteredValues.length-1]) : filteredValues));
            layer_def.extent.values = layer_def.extent.values.filter(function(v) {
                return filteredValues.indexOf(v.value) !== -1;
            });
            if(layer_def.extent.current && filteredValues.indexOf(layer_def.extent.current.value) === -1) {
                $log.debug('current extent value has become invalid, replacing with last option');
                layer_def.extent.current = layer_def.extent.values.length ? layer_def.extent.values[layer_def.extent.values.length-1] : undefined;
            }
        }
        if(layer_def.extent_default_filter) {
            $log.debug('layer '+layer_def.name+' has an extent_default_filter, processing', layer_def.extent_default_filter);
            var defaultFilter = $filter(layer_def.extent_default_filter.name),
                defaultFilterArgs = [layer_def.extent.values].concat(layer_def.extent_default_filter.values||[]);
            layer_def.extent.current = defaultFilter.apply(undefined,defaultFilterArgs)||layer_def.extent.current;
            $log.debug('resulting default value',layer_def.extent.current);
        }
        if(layer_def.description) {
            layer_def.$description = $sce.trustAsHtml(layer_def.description);
        }
        var boxSize = 256;
        var wmsArgs = {
            service: 'WMS',
            request: 'GetMap',
            version: WMS_VERSION,
            layers: layer_def.name,
            styles: '',
            format: 'image/png',
            transparent: true,
            height: boxSize,
            width: boxSize,
            srs: 'EPSG:3857' // 'EPSG:4326'
        },
        sldBody,
        googleLayer = new google.maps.ImageMapType({
            getTileUrl: function (coord, zoom) {
                var proj = map.getProjection(),
                    zfactor = Math.pow(2, zoom),
                    top = proj.fromPointToLatLng(new google.maps.Point(coord.x * boxSize / zfactor, coord.y * boxSize / zfactor)),
                    bot = proj.fromPointToLatLng(new google.maps.Point((coord.x + 1) * boxSize / zfactor, (coord.y + 1) * boxSize / zfactor)),
                    ctop = srsConversion(top),
                    cbot = srsConversion(bot),
                    base = {};
                if(l.extent && l.extent.current) {
                    l.extent.current.addToWmsParams(base);
                }
                var args = {bbox: [ctop.lng,cbot.lat,cbot.lng,ctop.lat].join(',')};
                if(sldBody) {
                    args.sld_body = sldBody;
                }
                return WMS_BASE_URL+'?'+$httpParamSerializer(angular.extend(base,wmsArgs,args));
            },
            tileSize: new google.maps.Size(boxSize, boxSize),
            isPng: true,
            name: (layer_def.title||layer_def.name)
        }),
        l = angular.extend({},layer_def,{
            /**
             * @ngdoc property
             * @propertyOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  googleLayer
             * @description The underlying google layer (google.maps.ImageMapType)
             */
            googleLayer: googleLayer,
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  getMap
             * @description Get the google map instance this layer is associated with.
             * @returns {google.maps.Map} The map instance.
             */
            getMap: function() {
                return map;
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  getStyleRange
             * @description Get the style range, if any was set.
             * @returns {Array|undefined} The range that was set.
             */
            getStyleRange: function() {
                return l.styleRange;
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  setStyleRange
             * @description Set the style range.
             */
            setStyleRange: function(range) {
                function xmlToString(xmlData) {
                    var xmlString;
                    if (window.ActiveXObject){
                        xmlString = xmlData.xml; // MSIE
                    }
                    else{
                        xmlString = (new XMLSerializer()).serializeToString(xmlData);
                    }
                    return xmlString;
                }
                var self = this;
                if(self.styleRange = range) {
                    self.getLegend().then(function(legend){
                        var styleDef = legend.getStyleDefinition(),
                            data = legend.getData(),
                            minQ = data[range[0]].quantity,
                            maxQ = data[range[1]].quantity,
                            $styleDef = $(styleDef),
                            colors = $styleDef.find('ColorMapEntry');
                        if(colors.length === 0) {
                            colors = $styleDef.find('sld\\:ColorMapEntry'); // FF
                        }
                        colors.each(function() {
                            var cme = $(this),
                                q = parseInt(cme.attr('quantity'));
                            cme.attr('opacity',(q >= minQ && q <= maxQ) ? '1.0' : '0.0');
                        });
                        var style = xmlToString(styleDef[0]);
                        self.setStyle(style);
                    });
                } else {
                    self.setStyle(undefined);
                }
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  setStyle
             * @description Set the style and its associated range (if any).
             * @param {string} The style (XML as a string).
             */
            setStyle: function(style) {
                if(style !== sldBody) { // avoid off/on if nothing is changing
                    sldBody = style;
                    this.off().on();
                }
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  getBounds
             * @description Get the bounds for this layer.
             * @returns {google.maps.LatLngBounds} The layer's bounds.
             */
            getBounds: function() {
                if(layer_def.bbox) {
                    return layer_def.bbox.getBounds();
                }
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  supportsData
             * @description Indicates whether a given layer supports data to be plotted on it or not.
             * @returns {boolean} false if the layer doesn't support data plotted on it.
             */
            supportsData: function() {
                return typeof(layer_def.supports_data) === 'boolean' ? layer_def.supports_data : true; /* by default a layer supports data */
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  currentYearOnly
             * @description Indicates whether a given layer should constrain what gets plotted on it to the currently selected year.
             * @returns {boolean} true if plotted data should be restrained.
             */
            currentYearOnly: function() {
                return typeof(layer_def.current_year_only) === 'boolean' ? layer_def.current_year_only : false;
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  getTitle
             * @description Get the layer title, if any.
             * @returns {string} The title.
             */
            getTitle: function() {
                return l.title ? l.title.replace(/^(.*?)\s+-\s+(.*)$/,'$2') : undefined;
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  getAbstract
             * @description Get the layer description (abstract from the server), if any.
             * @returns {string} The description.
             */
            getAbstract: function() {
                return l.abstract ? l.abstract.replace(/\s*developer notes.*$/i,'') : undefined;
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  fit
             * @description Fit the map to this layers defined bounds.
             * @returns {npn-viz-tool.gridded-services:WmsMapLayer} this map layer instance.
             */
            fit: function() {
                var bounds = l.getBounds();
                if(bounds) {
                    map.fitBounds(bounds);
                }
                return l;
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  on
             * @description Put this layer on the map.
             * @returns {npn-viz-tool.gridded-services:WmsMapLayer} this map layer instance.
             */
            on: function() {
                map.overlayMapTypes.push(googleLayer);
                return l;
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  off
             * @description Take this layer off the map.
             * @returns {npn-viz-tool.gridded-services:WmsMapLayer} this map layer instance.
             */
            off: function() {
                if(map.overlayMapTypes.length) {
                    map.overlayMapTypes.pop();
                }
                return l;
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  getLegend
             * @description Get the legend associated with this layer.
             * @returns {promise} A promise that will be resolve with the legend when it arrives ({@link npn-viz-tool.gridded-services:WmsMapLegend}) .
             */
            getLegend: function() {
				var self = this,
                 def = $q.defer();

                if(legends.hasOwnProperty(layer_def.name)) {
                    def.resolve(legends[layer_def.name]);
					def.resolve(legends[layer_def.name].setLayer(self));
                } else {
                    //http://geoserver.usanpn.org/geoserver/wms?request=GetStyles&layers=gdd%3A30yr_avg_agdd&service=wms&version=1.1.1
                    $http.get(WMS_BASE_URL,{
                        params: {
                            service: 'wms',
                            request: 'GetStyles',
                            version: WMS_VERSION,
                            layers: layer_def.name,
                        }
                    }).then(function(response) {
                        $log.debug('legend response',response);
                        var legend_data = $($.parseXML(response.data)),
                            color_map = legend_data.find('ColorMap');
                        if(color_map.length === 0) {
                            // FF
                            color_map = legend_data.find('sld\\:ColorMap');
                        }
                        // this code is selecting the first if there are multiples....
                        // as is the case for si-x:leaf_anomaly
                        legends[layer_def.name] = color_map.length !== 0 ? new WmsMapLegend($(color_map.toArray()[0]),layer_def,legend_data) : undefined;
                        def.resolve(legends[layer_def.name]);
						def.resolve(legends[layer_def.name].setLayer(self));
                    },def.reject);
                }

                return def.promise;
            },
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WmsMapLayer
             * @name  getGriddedData
             * @description
             *
             * Fetch gridded data for a specific location on this map layer.
             *
             * @param {google.maps.LatLng} latLng The point under which to fetch the data for.
             * @return {promise} A promise that will be resolved with an array of numbers, or rejected.
             */
            getGriddedData: function(latLng) {
                return WcsService.getGriddedData(GEOSERVER_URL,this,latLng,5/*should gridSize change based on the layer?*/);
            }
        });
        return l;
        // this code converts coordinates from ESPG:4326 to ESPG:3857, it originated @
        // http://gis.stackexchange.com/questions/52188/google-maps-wms-layer-with-3857
        // that author stated it came from StackOverflow which I tried to find to attribute properly but could not.
        // the issue here is that if requests are sent to the map service with ESPG:4326 coordinates everything
        // appears accurate when tightly zoomed however as you zoom out beyond a certain point the layers begin to
        // migrate north, the farther zoomed out the more drastic the migration (e.g. from Mexico into N. Canada)
        // while dealing in traditional lat/lng for google maps they are actually projected in 3857 (metres, not meters).
        // the main thing is that 4326 coordinates are projected onto a sphere/ellipsoid while 3857 are translated to
        // a flat surface.
        // unfortunately while google maps projection must be performing such transformations it doesn't expose this ability.
        function srsConversion(latLng) {
            if ((Math.abs(latLng.lng()) > 180 || Math.abs(latLng.lat()) > 90)) {
                return;
            }

            var num = latLng.lng() * 0.017453292519943295;
            var x = 6378137.0 * num;
            var a = latLng.lat() * 0.017453292519943295;

            return {lng: x, lat: 3189068.5 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)))};
        }
    }
    // returns an associative array of machine name layer to layer definition
    function getLayers(layers) {
        if(!layers || layers.length < 2) { // 1st layer is parent, children are the real layers
            return;
        }
        // make it a normal array, not a jQuery one
        var ls = [];
        layers.slice(1).each(function(i,o) {
            ls.push(o);
        });
        return ls.map(layerToObject).reduce(function(map,l){
            map[l.name] = l;
            return map;
        },{});
    }
    function layerToObject(layer) {
        var l = $(layer);
        var o = {
            name: l.find('Name').first().text(),
            // redmine #761
            title: l.find('Title').first().text().replace(/\((.+?)\)/g, ''),
            abstract: l.find('Abstract').first().text(),
            bbox: parseBoundingBox(l.find('EX_GeographicBoundingBox').first()),
            style: parseStyle(l.find('Style').first()),
            extent: parseExtent(l.find('Extent').first())
        };
        if(!o.bbox) {
            o.bbox = parseLatLonBoundingBox(l.find('LatLonBoundingBox').first());
        }
        return o;
    }
    function parseStyle(style) {
        var s = $(style);
        return {
            name: s.find('Name').first().text(),
            // redmine #761
            title: s.find('Title').first().text().replace(/\((.+?)\)/g, ''),
            legend: s.find('OnlineResource').attr('xlink:href') // not very specific...
        };
    }
    function parseLatLonBoundingBox(bb) {
        if(bb.length) {
            var bbox = {
                westBoundLongitude: parseFloat(bb.attr('minx')),
                eastBoundLongitude: parseFloat(bb.attr('maxx')),
                southBoundLatitude: parseFloat(bb.attr('miny')),
                northBoundLatitude: parseFloat(bb.attr('maxy')),
                getBounds: function() { // TODO, cut/paste
                    return new google.maps.LatLngBounds(
                        new google.maps.LatLng(bbox.southBoundLatitude,bbox.westBoundLongitude), // sw
                        new google.maps.LatLng(bbox.northBoundLatitude,bbox.eastBoundLongitude) // ne
                    );
                }
            };
            return bbox;
        }
    }
    function parseBoundingBox(bb) {
        if(bb.length) {
            var bbox = {
                westBoundLongitude: parseFloat(bb.find('westBoundLongitude').text()),
                eastBoundLongitude: parseFloat(bb.find('eastBoundLongitude').text()),
                southBoundLatitude: parseFloat(bb.find('southBoundLatitude').text()),
                northBoundLatitude: parseFloat(bb.find('northBoundLatitude').text()),
                getBounds: function() {
                    return new google.maps.LatLngBounds(
                        new google.maps.LatLng(bbox.southBoundLatitude,bbox.westBoundLongitude), // sw
                        new google.maps.LatLng(bbox.northBoundLatitude,bbox.eastBoundLongitude) // ne
                    );
                }
            };
            // some bounding boxes seem to be messed up with lat/lons of 0 && -1
            // so if any of those numbers occur throw away the bounding box.
            return ![bbox.westBoundLongitude,bbox.eastBoundLongitude,bbox.southBoundLatitude,bbox.northBoundLatitude].reduce(function(v,n){
                return v||(n === 0 || n === -1);
            },false) ? bbox : undefined;
        }
    }
    // represents an extent value of month/day/year
    function DateExtentValue(value,dateFmt) {
        var d = DateExtentUtil.parse(value);
        return {
            value: value,
            date: d,
            label: $filter('date')(d,(dateFmt||'longDate')),
            addToWmsParams: function(params) {
                params.time = value;
            },
            addToWcsParams: function(params) {
                if(!params.subset) {
                    params.subset = [];
                }
                params.subset.push('http://www.opengis.net/def/axis/OGC/0/time("'+value+'")');
            }
        };
    }
    // represents an extent value of day of year
    function DoyExtentValue(value) {
        return {
            value: value,
            label: $filter('thirtyYearAvgDayOfYear')(value),
            addToWmsParams: function(params) {
                params.elevation = value;
            },
            addToWcsParams: function(params) {
                if(!params.subset) {
                    params.subset = [];
                }
                params.subset.push('http://www.opengis.net/def/axis/OGC/0/elevation('+value+')');
            }
        };
    }
    function parseExtent(extent) {
        var e = $(extent),
            content = e.text(),
            dfltValue = e.attr('default'),
            dflt,values,
            name = e.attr('name'),
            start,end,yearFmt = 'yyyy',i;
        if(!name || !content) {
            return undefined;
        }
        function findDefault(current,value) {
            return current||(value.value == dfltValue ? value : undefined);
        }
        if(name === 'time') {
            if(content.indexOf('/') === -1) { // for now skip <lower>/<upper>/<resolution>
                values = content.split(',').map(function(d) { return new DateExtentValue(d); });
                // ugh
                dfltValue = dfltValue.replace(/0Z/,'0.000Z'); // extent values in ms preceision but not the default...
                dflt = values.reduce(findDefault,undefined);
                return {
                    label: 'Date',
                    type: 'date',
                    current: dflt, // bind the extent value to use here
                    values: values
                };
            } else {
                values = /^([^\/]+)\/(.*)\/P1Y$/.exec(content);
                if(values && values.length === 3) {
                    start = new DateExtentValue(values[1],yearFmt);
                    end = new DateExtentValue(values[2],yearFmt);
                    if(end.date.getFullYear() > start.date.getFullYear()) { // should never happen but to be safe
                        values = [start];
                        for(i = start.date.getFullYear()+1; i < end.date.getFullYear();i++) {
                            values.push(new DateExtentValue(i+'-01-01T00:00:00.000Z',yearFmt));
                        }
                        values.push(end);
                        return {
                            label: 'Year',
                            type: 'year',
                            current: end,
                            values: values
                        };
                    }
                }
            }
        } else if (name === 'elevation') {
            values = content.split(',').map(function(e) { return new DoyExtentValue(e); });
            dflt = values.reduce(findDefault,undefined);
            return {
                label: 'Day of Year',
                type: 'doy',
                current: dflt, // bind the extent value to use here
                values: values
            };
        }
    }
    return service;
}])
/**
 * @ngdoc service
 * @name npn-viz-tool.gridded-services:WcsService
 * @module npn-viz-tool.gridded-services
 * @description
 *
 * Interacts with the NPN geoserver WCS instance to supply underlying gridded data.  Loading of this service
 * extends the protypes of Number and the google.maps.LatLng class.
 *
 * <strong>Important:</strong> There should be no need to import and interact with this service directly.  Indivdual
 * layers ({@link npn-viz-tool.gridded-services:WmsMapLayer#methods_getgriddeddata}) expose an instance based method for fetching gridded data specific to those layers which should be used instead (they
 * call through to this service).
 */
.service('WcsService',['$log','$q','$http','uiGmapGoogleMapApi',function($log,$q,$http,uiGmapGoogleMapApi){
    // technically we should store and use a promise here but the WcsService
    // can't be interacted with until the Google Maps API is init'ed so just doing this
    // and later using it understanding the work has been done.
    uiGmapGoogleMapApi.then(function(maps){
        $log.debug('WcsService: adding functionality to Number/Google Maps prototypes.');
        Number.prototype.toRad = function() {
           return this * Math.PI / 180;
        };
        Number.prototype.toDeg = function() {
           return this * 180 / Math.PI;
        };
        // 0=N,90=E,180=S,270=W dist in km
        maps.LatLng.prototype.destinationPoint = function(brng, dist) {
           dist = dist / 6371;
           brng = brng.toRad();

           var lat1 = this.lat().toRad(), lon1 = this.lng().toRad();

           var lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) +
                                Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));

           var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) *
                                        Math.cos(lat1),
                                        Math.cos(dist) - Math.sin(lat1) *
                                        Math.sin(lat2));

           if (isNaN(lat2) || isNaN(lon2)) {
                return null;
            }

           return new google.maps.LatLng(lat2.toDeg(), lon2.toDeg());
        };
    });
    var service = {
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.gridded-services:WcsService
             * @name  getGriddedData
             * @description
             *
             * Fetch gridded data for a specific location on a specific map layer.
             *
             * @param {string} geoServerUrl The base URL of the geoserver instance.
             * @param {object} activeLayer The map layer returned from the WcsService that the data to fetch is associated with.
             * @param {google.maps.LatLng} latLng The point under which to fetch the data for.
             * @param {number} gridSize The side of the grid to ask the WCS service data for (the larger the gridSize the more data).
             * @return {promise} A promise that will be resolved with an array of numbers, or rejected.
             */
            getGriddedData: function(geoServerUrl,activeLayer,latLng,gridSize) {
                var wcs_base_url =geoServerUrl+'/wcs',
                    def = $q.defer(),
                edges = [0,80,180,270].map(function(bearing) {
                    return latLng.destinationPoint(bearing,(gridSize/2));
                }),
                wcsArgs = {
                    service: 'WCS',
                    request: 'GetCoverage',
                    version: '2.0.1',
                    coverageId: activeLayer.name.replace(':','__'), // convention
                    format: 'application/gml+xml',
                    subset: []
                },
                url;
                // add edges
                wcsArgs.subset.push('http://www.opengis.net/def/axis/OGC/0/Long('+[edges[3].lng(),edges[1].lng()].join(',')+')');
                wcsArgs.subset.push('http://www.opengis.net/def/axis/OGC/0/Lat('+[edges[2].lat(),edges[0].lat()].join(',')+')');
                if(activeLayer.extent && activeLayer.extent.current) {
                    activeLayer.extent.current.addToWcsParams(wcsArgs);
                }
                $log.debug('wcsArgs',wcsArgs);
                $http.get(wcs_base_url,{
                    params: wcsArgs
                }).then(function(response){
                    $log.debug('wcs response',response);
                    var wcs_data = $($.parseXML(response.data)),
                        // this is crazy simple minded, at this time. not sure if it needs to get
                        // more sophisticated.  there's a lot more info in the resulting gml document
                        // which may or may not be of interest.
                        tuples = wcs_data.find('tupleList').text();
                    $log.debug('wcs_data',wcs_data);
                    $log.debug('tuples',tuples);
                    if(tuples) {
                        def.resolve(tuples.trim().split(' ').map(function(tuple) { return parseFloat(tuple); }));
                    } else {
                        def.reject();
                    }
                },def.reject);
                return def.promise;
            }
        };
    return service;
}]);

angular.module('npn-viz-tool.help',[
])
.factory('HelpService',['$timeout',function($timeout){
    var LOOK_AT_ME_CLASS = 'look-at-me',
        LOOK_AT_ME_REMOVE_DELAY = 65000, // how long to leave the class in place, should exeed duration*iteration on the CSS animation
        current,
        service = {
        lookAtMe: function(selector,delay) {
            if(current) {
                service.stopLookingAtMe(current);
            }
            // if the class is there then don't add it again there's a timer set to remove it
            if(!$(selector).hasClass(LOOK_AT_ME_CLASS)) {
                $timeout(function(){
                    $(selector).addClass(LOOK_AT_ME_CLASS);
                    current = selector;
                    $timeout(function(){
                        service.stopLookingAtMe(selector);
                    },LOOK_AT_ME_REMOVE_DELAY);
                },(delay||0));
            }
        },
        stopLookingAtMe: function(selector) {
            $(selector).removeClass(LOOK_AT_ME_CLASS);
            current = null;
        }
    };
    return service;
}]);
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
            strokeColor: '#666',
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
    function addMissingFeatureNames(f,i){
        if(!f.properties) {
            f.properties = {};
        }
        if(!f.properties.NAME) {
            f.properties.NAME = ''+i;
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
                } else if (data.type === 'Topology') {
                    $log.debug('Translating Topojson to GeoJson');
                    data = topojson.feature(data,data.objects[Object.keys(data.objects)[0]]);
                }
                // make sure all features have a name
                data.features.forEach(addMissingFeatureNames);
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
            $scope.hasSufficientCriteria = FilterService.hasSufficientCriteria;
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

            function restyleAndRefilter() {
                LayerService.restyleLayers().then(function(){
                    if(FilterService.getFilter().hasSufficientCriteria()) {
                        $rootScope.$broadcast('filter-rerun-phase2',{});
                    }
                });
            }

            function clickFeature(feature,map) {
                var filterArg = feature.getProperty('$FILTER');
                lastFeature = feature;
                if(!filterArg) {
                    filterArg = new GeoFilterArg(feature,$scope.layerOnMap.layer.id);
                    FilterService.addToFilter(filterArg);
                    // TODO - different layers will probably have different styles, duplicating hard coded color...
                    // over-ride so the change shows up immediately and will be applied on the restyle (o/w there's a pause)
                    map.data.overrideStyle(feature, {fillColor: '#800000'});
                    feature.setProperty('$FILTER',filterArg);
                    restyleAndRefilter();
                }
            }

            function rightClickFeature(feature,map) {
                var filterArg = feature.getProperty('$FILTER');
                lastFeature = feature;
                if(filterArg) {
                    FilterService.removeFromFilter(filterArg);
                    feature.setProperty('$FILTER',null);
                    restyleAndRefilter();
                }
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
                            strokeColor: '#666',
                            strokeWeight: 1,
                            fillOpacity: 0
                        };
                    if(feature.getProperty('$FILTER')) {
                        style.fillColor = '#800000';
                        style.fillOpacity = 0.25;
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
                        eventListeners.push(map.data.addListener('rightclick',function(event){
                            $scope.$apply(function(){
                                rightClickFeature(event.feature,map);
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
        key: 'AIzaSyAsTM8XaktfkwpjEeDMXkNrojaiB2W5WyE',
        v: '3.24',
        libraries: ['geometry','drawing']
    });
    $logProvider.debugEnabled(window.location.hash && window.location.hash.match(/^#.*#debug/));
    window.onbeforeunload = function() {
        return 'You are about to navigate away from the USA-NPN Visualization Tool.  Are you sure you want to do this?';
    };
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
    'npn-viz-tool.export',
    'npn-viz-tool.help',
    'npn-viz-tool.gridded',
    'uiGmapgoogle-maps'
])
.directive('npnVizMap',['$location','$timeout','uiGmapGoogleMapApi','uiGmapIsReady','RestrictedBoundsService','FilterService','GriddedControlService','HelpService',
    function($location,$timeout,uiGmapGoogleMapApi,uiGmapIsReady,RestrictedBoundsService,FilterService,GriddedControlService,HelpService){
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
                var boundsRestrictor = RestrictedBoundsService.getRestrictor('base_map',new api.LatLngBounds(
                             new google.maps.LatLng(0.0,-174.0),// SW - out in the pacific SWof HI
                             new google.maps.LatLng(75.0,-43.0) // NE - somewhere in greenland
                        ));
                $scope.map = {
                    center: dfltCenter,
                    zoom: dfltZoom,
                    options: {
                        mapTypeId: maps.MapTypeId.TERRAIN,
                        mapTypeControl: true,
                        mapTypeControlOptions: {
                            //style: maps.MapTypeControlStyle.DROPDOWN_MENU,
                            position: maps.ControlPosition.RIGHT_BOTTOM
                        },
                        streetViewControl: false,
                        panControl: false,
                        zoomControl: true,
                        zoomControlOptions: {
                            style: maps.ZoomControlStyle.SMALL,
                            position: maps.ControlPosition.RIGHT_TOP
                        },
                        styles: [{
                            featureType: 'poi',
                            elementType: 'labels',
                            stylers: [{visibility:'off'}]
                        },{
                            featureType: 'transit.station',
                            elementType: 'labels',
                            stylers: [{visibility:'off'}]
                        }]
                    },
                    events: {
                        center_changed: boundsRestrictor.center_changed
                    }
                };
                uiGmapIsReady.promise(1).then(function(instances){
                    map = instances[0].map;
                    // this is a little leaky, the map knows which args the "share" control cares about...
                    // date is the minimum requirement for filtering.
                    var qargs = $location.search(),
                        qArgFilter = qargs['gl'] || (qargs['d'] && (qargs['s'] || qargs['n']));
                    if(!qArgFilter) {
                        stationViewOn();
                    }
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
                $timeout(function(){
                    $scope.stationView = true;
                },500);
                HelpService.lookAtMe('#toolbar-icon-filter',5000 /* wait 5 seconds */);
            }
            /*
            $scope.$on('tool-open',function(event,data){
                if(data.tool.id === 'layers') {
                    stationViewOff();
                }
            });*/
            $scope.$on('gridded-layer-on',stationViewOff);
            $scope.$on('gridded-layer-off',function() {
                if(FilterService.isFilterEmpty() && !GriddedControlService.layer) {
                    stationViewOn();
                }
            });
            $scope.$on('filter-phase1-start',stationViewOff);
            $scope.$on('filter-reset',stationViewOn);
            $scope.reset = function() {
                FilterService.resetFilter();
                if($scope.stationView) {
                    $scope.stationView = false;
                    $timeout(stationViewOn,500);
                }
            };
            $scope.$on('filter-phase2-end',function(event,data){
                if(data && data.observation) {
                    HelpService.lookAtMe('#toolbar-icon-visualizations',5000 /* wait 5 seconds */);
                }
            });
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
/**
 * @ngdoc overview
 * @name npn-viz-tool.vis-map
 * @description
 *
 * Logic for gridded data map visualization.
 */
angular.module('npn-viz-tool.vis-map',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.settings',
    'npn-viz-tool.gridded',
    'ui.bootstrap',
    'rzModule',
])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-geo-layer
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Transfers any geojson features from the base map to the vis map based on GeoFilterArgs.
 * This is strictly for visual effect.  If such GeoFilterArgs are in play on then the filtered results
 * will be used when placing in-situ data and as such markers will be similarly constrained.
 *
 * @scope
 */
.directive('mapVisGeoLayer',['$log','$q','$timeout','uiGmapIsReady','FilterService',function($log,$q,$timeout,uiGmapIsReady,FilterService){
    return {
        restrict: 'E',
        template: '',
        scope: {},
        link: function($scope,$element,$attrs) {
            var geoArgs = FilterService.getFilter().getGeoArgs(),
                mapContainer = $element.parent().parent().find('.angular-google-map-container');
            if(geoArgs.length) {
                $timeout(function(){
                    // this is a comlete hack but there appears to be no valid way to put features/polygons below a
                    // custom map layer.
                    $(mapContainer.children().first().children().first().children().first().children()[1]).css('z-index','99');
                },1000);
                uiGmapIsReady.promise(2).then(function(instances){
                    var baseMap = instances[0].map,
                        visMap = instances[1].map,
                        featurePromises = geoArgs.map(function(arg){
                            var def = $q.defer();
                            // arg.arg is the actual Google Maps API Feature that was
                            // selected on the base map which then needs to be translatedback
                            // to valid geojson.
                            arg.arg.toGeoJson(function(json){
                                def.resolve(json);
                            });
                            return def.promise;
                        });
                    $q.all(featurePromises).then(function(features){
                        visMap.data.addGeoJson({
                            type: 'FeatureCollection',
                            features: features
                        });
                        visMap.data.setStyle(function(feature){
                            return {
                                clickable: false,
                                strokeColor: '#666',
                                strokeOpacity: null,
                                strokeWeight: 1,
                                fillColor: '#800000',
                                fillOpacity: null,
                                zIndex: 0
                            };
                        });
                    });
                });
            }

        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-bounds-layer
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Transfers any rectangles from the base map to the vis map based on BoundsFilterArgs.
 * This is strictly for visual effect.  If such BoundsFilterArgs are in play on then the filtered results
 * will be used when placing in-situ data and as such markers will be similarly constrained.
 *
 * @scope
 */
.directive('mapVisBoundsLayer',['$log','$q','$timeout','uiGmapIsReady','FilterService','BoundsFilterArg',function($log,$q,$timeout,uiGmapIsReady,FilterService,BoundsFilterArg){
    return {
        restrict: 'E',
        template: '',
        scope: {},
        link: function($scope,$element,$attrs) {
            var boundsArgs = FilterService.getFilter().getBoundsArgs(),
                mapContainer = $element.parent().parent().find('.angular-google-map-container');
            if(boundsArgs.length) {
                $timeout(function(){
                    // this is a comlete hack but there appears to be no valid way to put features/polygons below a
                    // custom map layer.
                    $(mapContainer.children().first().children().first().children().first().children()[1]).css('z-index','99');
                },1000);
                uiGmapIsReady.promise(2).then(function(instances){
                    var baseMap = instances[0].map,
                        visMap = instances[1].map;
                    var rectangles = boundsArgs.map(function(arg){
                        return new google.maps.Rectangle(angular.extend({
                            clickable: false,
                            bounds: arg.arg.getBounds(),
                            map: visMap
                        },BoundsFilterArg.RECTANGLE_OPTIONS));
                    });
                    $log.debug('mapVisBoundsLayer.rectangles',rectangles);
                });
            }

        }
    };
}])
/**
 * @ngdoc service
 * @name npn-viz-tool.vis-map:MapVisMarkerService
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Holds SVG marker paths for shared use between tags and map markers.  Exposes basic
 * functionality for rendering marker paths in SVGs outside of the map itself (filter tags).
 *
 * @scope
 */
.service('MapVisMarkerService',['$log',function($log){
    var service = {
        /**
         * @ngdoc property
         * @propertyOf npn-viz-tool.vis-map:MapVisMarkerService
         * @name  PATHS
         * @description
         *
         * Array containing SVG paths (strings) for the map vis markers.
         */
        PATHS: [
            'M0 22 L22 22 L10 0 Z', // triangle
            'M0 22 L22 22 L22 0 L0 0 Z', // square
            'M4 22 L18 22 L22 10 L18 0 L4 0 L0 10 Z' // hexagon('ish)
        ],
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis-map:MapVisMarkerService
         * @name  getBaseIcon
         * @description
         *
         * Build a base marker object for a given icon path for use as a google map marker icon.
         *
         * @param {int} idx The marker index (0-2 otherwise the function does nothing).
         * @returns {object} A new base marker definition.
         */
        getBaseIcon: function(idx) {
            return {
                path: service.PATHS[idx],
                anchor: {x: 11, y: 11}, // markers are 22x22 px need to shift them up/left so they're centered over lat/lon
                scale: 1
            };
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis-map:MapVisMarkerService
         * @name  renderMarkerToSvg
         * @description
         *
         * Render a marker path, by index to an SVG.
         *
         * @param {string} selector The d3/css selector that uniquely identifies the SVG to render the marker path to.
         * @param {int} idx The marker index (0-2 otherwise the function does nothing).
         * @param {stromg} fillColor The color to fill the icon will (default steelblue)
         */
        renderMarkerToSvg: function(selector,idx,fillColor) {
            if(idx < 0 || idx >= service.PATHS.length) {
                return; // invalid index, just ignore it.
            }
            fillColor = fillColor||'steelblue';
            var svg = d3.select(selector);
            svg.selectAll('path').remove();
            svg.attr('viewBox','0 0 22 22')
                .attr('width',16)
                .attr('height',16);
            svg.append('path')
                .attr('d',service.PATHS[idx])
                //.attr('transform','translate(-16,-32)')
                .attr('fill',fillColor);
        }
    };
    return service;
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-filter-tags
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Displays filter tags on top of the map visualization and supports removal of selections from the
 * filter.
 *
 * @scope
 * @param {Array} map-vis-filter Two way binding to an array containing the species/phenophase/year selections.
 */
.directive('mapVisFilterTags',['$log','$timeout','MapVisMarkerService',function($log,$timeout,MapVisMarkerService){
    return {
        restrict: 'E',
        templateUrl: 'js/mapvis/filter-tags.html',
        scope: {
            mapVisFilter: '='
        },
        link: function($scope) {
            $scope.removeFromFilter = function(i) {
                $scope.mapVisFilter.splice(i,1);
            };
            $scope.$watchCollection('mapVisFilter',function(){
                $timeout(function(){
                    $scope.mapVisFilter.forEach(function(o,i){
                        MapVisMarkerService.renderMarkerToSvg('svg#map-vis-marker-'+i,i);
                    });
                });
            });
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-in-situ-control
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Directive to control addition of in-situ data to the visualization map.
 *
 * @scope
 * @param {object} layer The currently selected map layer.
 */
.directive('mapVisInSituControl',['$log','$q','$http','$url','CacheService','FilterService',function($log,$q,$http,$url,CacheService,FilterService){
    var IMPLICIT_SPECIES_IDS = ['20','1198','35','36'],
        IMPLICIT_SPECIES_KEY = 'map-vis-insitu-implicit-species';
    function mergeImplicitAndUser(implicit_list,user_list) {
        var user_ids = user_list.map(function(species) {
            return species.species_id;
        });
        implicit_list.forEach(function(s) {
            if(user_ids.indexOf(s.species_id) === -1) {
                user_list.push(s);
            }
        });
        return user_list;
    }
    function getMergedSpeciesList(user_list) {
        var def = $q.defer(),
            implicit_list = CacheService.get(IMPLICIT_SPECIES_KEY);
        if(implicit_list) {
            def.resolve(mergeImplicitAndUser(implicit_list,user_list));
        } else {
            // unfortunately there's no web service to select multiple species by id
            // and the getSpeciesById.json service returns slightly different objects
            // so go get all species and filter out the list to those of interest.
            $http.get($url('/npn_portal/species/getSpeciesFilter.json')).then(function(response){
                implicit_list = response.data.filter(function(species){
                    return IMPLICIT_SPECIES_IDS.indexOf(species.species_id) !== -1;
                });
                $log.debug('filtered implicit list of species',implicit_list);
                CacheService.put(IMPLICIT_SPECIES_KEY,implicit_list,-1);
                def.resolve(mergeImplicitAndUser(implicit_list,user_list));
            });
        }
        return def.promise;
    }
    return {
        restrict: 'E',
        templateUrl: 'js/mapvis/in-situ-control.html',
        scope: {
            mapVisFilter: '=',
            layer: '=',
            mapVisPlot: '&'
        },
        link: function($scope) {
            var filter = FilterService.getFilter(),
                dateArg = filter.getDateArg(),
                hasGeographicArgs = filter.getGeographicArgs().length > 0; // bounds or selected layer features
            $scope.years = d3.range(dateArg.getStartYear(),dateArg.getEndYear()+1);
            $scope.selection = {
                year: $scope.years[0]
            };
            function checkCurrentYear() {
                var currentYear;
                if($scope.layer) {
                    $scope.disableControl = false;
                    if($scope.currentYearOnly = $scope.layer.currentYearOnly()) {
                        // forcibly select just the current year
                        currentYear = $scope.layer.extent.current.date.getFullYear();
                        // make sure that year is among those available, otherwise hide the control entirely
                        if($scope.years.indexOf(currentYear) === -1) {
                            $scope.disableControl = true;
                        } else {
                            $scope.selection.year = currentYear; // UI will disable the control
                        }
                    }
                }
            }
            $scope.$watch('layer',checkCurrentYear);
            $scope.$watch('layer.extent.current',checkCurrentYear);

            filter.getSpeciesList().then(function(list){
                $log.debug('speciesList',list);
                if(hasGeographicArgs) {
                    $log.debug('filter has geographic args, not adding implicit species.');
                    $scope.speciesList = list;
                    $scope.selection.species = list.length ? list[0] : undefined;
                } else {
                    $log.debug('filter has no geographic args merging in implicit species.');
                    getMergedSpeciesList(list).then(function(with_implicit){
                        $log.debug('merged',with_implicit);
                        $scope.speciesList = with_implicit;
                        $scope.selection.species = with_implicit.length ? with_implicit[0] : undefined;
                    });
                }
            });
            function phenophaseListUpdate() {
                var species = $scope.selection.species,
                    year = $scope.selection.year;
                if(species && year) {
                    $scope.phenophaseList = [];
                    FilterService.getFilter().getPhenophasesForSpecies(species.species_id,true/*get no matter what*/,[year]).then(function(list){
                        $log.debug('phenophaseList',list);
                        $scope.phenophaseList = list;
                        $scope.selection.phenophase = list.length ? list[0] : undefined;
                    });
                }
            }
            $scope.$watch('selection.species',phenophaseListUpdate);
            $scope.$watch('selection.year',phenophaseListUpdate);

            $scope.validSelection = function() {
                var s = $scope.selection;
                if(s.species && s.phenophase && s.year) {
                    return $scope.mapVisFilter.length < 3 &&
                            ($scope.mapVisFilter.length === 0 ||
                            !$scope.mapVisFilter.reduce(function(found,f){
                                return found||(s.species === f.species && s.phenophase === f.phenophase && s.year === f.year);
                            },false));
                }
                return false;
            };
            $scope.addSelectionToFilter = function() {
                $scope.mapVisFilter.push(angular.extend({},$scope.selection));
            };
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis-map:map-vis-marker-info-window
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Contents of the InfoWindow when a user clicks on a plotted marker.
 */
.directive('mapVisMarkerInfoWindow',[function(){
    return {
        restrict: 'E',
        templateUrl: 'js/mapvis/marker-info-window.html'
    };
}])
/**
 * @ngdoc controller
 * @name npn-viz-tool.vis-map:MapVisCtrl
 * @module npn-viz-tool.vis-map
 * @description
 *
 * Controller for the gridded data map visualization dialog.
 */
.controller('MapVisCtrl',['$scope','$uibModalInstance','$filter','$log','$compile','$timeout','$q','$http','$url','uiGmapGoogleMapApi','uiGmapIsReady','RestrictedBoundsService','WmsService','ChartService','MapVisMarkerService','md5','GriddedInfoWindowHandler',
    function($scope,$uibModalInstance,$filter,$log,$compile,$timeout,$q,$http,$url,uiGmapGoogleMapApi,uiGmapIsReady,RestrictedBoundsService,WmsService,ChartService,MapVisMarkerService,md5,GriddedInfoWindowHandler){
        var api,
            map,
            griddedIwHandler,
            markerInfoWindow,
            markerMarkup = '<div><map-vis-marker-info-window></map-vis-marker-info-window></div>',
            boundsRestrictor = RestrictedBoundsService.getRestrictor('map_vis');
        $scope.modal = $uibModalInstance;
        $scope.wms_map = {
            center: { latitude: 48.35674, longitude: -122.39658 },
            zoom: 3,
            options: {
                disableDoubleClickZoom: true, // click on an arbitrary point gets gridded data so disable zoom (use controls).
                scrollwheel: true,
                streetViewControl: false,
                panControl: false,
                zoomControl: true,
                zoomControlOptions: {
                    style: google.maps.ZoomControlStyle.SMALL,
                    position: google.maps.ControlPosition.RIGHT_TOP
                },
                styles: [{
                    featureType: 'poi',
                    elementType: 'labels',
                    stylers: [{visibility:'off'}]
                },{
                    featureType: 'transit.station',
                    elementType: 'labels',
                    stylers: [{visibility:'off'}]
                }],
            },

            events: {
                click: function(m,ename,args) {
                    var ev = args[0];
                    $log.debug('click',ev);
                    if(griddedIwHandler) {
                        griddedIwHandler.open(ev.latLng,$scope.selection.activeLayer,$scope.legend);
                    }
                },
                center_changed: boundsRestrictor.center_changed
            }
        };
        uiGmapGoogleMapApi.then(function(maps){
            api = maps;
            uiGmapIsReady.promise(2).then(function(instances){
                map = instances[1].map;
                griddedIwHandler = new GriddedInfoWindowHandler(map);
                WmsService.getLayers(map).then(function(layers){
                    $log.debug('layers',layers);
                    $scope.layers = layers;
                },function(){
                    $log.error('unable to get map layers?');
                });
            });
        });

        $scope.selection = {};
        $scope.results = {};
        function resetMarkers() {
            $scope.results.markerModels = {};
            $scope.results.markers = [];
        }
        resetMarkers();
        function noInfoWindows() {
            if(griddedIwHandler) {
                griddedIwHandler.close();
            }
            if(markerInfoWindow) {
                markerInfoWindow.close();
            }
        }
        $scope.$watch('selection.layerCategory',function(category) {
            $log.debug('layer category change ',category);
            if($scope.selection.activeLayer) {
                $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                $scope.selection.activeLayer.off();
                delete $scope.selection.activeLayer;
                delete $scope.legend;
                noInfoWindows();
            }
        });
        $scope.$watch('selection.layer',function(layer) {
            if(!layer) {
                return;
            }
            noInfoWindows();
            delete $scope.markerModel;
            $log.debug('selection.layer',layer);
            if($scope.selection.activeLayer) {
                $log.debug('turning off layer ',$scope.selection.activeLayer.name);
                $scope.selection.activeLayer.off();
            }
            // looks odd that we're not turning the layer on here
            // but updating the activeLayer reference will also result in
            // the selection.activeLayer.extent.current watch firing which
            // toggles the map off/on
            $log.debug('fitting new layer ',layer.name);
            $scope.selection.activeLayer = layer.fit().on();
            boundsRestrictor.setBounds(layer.getBounds());
            delete $scope.legend;
            $scope.selection.activeLayer.getLegend(layer).then(function(legend){
                $scope.legend = legend;
                if(!$scope.selection.activeLayer.supportsData()) {
                    // moving to a layer that doesn't support data
                    // clear markers if any have been placed on the map.
                    resetMarkers();
                } else {
                    // the layer we're switching to supports data but will have a different
                    // color scale/labeling scheme, etc. so we need to update all the markers
                    // for the new layer.
                    $scope.results.markers = Object.keys($scope.results.markerModels).map(function(site_id){
                        return $scope.results.markerModels[site_id].restyle().marker();
                    });
                }
            });
        });
        $scope.$watch('selection.activeLayer.extent.current',function(v) {
            var layer,currentYear,updateSelections;
            if(layer = $scope.selection.activeLayer) {
                $log.debug('layer extent change ',layer.name,v);
                noInfoWindows();
                layer.off().on();
                if(layer.currentYearOnly()) {
                    currentYear = v.date.getFullYear();
                    updateSelections = $scope.speciesSelections.filter(function(ss){ return ss.year === currentYear; });
                    if(updateSelections.length !== $scope.speciesSelections.length) {
                        // something needs to change.... (keeping the original array reference)
                        $scope.speciesSelections.splice(0,$scope.speciesSelections.length);
                        //updateSelections.forEach($scope.speciesSelections.push);
                        updateSelections.forEach(function(us) { $scope.speciesSelections.push(us); });
                        // re-visualize
                        $scope.plotMarkers();
                    }
                }
            }
        });

        // This is an array of species/phenohpase selections which is passed to other directives
        // to manipulate.
        $scope.speciesSelections = [];
        $scope.$watchCollection('speciesSelections',function(newValue,oldValue) {
            $log.debug('speciesSelections',newValue,oldValue);
            if(oldValue && newValue && oldValue.length > newValue.length && $scope.results.markers.length) {
                // a filter has been removed and there are actually some markers on the map, re-visualize
                $scope.plotMarkers();
            }
        });

        $scope.markerEvents = {
            'click': function(m) {
                $log.debug('click',m);
                $scope.$apply(function(){
                    var sameAsPreviousMarker = ($scope.markerModel === $scope.results.markerModels[m.model.site_id]);
                    $scope.markerModel = $scope.results.markerModels[m.model.site_id];
                    if(!markerInfoWindow) {
                        markerInfoWindow = new api.InfoWindow({
                            maxWidth: 500,
                            content: ''
                        });
                    }
                    if(!sameAsPreviousMarker) {
                        markerInfoWindow.setContent('<i class="fa fa-circle-o-notch fa-spin"></i>');
                    }
                    markerInfoWindow.setPosition(m.position);
                    markerInfoWindow.open(m.map);
                });
            }
        };

        // this $watch correspondes to the marker click event the markerInfoWindow contents
        // aren't compiled until all the data necessary to render its contents arrive (station/gridded_data)
        // otherwise the results when showing the InfoWindow are inconsistent and data that arrives -after-
        // the window opens doesn't get properly bound into the DOM
        $scope.$watch('markerModel',function(model) {
            if(model) {
                var promises = [],station_def,gridded_def;
                $log.debug('mapVisMarkerInfoWindow.markerModel',model);
                if(!model.station) {
                    station_def = $q.defer();
                    promises.push(station_def.promise);
                    $http.get($url('/npn_portal/stations/getStationDetails.json'),{params:{ids: model.site_id}}).success(function(info){
                        model.station = info && info.length ? info[0] : undefined;
                        station_def.resolve();
                    });
                }
                gridded_def = $q.defer();
                promises.push(gridded_def.promise);
                delete model.gridded_legend_data;
                $scope.selection.activeLayer.getGriddedData(new google.maps.LatLng(model.latitude,model.longitude))
                    .then(function(tuples){
                        $log.debug('tuples',tuples);
                        var point = tuples && tuples.length ? tuples[0] : undefined;
                        if(typeof(point) === 'undefined' || point === -9999 || isNaN(point)) {
                            $log.debug('received undefined, -9999 or Nan ignoring');
                            gridded_def.resolve();
                            return;
                        }
                        var legend_data = $scope.legend.getPointData(point);
                        if(!legend_data) {
                            legend_data = {
                                label: $scope.legend.formatPointData(point),
                                color: '#ffffff'
                            };
                        }
                        model.gridded_legend_data = angular.extend({point: point},legend_data);
                        gridded_def.resolve();
                    },function() {
                        // TODO?
                        $log.error('unable to get gridded data.');
                        gridded_def.resolve();
                    });
                $q.all(promises).then(function(){
                    var compiled = $compile(markerMarkup)($scope);
                    $timeout(function(){
                        markerInfoWindow.setContent(compiled.html());
                        $timeout(function(){
                            $scope.speciesSelections.forEach(function(o,i){
                                if(model.data[i].records.length && model.data[i].legend_data) {
                                    MapVisMarkerService.renderMarkerToSvg('svg#map-vis-iw-marker-'+i,i,model.data[i].legend_data.color);
                                }
                            });
                        },250/*1st time the info-window shows up the svgs must not be there yet*/);
                    });
                });
            }
        });

        function GdMarkerModel() {
            var offscale_color = '#ffffff',
                marker = {
                    data: $scope.speciesSelections.map(function() { return {records: []}; }),
                    getSiteId: function() {
                        return marker.site_id;
                    },
                    restyle: function() {
                        // change border based on if there are more than one individual recorded for a marker.
                        marker.markerOpts.icon.strokeColor =  marker.data.reduce(function(sum,o){ return sum+o.records.length; },0) > 1 ? '#00ff00' : '#204d74';
                        marker.markerOpts.title = marker.data.reduce(function(title,o,filter_index){
                            delete o.first_yes_doy_avg;
                            delete o.first_yes_doy_stdev;
                            delete o.legend_data;
                            if(o.records.length) {
                                // info window code can re-use this information rather than calculating it.
                                if(o.records.length === 1) {
                                     o.first_yes_doy_avg = o.records[0].mean_first_yes_doy;
                                } else {
                                    // this code lingers from when the map visualizations were based on summary data and dealt with individuals
                                    $log.error('more than one record?',o);
                                    o.first_yes_doy_avg = o.records.reduce(function(sum,r){ return sum+r.mean_first_yes_doy; },0)/o.records.length;
                                    if(o.records.length > 1) {
                                        // calculate the standard deviation
                                        o.first_yes_doy_stdev = Math.sqrt(
                                            o.records.reduce(function(sum,r) {
                                                return sum+Math.pow((r.mean_first_yes_doy-o.mean_first_yes_doy),2);
                                            },0)/o.records.length
                                        );
                                    }
                                }
                                o.legend_data = $scope.legend.getPointData(o.first_yes_doy_avg)||{
                                    color: offscale_color,
                                    label: 'off scale'
                                };
                                var s = $scope.speciesSelections[filter_index];
                                o.records.forEach(function(record){
                                    var ldata = $scope.legend.getPointData(record.mean_first_yes_doy);
                                    // info window code can just use this information rather than re-calculating it.
                                    record.legend_data = ldata||{
                                        color: offscale_color,
                                        label: 'off scale'
                                    };
                                    if(title !== '') {
                                        title += ', ';
                                    }
                                    title += s.year;
                                    title += ': ';
                                    title += record.legend_data.label;
                                });
                            }
                            return title;
                        },'');
                        // update marker color
                        marker.markerOpts.icon.fillColor = marker.data[marker.filter_index].legend_data.color;
                        // update its key
                        marker.$markerKey = md5.createHash(JSON.stringify(marker));
                        return marker;
                    },
                    marker: function() { // returns a bare bones, simplified marker object
                        return {
                            $markerKey: marker.$markerKey,
                            site_id: marker.site_id,
                            latitude: marker.latitude,
                            longitude: marker.longitude,
                            markerOpts: marker.markerOpts
                        };
                    },
                    add: function(record,filter_index) {
                        marker.data[filter_index].records.push(record);
                        // first record dictates shape, z-index, etc.
                        if(!marker.markerOpts) {
                            marker.site_id = record.site_id;
                            marker.filter_index = filter_index;  // dictates the shape...
                            marker.latitude = record.latitude;
                            marker.longitude = record.longitude;
                            marker.markerOpts = {
                                zIndex: (365-record.first_yes_doy),
                                icon: angular.extend(MapVisMarkerService.getBaseIcon(filter_index),{
                                                    fillOpacity: 1.0,
                                                    strokeWeight: 1
                                                })
                            };
                        }
                        return marker.restyle();
                    }
                };
            return marker;
        }

        $scope.plotMarkers = function() {
            noInfoWindows();
            resetMarkers();
            $scope.working = true;
            // KISS - it may be more efficient to try to decide when to merge requests
            // together but this adds a lot of complexity/fragility so issuing
            // one request per combo in the filter.  this way there's no need to sift
            // through the results to decide which result applies to which marker type,
            // or deal with situations like gaps in years (one combo 2012 and another 2014
            // would make two requests better than one which would require tossing out 2013 data),
            // etc.

            // keep track of markers based on site so that if multiple species/individiuals exist for a given site
            // arrive markers can be updated more efficiently
            var site2marker = $scope.results.markerModels,
                summary_promises = $scope.speciesSelections.map(function(s,filter_index){
                    var def = $q.defer(),
                        params = {
                            request_src: 'npn-vis-map',
                            start_date: s.year+'-01-01',
                            end_date: s.year+'-12-31',
                            'species_id[0]': s.species.species_id,
                            'phenophase_id[0]': s.phenophase.phenophase_id
                        };
                    $log.debug('gathering summary data for ',s,params);
                    ChartService.getSiteLevelData(params,function(data){
                        $log.debug('site level data has arrived for ',s,data);
                        var new_markers = (data||[]).reduce(function(new_markers,record) {
                            if(site2marker[record.site_id]) { // update an existing marker (e.g. multiple species at a given site)
                                site2marker[record.site_id].add(record,filter_index);
                            } else { // add a new marker
                                new_markers.push(site2marker[record.site_id] = (new GdMarkerModel()).add(record,filter_index));
                            }
                            return new_markers;
                        },[]);
                        // put the markers on the map as the data arrives appending any new markers
                        $scope.results.markers = $scope.results.markers.concat(new_markers.map(function(m){ return m.marker(); }));
                        def.resolve();
                    });
                    /*
                    ChartService.getSummarizedData(params,function(data){
                        $log.debug('data has arrived for ',s,data);
                        // sometimes there are multiple records per individual
                        // I.e. two first_yes_doy for a single individual for a single year
                        // so the data cannot be plotted directly, when this happens we pick
                        // the first first_yes_doy (chronologically) for a given year so the code below
                        // organizes records by individual, sorts the records for a given indivual and
                        // uses only the first as input to a map marker.
                        var individuals = data.reduce(function(map,d){
                                if(!map[d.individual_id]) {
                                    map[d.individual_id] = [];
                                }
                                map[d.individual_id].push(d);
                                return map;
                            },{}),new_markers = [];
                        Object.keys(individuals).forEach(function(in_id){
                            // sort individual arrays ascending on first_yes_doy
                            individuals[in_id].sort(function(a,b){
                                return a.first_yes_doy - b.first_yes_doy;
                            });
                            // use just the first, ignore the rest (if there are any)
                            var record = individuals[in_id][0];

                            if(site2marker[record.site_id]) { // update an existing marker
                                site2marker[record.site_id].add(record,filter_index);
                            } else { // add a new marker
                                new_markers.push(site2marker[record.site_id] = (new GdMarkerModel()).add(record,filter_index));
                            }
                        });
                        // put the markers on the map as the data arrives appending any new markers
                        $scope.results.markers = $scope.results.markers.concat(new_markers.map(function(m){ return m.marker(); }));
                        def.resolve();
                    });
                    */
                    return def.promise;
                });
            $q.all(summary_promises).then(function(){
                $log.debug('all summary data has arrived...');
                $scope.working = false;
            });
        };
}]);

angular.module('templates-npnvis', ['js/calendar/calendar.html', 'js/filter/choroplethInfo.html', 'js/filter/dateFilterTag.html', 'js/filter/filterControl.html', 'js/filter/filterTags.html', 'js/filter/networkFilterTag.html', 'js/filter/speciesFilterTag.html', 'js/gridded/date-control.html', 'js/gridded/doy-control.html', 'js/gridded/gridded-control.html', 'js/gridded/layer-control.html', 'js/gridded/legend.html', 'js/gridded/year-control.html', 'js/layers/layerControl.html', 'js/map/map.html', 'js/mapvis/filter-tags.html', 'js/mapvis/in-situ-control.html', 'js/mapvis/mapvis.html', 'js/mapvis/marker-info-window.html', 'js/scatter/scatter.html', 'js/settings/settingsControl.html', 'js/time/time.html', 'js/toolbar/tool.html', 'js/toolbar/toolbar.html', 'js/vis/visControl.html', 'js/vis/visDialog.html', 'js/vis/visDownload.html']);

angular.module("js/calendar/calendar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/calendar/calendar.html",
    "<vis-dialog title=\"Calendar\" modal=\"modal\">\n" +
    "<form class=\"form-inline plot-criteria-form\">\n" +
    "    <div class=\"form-group\">\n" +
    "        <label for=\"yearsOneInput\">Select up to two years</label>\n" +
    "        <input id=\"yearsOneInput\" type=\"number\" class=\"form-control\"\n" +
    "               ng-model=\"selection.year\"\n" +
    "               uib-typeahead=\"year for year in validYears | filter:$viewValue\"\n" +
    "               required placeholder=\"Year\" />\n" +
    "        <button class=\"btn btn-default\" ng-click=\"addYear()\" ng-disabled=\"!canAddYear()\"><i class=\"fa fa-plus\"></i></button>\n" +
    "    </div>\n" +
    "    <div class=\"form-group animated-show-hide\">\n" +
    "        <label for=\"speciesInput\">Species phenophase combinations</label>\n" +
    "        <select name=\"speciesInput\" class=\"form-control\" ng-model=\"selection.species\" ng-options=\"(o|speciesTitle) for o in speciesList\"></select>\n" +
    "        <select name=\"phenophaseInput\" class=\"form-control\" ng-model=\"selection.phenophase\" ng-options=\"o.phenophase_name for o in phenophaseList\"></select>\n" +
    "        <div class=\"btn-group\" uib-dropdown is-open=\"selection.color_isopen\">\n" +
    "          <button type=\"button\" class=\"btn btn-default dropdown-toggle\" uib-dropdown-toggle style=\"background-color: {{colorRange[selection.color]}};\">\n" +
    "            &nbsp; <span class=\"caret\"></span>\n" +
    "          </button>\n" +
    "          <ul class=\"dropdown-menu\" role=\"menu\">\n" +
    "            <li ng-repeat=\"i in colors track by $index\" style=\"background-color: {{colorRange[$index]}};\"><a href ng-click=\"selection.color=$index;\">&nbsp;</a></li>\n" +
    "          </ul>\n" +
    "        </div>\n" +
    "        <button class=\"btn btn-default\" ng-click=\"addToPlot()\" ng-disabled=\"!canAddToPlot()\"><i class=\"fa fa-plus\"></i></button>\n" +
    "    </div>\n" +
    "</form>\n" +
    "<div class=\"panel panel-default main-vis-panel\" >\n" +
    "    <div class=\"panel-body\">\n" +
    "        <center ng-if=\"error_message\"><p class=\"text-danger\">{{error_message}}</p></center>\n" +
    "        <center>\n" +
    "        <ul class=\"to-plot list-inline animated-show-hide\" ng-if=\"toPlot.length || toPlotYears.length\">\n" +
    "            <li class=\"criteria\" ng-repeat=\"y in toPlotYears\">{{y}}\n" +
    "                <a href ng-click=\"removeYear($index)\"><i class=\"fa fa-times-circle-o\"></i></a>\n" +
    "            </li>\n" +
    "            <li class=\"criteria\" ng-repeat=\"tp in toPlot\">{{tp|speciesTitle}}/{{tp.phenophase_name}} <i style=\"color: {{colorRange[tp.color]}};\" class=\"fa fa-circle\"></i>\n" +
    "                <a href ng-click=\"removeFromPlot($index)\"><i class=\"fa fa-times-circle-o\"></i></a>\n" +
    "            </li>\n" +
    "            <li ng-if=\"data\">\n" +
    "                <label for=\"negativeInput\">Absence Data</label>\n" +
    "                <input type=\"checkbox\" id=\"negativeInput\" ng-model=\"selection.negative\" />\n" +
    "            </li>\n" +
    "            <li ng-if=\"!data && toPlotYears.length && toPlot.length\"><button class=\"btn btn-primary\" ng-click=\"visualize()\">Visualize</button></li>\n" +
    "        </ul>\n" +
    "        <div id=\"vis-container\">\n" +
    "            <div id=\"vis-working\" ng-show=\"working\"><i class=\"fa fa-circle-o-notch fa-spin fa-5x\"></i></div>\n" +
    "            <div class=\"chart-container\">\n" +
    "                <vis-download ng-if=\"data\"\n" +
    "                              selector=\".chart\"\n" +
    "                              filename=\"npn-calendar.png\"></vis-download>\n" +
    "                <div><svg class=\"chart\"></svg></div>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "        </center>\n" +
    "		<!--\n" +
    "		<p class = 'citation-text'>USA National Phenology Network, www.usanpn.org</p>\n" +
    "		-->\n" +
    "        <ul class=\"list-inline calendar-chart-controls\" ng-if=\"data\" style=\"float: right;\">\n" +
    "            <li>Label Size\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"decrFontSize()\"><i class=\"fa fa-minus\"></i></a>\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"incrFontSize()\"><i class=\"fa fa-plus\"></i></a>\n" +
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
    "</vis-dialog>\n" +
    "");
}]);

angular.module("js/filter/choroplethInfo.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/choroplethInfo.html",
    "<div id=\"choroplethHelp\" ng-show=\"show\">\n" +
    "    <h4>{{station_name}}</h4>\n" +
    "    <h5>Record Densit{{data.length == 1 ? 'y' : 'ies'}}</h5>\n" +
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
    "              popover-trigger=\"mouseenter\" uib-popover=\"Indicates the span of time represented on the map\">{{arg.arg.start_date}} - {{arg.arg.end_date}} </span>\n" +
    "        <span class=\"badge\"\n" +
    "              popover-placement=\"bottom\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "              popover-trigger=\"mouseenter\" uib-popover=\"{{badgeTooltip}}\">{{counts | speciesBadge:badgeFormat}}</span>\n" +
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
    "               uib-typeahead=\"year for year in validYears | lte:selected.date.end_date | filter:$viewValue\"\n" +
    "               required placeholder=\"From\" /> - \n" +
    "        <input id=\"end_date\" type=\"number\" class=\"form-control\"\n" +
    "                min=\"{{selected.date.start_date || 1900}}\"\n" +
    "                ng-model=\"selected.date.end_date\"\n" +
    "                uib-typeahead=\"year for year in validYears | gte:selected.date.start_date | filter:$viewValue\"\n" +
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
    "                    helper-elements=\"none reset filter\"\n" +
    "                    on-close=\"findSpecies()\"></div>\n" +
    "            </div>\n" +
    "            <div class=\"col-xs-3\">\n" +
    "                <button id=\"add-networks-button\" class=\"btn btn-default\"\n" +
    "                        ng-disabled=\"!speciesInput.networks.length || networksMaxedOut()\"\n" +
    "                        ng-click=\"addNetworksToFilter()\"\n" +
    "                        popover-placement=\"right\" popover-popup-delay=\"500\"\n" +
    "                        popover-trigger=\"mouseenter\" uib-popover=\"Add this filter to the map\" popover-append-to-body=\"true\">\n" +
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
    "                <button id=\"add-species-button\" class=\"btn btn-default\"\n" +
    "                        ng-disabled=\"!selected.species.length || speciesMaxedOut()\"\n" +
    "                        ng-click=\"addSpeciesToFilter()\"\n" +
    "                        popover-placement=\"right\" popover-popup-delay=\"500\"\n" +
    "                        popover-trigger=\"mouseenter\" uib-popover=\"Add this filter to the map\" popover-append-to-body=\"true\">\n" +
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
    "<div class=\"btn-group filter-tag date\" ng-class=\"{open: status.isopen}\">\n" +
    "    <a class=\"btn btn-default\" ng-click=\"status.isopen = !status.isopen\">\n" +
    "        {{arg.arg.network_name}}\n" +
    "        <span class=\"badge\"\n" +
    "              popover-placement=\"bottom\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "              popover-trigger=\"mouseenter\" uib-popover=\"{{badgeTooltip}}\">{{arg.counts | speciesBadge:badgeFormat}}</span>\n" +
    "        <span class=\"caret\"></span>\n" +
    "    </a>\n" +
    "    <ul class=\"dropdown-menu network-dd\" role=\"menu\">\n" +
    "        <li class=\"inline\">\n" +
    "            <label for=\"ydo-{{arg.arg.network_id}}\"><input id=\"ydo-{{arg.arg.network_id}}\" type=\"checkbox\" ng-model=\"arg.ydo\"/> Yes Data Only</label>\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "    <a class=\"btn btn-default\" ng-click=\"removeFromFilter(arg)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </a>\n" +
    "</div>\n" +
    "");
}]);

angular.module("js/filter/speciesFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/speciesFilterTag.html",
    "<div class=\"btn-group filter-tag\" ng-class=\"{open: status.isopen}\">\n" +
    "    <a class=\"btn btn-primary\" style=\"background-color: {{arg.color}};\" ng-disabled=\"!arg.phenophases\" ng-click=\"status.isopen = !status.isopen\">\n" +
    "        {{arg.arg | speciesTitle:titleFormat}}\n" +
    "        <span class=\"badge\"\n" +
    "              popover-placement=\"bottom\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "              popover-trigger=\"mouseenter\" uib-popover=\"{{badgeTooltip}}\">{{arg.counts | speciesBadge:badgeFormat}}</span>\n" +
    "        <span class=\"caret\"></span>\n" +
    "    </a>\n" +
    "    <ul class=\"dropdown-menu phenophase-list\" role=\"menu\">\n" +
    "        <li class=\"inline\">\n" +
    "            <label for=\"ydo-{{arg.arg.species_id}}\"><input id=\"ydo-{{arg.arg.species_id}}\" type=\"checkbox\" ng-model=\"arg.ydo\"/> Yes Data Only</label>\n" +
    "        </li>\n" +
    "        <li class=\"divider\"></li>\n" +
    "        <li class=\"inline\">Select <a href ng-click=\"selectAll(true)\">all</a> <a href ng-click=\"selectAll(false)\">none</a></li>\n" +
    "        <li class=\"divider\"></li>\n" +
    "        <li ng-repeat=\"phenophase in arg.phenophases | filter:hasCount\">\n" +
    "            <label for=\"{{arg.arg.species_id}}-{{phenophase.phenophase_id}}\"><input id=\"{{arg.arg.species_id}}-{{phenophase.phenophase_id}}\" type=\"checkbox\" ng-model=\"phenophase.selected\"> <span class=\"badge\">{{phenophase.count}}</span> {{phenophase.phenophase_name}}</label>\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "    <a class=\"btn btn-primary\" style=\"background-color: {{arg.color}};\" ng-click=\"removeFromFilter(arg)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </a>\n" +
    "</div>\n" +
    "");
}]);

angular.module("js/gridded/date-control.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/gridded/date-control.html",
    "<label>Date</label>\n" +
    "<p class=\"input-group\">\n" +
    "  <input type=\"text\" class=\"form-control\"\n" +
    "        uib-datepicker-popup=\"longDate\"\n" +
    "        ng-model=\"selection\"\n" +
    "        is-open=\"isOpen\"\n" +
    "        min-date=\"minDate\"\n" +
    "        max-date=\"maxDate\"\n" +
    "        close-text=\"Close\"\n" +
    "        ng-click=\"open()\" />\n" +
    "  <span class=\"input-group-btn\">\n" +
    "    <button type=\"button\" class=\"btn btn-default\" ng-click=\"open()\"><i class=\"glyphicon glyphicon-calendar\"></i></button>\n" +
    "  </span>\n" +
    "</p>");
}]);

angular.module("js/gridded/doy-control.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/gridded/doy-control.html",
    "<label>Day of Year</label>\n" +
    "<div class=\"form-inline\" style=\"margin-bottom: 15px;\">\n" +
    "    <div class=\"form-group\">\n" +
    "        <label for=\"selectedMonth\" class=\"sr-only\">Month</label>\n" +
    "        <select id=\"selectedMonth\" class=\"form-control\" ng-model=\"selection.month\"\n" +
    "                ng-options=\"m as (m | date:'MMMM') for m in months\"></select>\n" +
    "    </div>\n" +
    "    <div class=\"form-group\" ng-if=\"selection.month\">\n" +
    "        <label for=\"selectedDate\" class=\"sr-only\">Day</label>\n" +
    "        <select id=\"selectedDate\" class=\"form-control\" ng-model=\"selection.date\"\n" +
    "                ng-options=\"d for d in dates\"></select>\n" +
    "    </div>\n" +
    "    <div class=\"form-group\">\n" +
    "        <input class=\"form-control\" style=\"width: 50px; cursor: default;\" type=\"text\" value=\"{{layer.extent.current.value | number:0}}\" disabled />\n" +
    "    </div>\n" +
    "</div>");
}]);

angular.module("js/gridded/gridded-control.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/gridded/gridded-control.html",
    "<p class=\"empty-filter-notes\">Spring Index and Accumulated Growing Degree Day (AGDD) maps display spatial and temporal patterns in temperature and predicted phenology across the United States. Use the controls below to select a gridded layer to view on the map.</p>\n" +
    "<p><a href=\"https://www.usanpn.org/data/phenology_maps\" target=\"_blank\">More Info on Phenology Maps</a></p>\n" +
    "<gridded-layer-control></gridded-layer-control>");
}]);

angular.module("js/gridded/layer-control.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/gridded/layer-control.html",
    "<div ng-if=\"layers\" class=\"gridded-layer-control\">\n" +
    "    <div class=\"form-group\">\n" +
    "        <a ng-if=\"actions.reset && selection.layer\" class=\"reset-layer pull-right\" ng-click=\"actions.reset()\"\n" +
    "            uib-popover=\"Reset\" popover-placement=\"right\" popover-append-to-body=\"true\" popover-trigger=\"mouseenter\" popover-delay=\"500\"><i class=\"fa fa-times-circle\"></i></a>\n" +
    "        <label for=\"selectedCategory\">Category</label>\n" +
    "        <select id=\"selectedCategory\" class=\"form-control\" ng-model=\"selection.layerCategory\"\n" +
    "                ng-options=\"cat as cat.name for cat in layers.categories\"></select>\n" +
    "\n" +
    "    </div>\n" +
    "    <div class=\"form-group\" ng-if=\"selection.layerCategory\">\n" +
    "        <label for=\"selectedLayer\">Layer</label>\n" +
    "        <select id=\"selectedLayer\" class=\"form-control\" ng-model=\"selection.layer\"\n" +
    "                ng-options=\"l as l.getTitle() for l in selection.layerCategory.layers\"></select>\n" +
    "    </div>\n" +
    "    <div class=\"extent-control\" ng-if=\"selection.layer.extent\" ng-switch=\"selection.layer.extent.type\">\n" +
    "        <gridded-doy-control ng-switch-when=\"doy\" layer=\"selection.layer\"></gridded-doy-control>\n" +
    "        <gridded-date-control ng-switch-when=\"date\" layer=\"selection.layer\"></gridded-date-control>\n" +
    "        <gridded-year-control ng-switch-when=\"year\" layer=\"selection.layer\"></gridded-year-control>\n" +
    "    </div>\n" +
    "    <gridded-opacity-slider layer=\"selection.layer\"></gridded-opacity-slider>\n" +
    "    <gridded-range-slider layer=\"selection.layer\"></gridded-range-slider>\n" +
    "    <p ng-if=\"selection.layer.abstract\">{{selection.layer.getAbstract()}}</p>\n" +
    "    <p ng-if=\"selection.layer.$description\" ng-bind-html=\"selection.layer.$description\"></p>\n" +
    "</div>\n" +
    "");
}]);

angular.module("js/gridded/legend.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/gridded/legend.html",
    "<svg class=\"gridded-legend\"></svg>");
}]);

angular.module("js/gridded/year-control.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/gridded/year-control.html",
    "<div class=\"form-group\" ng-if=\"layer.extent\">\n" +
    "    <label for=\"selectedExtent\">Year</label>\n" +
    "    <select id=\"selectedExtent\" class=\"form-control\" ng-model=\"layer.extent.current\" ng-options=\"v as v.label for v in layer.extent.values\"></select>\n" +
    "</div>");
}]);

angular.module("js/layers/layerControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/layers/layerControl.html",
    "<p class=\"empty-filter-notes\" ng-if=\"!hasSufficientCriteria()\">\n" +
    "    Before adding a boundary layer to the map you must create and execute a filter.\n" +
    "    A boundary layer will allow you to filter sites based on the geographic area it defines.\n" +
    "</p>\n" +
    "<ul class=\"list-unstyled\" ng-if=\"hasSufficientCriteria()\">\n" +
    "    <li><label ng-class=\"{'selected-layer': layerOnMap.layer === 'none'}\"><a href ng-click=\"layerOnMap.layer='none'\">None</a></label>\n" +
    "        <!--input type=\"radio\" id=\"layer-none\" ng-model=\"layerOnMap.layer\" value=\"none\"/> <label for=\"layer-none\">None</label-->\n" +
    "    </li>\n" +
    "    <li ng-repeat=\"layer in layers\">\n" +
    "        <label  ng-class=\"{'selected-layer': layerOnMap.layer === layer}\">{{layer.label}}</label>\n" +
    "        <a href ng-click=\"layerOnMap.layer=layer\"><img ng-src=\"{{layer.img}}\" /></a>\n" +
    "        <ul class=\"list-inline layer-links\">\n" +
    "            <li ng-if=\"layer.link\"><a href=\"{{layer.link}}\" target=\"_blank\">More Info</a></li>\n" +
    "            <li ng-if=\"layer.source\"><a href=\"{{layer.source}}\" target=\"_blank\">Source</a></li>\n" +
    "        </ul>\n" +
    "    </li>\n" +
    "</ul>");
}]);

angular.module("js/map/map.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/map/map.html",
    "<a title=\"Reset\" href id=\"reset-control\" class=\"btn btn-default btn-xs\" ng-click=\"reset()\"><i class=\"fa fa-refresh\"></i></a>\n" +
    "\n" +
    "<npn-working></npn-working>\n" +
    "\n" +
    "<ui-gmap-google-map ng-if=\"map\" center='map.center' zoom='map.zoom' options=\"map.options\" events=\"map.events\">\n" +
    "    <npn-stations ng-if=\"stationView\"></npn-stations>\n" +
    "    <npn-filter-results></npn-filter-results>\n" +
    "    <bounds-manager></bounds-manager>\n" +
    "</ui-gmap-google-map>\n" +
    "\n" +
    "<share-control></share-control>\n" +
    "<export-control></export-control>\n" +
    "<filter-tags></filter-tags>\n" +
    "<choropleth-info></choropleth-info>\n" +
    "<gridded-legend-main></gridded-legend-main>\n" +
    "\n" +
    "<toolbar>\n" +
    "    <tool id=\"filter\" icon=\"fa-search\" title=\"Filter\">\n" +
    "        <filter-control></filter-control>\n" +
    "    </tool>\n" +
    "    <tool id=\"layers\" icon=\"fa-bars\" title=\"Boundary Layers\">\n" +
    "        <layer-control></layer-control>\n" +
    "    </tool>\n" +
    "    <tool id=\"visualizations\" icon=\"fa-bar-chart\" title=\"Visualizations\">\n" +
    "        <vis-control></vis-control>\n" +
    "    </tool>\n" +
    "    <tool id=\"settings\" icon=\"fa-cog\" title=\"Settings\">\n" +
    "        <settings-control></settings-control>\n" +
    "    </tool>\n" +
    "	<tool id=\"gridded\" icon=\"fa-th\" title=\"Gridded Layers\">		\n" +
    "		<gridded-control></gridded-control>\n" +
    "	</tool>	\n" +
    "</toolbar>\n" +
    "\n" +
    "");
}]);

angular.module("js/mapvis/filter-tags.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/mapvis/filter-tags.html",
    "<ul class=\"filter-tags map-vis list-inline pull-right\">\n" +
    "	<li ng-if=\"mapVisFilter.length\">\n" +
    "        <div class=\"btn-group filter-tag\">\n" +
    "            <a class=\"btn btn-default\">\n" +
    "                <span>Multiple Observations Reported at this Location</span>\n" +
    "                <img src='mult-species-legend.png' />\n" +
    "            </a>\n" +
    "        </div>		\n" +
    "	</li>\n" +
    "    <li ng-repeat=\"tag in mapVisFilter\">\n" +
    "        <div class=\"btn-group filter-tag\">\n" +
    "            <a class=\"btn btn-default\">\n" +
    "                <span>{{tag.species | speciesTitle}}, {{tag.phenophase.phenophase_name}}, {{tag.year}} </span>\n" +
    "                <svg id=\"map-vis-marker-{{$index}}\"></svg>\n" +
    "            </a>\n" +
    "            <a class=\"btn btn-default\" ng-click=\"removeFromFilter($index)\">\n" +
    "                <i class=\"fa fa-times-circle-o\"></i>\n" +
    "            </a>\n" +
    "        </div>\n" +
    "    </li>\n" +
    "</ul>");
}]);

angular.module("js/mapvis/in-situ-control.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/mapvis/in-situ-control.html",
    "<div class=\"in-situ-control\" ng-if=\"layer && layer.supportsData()\">\n" +
    "    <div class=\"disable-curtain\" ng-if=\"disableControl\"></div>\n" +
    "    <hr />\n" +
    "	<h4>Plot Observed Onset</h4>	\n" +
    "    <div class=\"form-group\" ng-if=\"speciesList\">\n" +
    "        <label for=\"selectedSpecies\">Species</label>\n" +
    "        <select id=\"selectedSpecies\" class=\"form-control\" ng-model=\"selection.species\"\n" +
    "                ng-options=\"s as (s | speciesTitle) for s in speciesList\"></select>\n" +
    "    </div>\n" +
    "    <div class=\"form-group\" ng-if=\"selection.species\">\n" +
    "        <label for=\"selectedPhenophse\">Phenophase</label>\n" +
    "        <select id=\"selectedPhenophse\" class=\"form-control\" ng-model=\"selection.phenophase\"\n" +
    "                ng-options=\"p as p.phenophase_name for p in phenophaseList\"></select>\n" +
    "    </div>\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"col-xs-9\">\n" +
    "            <div class=\"form-group\" ng-if=\"selection.species && selection.phenophase\">\n" +
    "                <label for=\"selectedYear\">Year</label>\n" +
    "                <select id=\"selectedYear\" class=\"form-control\" ng-model=\"selection.year\" ng-disabled=\"currentYearOnly\"\n" +
    "                        ng-options=\"y as y for y in years\"></select>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "        <div class=\"col-xs-3\">\n" +
    "            <div class=\"form-group text-right\">\n" +
    "                <label for=\"addToMapVis\" style=\"visibility: hidden; display: block;\">Add</label>\n" +
    "                <button id=\"addToMapVis\" class=\"btn btn-default\"\n" +
    "                        ng-click=\"addSelectionToFilter()\"\n" +
    "                        ng-disabled=\"!validSelection()\"\n" +
    "                        popover-placement=\"left\" popover-popup-delay=\"500\"\n" +
    "                        popover-trigger=\"mouseenter\"\n" +
    "                        uib-popover=\"Add this species/phenophase/year to the map\"\n" +
    "                        popover-append-to-body=\"true\">\n" +
    "                    <i class=\"fa fa-plus\"></i>\n" +
    "                </button>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"col-xs-12\">\n" +
    "            <button id=\"mapVisPlot\" class=\"btn btn-default pull-right\"\n" +
    "                    ng-click=\"mapVisPlot()\"\n" +
    "                    ng-disabled=\"!mapVisFilter.length\"\n" +
    "                    popover-placement=\"left\" popover-popup-delay=\"500\"\n" +
    "                    popover-trigger=\"mouseenter\"\n" +
    "                    uib-popover=\"Add this species/phenophase/year to the map\"\n" +
    "                    popover-append-to-body=\"true\">Plot data</button>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<div class=\"in-situ-control\" ng-if=\"layer && !layer.supportsData()\">\n" +
    "	<p style='font-style:italic;font-size:11px'>Note: To plot Nature’s Notebook phenology observations against phenology maps, please select one of the following Gridded Layer categories: \"Spring Indices, Historical Annual\", \"Spring Indices, Current Year\" or \"Spring Indices, Daily 30-year Average\".</p>\n" +
    "</div>");
}]);

angular.module("js/mapvis/mapvis.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/mapvis/mapvis.html",
    "<vis-dialog title=\"Phenology Maps\" modal=\"modal\">\n" +
    "    <div class=\"container-fluid\">\n" +
    "        <div class=\"row\">\n" +
    "            <div class=\"col-xs-8\">\n" +
    "                <div id=\"vis-working\" ng-show=\"working\"><i class=\"fa fa-circle-o-notch fa-spin fa-5x\"></i></div>\n" +
    "                <map-vis-filter-tags map-vis-filter=\"speciesSelections\"></map-vis-filter-tags>\n" +
    "                <ui-gmap-google-map ng-if=\"wms_map\" center='wms_map.center' zoom='wms_map.zoom' options=\"wms_map.options\" events=\"wms_map.events\">\n" +
    "                    <ui-gmap-markers models=\"results.markers\"\n" +
    "                                    idKey=\"'$markerKey'\"\n" +
    "                                    coords=\"'self'\"\n" +
    "                                    icon=\"'icon'\"\n" +
    "                                    options=\"'markerOpts'\"\n" +
    "                                    doCluster=\"false\"\n" +
    "                                    events=\"markerEvents\"></ui-gmap-markers>\n" +
    "                    <map-vis-geo-layer></map-vis-geo-layer>\n" +
    "                    <map-vis-bounds-layer></map-vis-bounds-layer>\n" +
    "                </ui-gmap-google-map>\n" +
    "				<p class = 'citation-text'>USA National Phenology Network, www.usanpn.org</p>\n" +
    "                <gridded-legend legend=\"legend\"></gridded-legend>\n" +
    "                <!--map-vis-marker-info-window></map-vis-marker-info-window-->\n" +
    "            </div>\n" +
    "            <div class=\"col-xs-4\">\n" +
    "				<h4>Select Gridded Layer</h4>\n" +
    "				<p><a href=\"https://www.usanpn.org/data/phenology_maps\" target=\"_blank\">More Info on Phenology Maps</a></p>\n" +
    "                <gridded-layer-control></gridded-layer-control>\n" +
    "                <map-vis-in-situ-control layer=\"selection.layer\" map-vis-filter=\"speciesSelections\" map-vis-plot=\"plotMarkers()\"></map-vis-in-situ-control>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</vis-dialog>");
}]);

angular.module("js/mapvis/marker-info-window.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/mapvis/marker-info-window.html",
    "<div class=\"map-vis-marker-info-window\" ng-if=\"markerModel\">\n" +
    "    <div class=\"station-info\" ng-if=\"markerModel.station\">\n" +
    "        <h3>{{markerModel.station.site_name}}</h3>\n" +
    "        <ul class=\"list-unstyled\">\n" +
    "            <li ng-if=\"markerModel.station.group_name\"><label>Group:</label> {{markerModel.station.group_name}}</li>\n" +
    "            <li><label>Latitude:</label> {{markerModel.station.latitude}} <label>Longitude:</label> {{markerModel.station.longitude}}</li>\n" +
    "            <li ng-if=\"markerModel.gridded_legend_data\"><label>Gridded Layer Value:</label> <div class=\"legend-cell\" style=\"background-color: {{markerModel.gridded_legend_data.color}};\">&nbsp;</div> {{markerModel.gridded_legend_data.point | number:0}} ({{legend.formatPointData(markerModel.gridded_legend_data.point)}})</li>\n" +
    "        </ul>\n" +
    "    </div>\n" +
    "    <div class=\"gridded-data\" ng-if=\"markerModel.gridded_legend_data\">\n" +
    "    </div>\n" +
    "    <div ng-repeat=\"md in markerModel.data\" ng-init=\"tag = speciesSelections[$index];\" ng-if=\"md.records.length\">\n" +
    "        <h4><span>{{tag.species | speciesTitle}}, {{tag.phenophase.phenophase_name}}, {{tag.year}} </span>\n" +
    "                <svg id=\"map-vis-iw-marker-{{$index}}\" uib-tooltip=\"{{md.legend_data.label}}\" tooltip-append-to-body=\"true\" tooltip-placement=\"top\"></svg></h4>\n" +
    "        <ul class=\"list-unstyled\">\n" +
    "            <li><label>Observed Day of Onset:</label> {{md.first_yes_doy_avg | number:0}} ({{legend.formatPointData(md.first_yes_doy_avg)}})<span ng-if=\"md.records.length > 1\"> [Average of {{md.records.length}} individuals. Standard Deviation: {{md.first_yes_doy_stdev | number:1}}]</span></li>\n" +
    "        </ul>\n" +
    "    </div>\n" +
    "</div>");
}]);

angular.module("js/scatter/scatter.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/scatter/scatter.html",
    "<vis-dialog title=\"Scatter Plot\" modal=\"modal\">\n" +
    "<form class=\"form-inline plot-criteria-form\">\n" +
    "    <div class=\"form-group\">\n" +
    "        <label for=\"speciesInput\">Select up to three species phenophase combinations</label>\n" +
    "        <select name=\"speciesInput\" class=\"form-control\" ng-model=\"selection.species\" ng-options=\"(o|speciesTitle) for o in speciesList\"></select>\n" +
    "        <select name=\"phenophaseInput\" class=\"form-control\" ng-model=\"selection.phenophase\" ng-options=\"o.phenophase_name for o in phenophaseList\"></select>\n" +
    "        <div class=\"btn-group\" uib-dropdown is-open=\"selection.color_isopen\">\n" +
    "          <button type=\"button\" class=\"btn btn-default dropdown-toggle\" uib-dropdown-toggle style=\"background-color: {{colorRange[selection.color]}};\">\n" +
    "            &nbsp; <span class=\"caret\"></span>\n" +
    "          </button>\n" +
    "          <ul class=\"dropdown-menu\" role=\"menu\">\n" +
    "            <li ng-repeat=\"i in colors track by $index\" style=\"background-color: {{colorRange[$index]}};\"><a href ng-click=\"selection.color=$index;\">&nbsp;</a></li>\n" +
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
    "            <li class=\"criteria\" ng-repeat=\"tp in toPlot\">{{tp|speciesTitle}}/{{tp.phenophase_name}} <i style=\"color: {{colorRange[tp.color]}};\" class=\"fa fa-circle\"></i>\n" +
    "                <a href ng-click=\"removeFromPlot($index)\"><i class=\"fa fa-times-circle-o\"></i></a>\n" +
    "            </li>\n" +
    "            <li>\n" +
    "                <select class=\"form-control vis-axis\" ng-model=\"selection.axis\" ng-options=\"o as o.label for o in axis\"></select>\n" +
    "            </li>\n" +
    "            <li>\n" +
    "                <label for=\"fitLinesInput\">Fit Line{{toPlot.length > 1 ? 's' : ''}}</label>\n" +
    "                <input type=\"checkbox\" id=\"fitLinesInput\" ng-model=\"selection.regressionLines\" />\n" +
    "            </li>\n" +
    "            <li>\n" +
    "                <label for=\"individualPhenometrics\">Use Individual Phenometrics</label>\n" +
    "                <input type=\"checkbox\" id=\"individualPhenometrics\" ng-model=\"selection.useIndividualPhenometrics\" />\n" +
    "            </li>\n" +
    "            <li ng-if=\"!data\"><button class=\"btn btn-primary\" ng-click=\"visualize()\">Visualize</button></li>\n" +
    "        </ul>\n" +
    "        <div id=\"vis-container\">\n" +
    "            <div id=\"vis-working\" ng-show=\"working\"><i class=\"fa fa-circle-o-notch fa-spin fa-5x\"></i></div>\n" +
    "            <div class=\"chart-container\">\n" +
    "                <vis-download ng-if=\"data\"\n" +
    "                              selector=\".chart\"\n" +
    "                              filename=\"npn-scatter-plot.png\"></vis-download>\n" +
    "                <div><svg class=\"chart\"></svg></div>\n" +
    "            </div>\n" +
    "            <div ng-if=\"filteredDisclaimer\" class=\"filter-disclaimer\">For quality assurance purposes, only onset dates that are preceded by negative records are included in the visualization.</div>\n" +
    "        </div>\n" +
    "        </center>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<!--pre ng-if=\"record\">{{record | json}}</pre-->\n" +
    "\n" +
    "</vis-dialog>\n" +
    "");
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
    "        <label>Variable Displayed</label>\n" +
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
    "        <Label for=\"onlyYesData\">Only Show Yes Data</label>\n" +
    "        <ul class=\"list-unstyled\">\n" +
    "            <li ng-repeat=\"option in [true,false]\">\n" +
    "                <input type=\"radio\" name=\"onlyYesData\" id=\"onlyYesData{{option}}\" ng-model=\"settings.onlyYesData.value\"\n" +
    "                       ng-value=\"{{option}}\" /> <label for=\"onlyYesData{{option}}\">{{option | yesNo}}</label>\n" +
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
    "        <label for=\"excludeLqd\">Exclude less precise data from visualizations</label>\n" +
    "        <ul class=\"list-unstyled\">\n" +
    "            <li ng-repeat=\"option in [true,false]\">\n" +
    "                <input type=\"radio\" id=\"filterLqdSummary{{option}}\" ng-model=\"settings.filterLqdSummary.value\"\n" +
    "                       ng-value=\"{{option}}\" /> <label for=\"filterLqdSummary{{option}}\">{{option | yesNo}}</label>\n" +
    "            </li>\n" +
    "        </ul>\n" +
    "        <p>Selecting <strong>Yes</strong> will exclude data points which lack a \"no\" record preceding the first \"yes\" record from certain visualizations. </p>\n" +
    "    </li>\n" +
    "    <li class=\"divider\"></li>\n" +
    "    <li>\n" +
    "        <label for=\"dataPrecisionFilter\">Data Precision Filter</label>\n" +
    "        <select class=\"form-control\" ng-model=\"settings.dataPrecisionFilter.value\"\n" +
    "            ng-options=\"days as days+' days' for days in settings.dataPrecisionFilter.options\" />\n" +
    "        <p style=\"margin: 15px 0px;\">Less precise data is removed from the scatter plot and map visualizations by only plotting data points preceded or followed by a “no” within 30 days. This filter can be adjusted here to  7, 14, or 30 days.</p>\n" +
    "    </li>\n" +
    "</ul>\n" +
    "");
}]);

angular.module("js/time/time.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/time/time.html",
    "<vis-dialog title=\"Time Series\" modal=\"modal\">\n" +
    "    <div class=\"controls\">\n" +
    "        <div class=\"checkbox pull-right\" ng-if=\"selection.lastYearValid\">\n" +
    "            <label ng-disabled=\"working\">\n" +
    "              <input type=\"checkbox\" ng-model=\"selection.showLastYear\"> Show previous year’s data\n" +
    "            </label>\n" +
    "        </div>\n" +
    "        <div class=\"threshold\">\n" +
    "            <label>AGDD Threshold</label>\n" +
    "            <rzslider rz-slider-model=\"selection.threshold.value\" rz-slider-options=\"selection.threshold.options\"></rzslider>\n" +
    "        </div>\n" +
    "        <div class=\"days-of-the-year\">\n" +
    "            <label>Show days of the year</label>\n" +
    "            <rzslider rz-slider-model=\"selection.doys.value\" rz-slider-options=\"selection.doys.options\"></rzslider>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"panel panel-default main-vis-panel\" >\n" +
    "        <div class=\"panel-body\">\n" +
    "            <center>\n" +
    "            <div id=\"vis-container\">\n" +
    "                <div id=\"vis-working\" ng-show=\"working\"><i class=\"fa fa-circle-o-notch fa-spin fa-5x\"></i></div>\n" +
    "                <div class=\"chart-container\">\n" +
    "                    <vis-download ng-if=\"!working\"\n" +
    "                                  selector=\".chart\"\n" +
    "                                  filename=\"time-series.png\"></vis-download>\n" +
    "                    <div><svg class=\"chart\"></svg></div>\n" +
    "                </div>\n" +
    "            </div>\n" +
    "            </center>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</vis-dialog>\n" +
    "");
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
    "        popover-placement=\"right\" uib-popover=\"{{(t.selected) ? 'Click to Collapse Menu' : t.title}}\" popover-trigger=\"mouseenter\" popover-popup-delay=\"1000\" popover-append-to-body=\"true\"\n" +
    "        ng-click=\"select(t)\">\n" +
    "      <i id=\"toolbar-icon-{{t.id}}\" class=\"toolbar-icon fa {{t.icon}}\"></i>\n" +
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

angular.module("js/vis/visDownload.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/vis/visDownload.html",
    "<div class=\"vis-download\">\n" +
    "    <a href ng-click=\"download()\" title=\"Download\"><i class=\"fa fa-download\"></i></a>\n" +
    "    <canvas id=\"visDownloadCanvas\" style=\"display: none;\"></canvas>\n" +
    "    <a id=\"vis-download-link\" style=\"display: none;\">download</a>\n" +
    "</div>");
}]);

angular.module('npn-viz-tool.vis-scatter',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.settings',
    'ui.bootstrap'
])
.controller('ScatterVisCtrl',['$scope','$uibModalInstance','$http','$timeout','$filter','$log','FilterService','ChartService','SettingsService',
    function($scope,$uibModalInstance,$http,$timeout,$filter,$log,FilterService,ChartService,SettingsService){
    $scope.modal = $uibModalInstance;
    var colorScale = FilterService.getColorScale();
    $scope.colors = colorScale.domain();
    $scope.colorRange = colorScale.range();

    $scope.axis = [
        {key: 'latitude', label: 'Latitude', axisFmt: d3.format('.2f')},
        {key: 'longitude', label: 'Longitude', axisFmt: d3.format('.2f')},
        {key:'elevation_in_meters',label:'Elevation (m)'},
        {key:'fyy', label: 'Year'},

        {key:'prcp_fall',label:'Precip Fall (mm)'},
        {key:'prcp_spring',label:'Precip Spring (mm)'},
        {key:'prcp_summer',label:'Precip Summer (mm)'},
        {key:'prcp_winter',label:'Precip Winter (mm)'},

        {key:'tmax_fall',label:'Tmax Fall (C\xB0)'},
        {key:'tmax_spring',label:'Tmax Spring (C\xB0)'},
        {key:'tmax_summer',label:'Tmax Summer (C\xB0)'},
        {key:'tmax_winter',label:'Tmax Winter (C\xB0)'},

        {key:'tmin_fall',label:'Tmin Fall (C\xB0)'},
        {key:'tmin_spring',label:'Tmin Spring (C\xB0)'},
        {key:'tmin_summer',label:'Tmin Summer (C\xB0)'},
        {key:'tmin_winter',label:'Tmin Winter (C\xB0)'},

        {key:'daylength',label:'Day Length (s)'},
        {key:'acc_prcp',label:'Accumulated Precip (mm)'},
        {key:'gdd',label:'AGDD'}
        ];

    var defaultAxisFmt = d3.format('d');
    function formatXTickLabels(i) {
        return ($scope.selection.axis.axisFmt||defaultAxisFmt)(i);
    }

    $scope.selection = {
        color: 0,
        axis: $scope.axis[0],
        regressionLines: false,
        useIndividualPhenometrics: false
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

    $scope.toPlot = [];
    FilterService.getFilter().getSpeciesList().then(function(list){
        $log.debug('speciesList',list);
        $scope.speciesList = list;
        if(list.length) {
            $scope.selection.species = list[0];
        }
    });
    $scope.$watch('selection.species',function(){
        $scope.phenophaseList = [];
        if($scope.selection.species) {
            FilterService.getFilter().getPhenophasesForSpecies($scope.selection.species.species_id).then(function(list){
                $log.debug('phenophaseList',list);
                $scope.phenophaseList = list;
                if(list.length) {
                    $scope.selection.phenophase = list[0];
                }
            });
        }
    });
    function advanceColor() {
        if($scope.selection.color < $scope.colors.length) {
            $scope.selection.color++;
        } else {
            $scope.selection.color = 0;
        }
    }
    function getNewToPlot() {
        return angular.extend({},$scope.selection.species,$scope.selection.phenophase,{color: $scope.selection.color});
    }
    $scope.canAddToPlot = function() {
        if($scope.toPlot.length === 3 || !$scope.selection.species || !$scope.selection.phenophase) {
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
    function clearData() {
        $scope.data = data = undefined;
        angular.forEach(chartServiceHandlers,function(handler) {
            delete handler.data;
        });
    }
    $scope.addToPlot = function() {
        if($scope.canAddToPlot()) {
            $scope.toPlot.push(getNewToPlot());
            advanceColor();
            clearData();
        }
    };
    $scope.removeFromPlot = function(idx) {
        $scope.toPlot.splice(idx,1);
        clearData();
    };

    var data, // the data from the server....
        chartServiceFunction = 'getSiteLevelData',
        chartServiceHandlers = {
            getSiteLevelData: {
                dataFunc: function(d) { return d.mean_first_yes_doy; },
                firstYesYearFunc: function(d) { return d.mean_first_yes_year; }
            },
            getSummarizedData: {
                dataFunc: function(d) { return d.first_yes_doy; },
                firstYesYearFunc: function(d) { return d.first_yes_year; }
            }
        },
        dateArg = FilterService.getFilter().getDateArg(),
        start_year = dateArg.arg.start_date,
        start_date = new Date(start_year,0),
        end_year = dateArg.arg.end_date,
        sizing = ChartService.getSizeInfo({top: 80,left: 60}),
        chart,
        x = d3.scale.linear().range([0,sizing.width]).domain([0,100]), // bogus domain initially
        xAxis = d3.svg.axis().scale(x).orient('bottom').tickFormat(formatXTickLabels),
        y = d3.scale.linear().range([sizing.height,0]).domain([1,365]),
        d3_date_fmt = d3.time.format('%x'),
        local_date_fmt = function(d){
                var time = ((d-1)*ChartService.ONE_DAY_MILLIS)+start_date.getTime(),
                    date = new Date(time);
                return d3_date_fmt(date);
            },
        yAxis = d3.svg.axis().scale(y).orient('left');

    function commonChartUpdates() {
        var chart = d3.select('.chart');

        chart.selectAll('.axis path')
            .style('fill','none')
            .style('stroke','#000')
            .style('shape-rendering','crispEdges');
        chart.selectAll('.axis line')
            .style('fill','none')
            .style('stroke','#000')
            .style('shape-rendering','crispEdges');

        chart.selectAll('text')
            .style('font-family','Arial');

        chart.selectAll('.legend rect')
            .style('fill','white')
            .style('stroke','black')
            .style('opacity','0.8');

        var fontSize = '14px';

        chart.selectAll('.legend text')
             .style('font-size', fontSize)
             .attr('y',function(d,i){
                return (i*12) + i;
             });

        chart.selectAll('g .x.axis text')
            .style('font-size', fontSize);

        chart.selectAll('g .y.axis text')
            .style('font-size', fontSize);

        // em doesn't work when saving as an image
        var dyBase = -5,
            dyIncr = 14;
        chart.selectAll('.legend circle')
            .attr('r','5')
            .attr('cx','5')
            .attr('cy',function(d,i) {
                return dyBase + (i*dyIncr);
            });
    }

    // can't initialize the chart until the dialog is rendered so postpone its initialization a short time.
    $timeout(function(){
        var svg = d3.select('.chart')
            .attr('width', sizing.width + sizing.margin.left + sizing.margin.right)
            .attr('height', sizing.height + sizing.margin.top + sizing.margin.bottom);
        svg.append('g').append('rect').attr('width','100%').attr('height','100%').attr('fill','#fff');
        chart = svg.append('g')
            .attr('transform', 'translate(' + sizing.margin.left + ',' + sizing.margin.top + ')');

        var dateArg = FilterService.getFilter().getDateArg();
          chart.append('g')
               .attr('class','chart-title')
               .append('text')
               .attr('y', '0')
               .attr('dy','-3em')
               .attr('x', (sizing.width/2))
               .style('text-anchor','middle')
               .style('font-size','18px')
               .text(dateArg.getStartYear()+' - '+dateArg.getEndYear());
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
            .attr('dy','-3em')
            .attr('x',-1*(sizing.height/2)) // looks odd but to move in the Y we need to change X because of transform
            .style('text-anchor', 'middle')
            .text('Onset DOY');

		  svg.append('g').append('text').attr('dx',5)
			   .attr('dy',sizing.height + 136)
			   .attr('font-size', '11px')
			   .attr('font-style','italic')
			   .attr('text-anchor','right').text('USA National Phenology Network, www.usanpn.org');

        commonChartUpdates();

    },500);

    function draw() {
        if(!data) {
            return;
        }
        $scope.working = true;
        // update the x-axis
        var padding = 1,
            nonNullData = data.filter(function(d){
                return d[$scope.selection.axis.key] != -9999;
            });
        function xData(d) { return d[$scope.selection.axis.key]; }
        x.domain([d3.min(nonNullData,xData)-padding,d3.max(nonNullData,xData)+padding]);
        xAxis.scale(x).tickFormat(d3.format('.2f')); // TODO per-selection tick formatting
        var xA = chart.selectAll('g .x.axis');
        xA.call(xAxis.tickFormat(formatXTickLabels));
        xA.selectAll('.axis-label').remove();
        xA.append('text')
          .attr('class','axis-label')
          .attr('x',(sizing.width/2))
          .attr('dy', '3em')
          .style('text-anchor', 'middle')
          .style('font-size', '12px')
          .text($scope.selection.axis.label);

        // update the chart data (TODO transitions??)
        var circles = chart.selectAll('.circle').data(nonNullData,function(d) { return d.id; });
        circles.exit().remove();
        circles.enter().append('circle')
          .attr('class', 'circle')
          .style('stroke','#333')
          .style('stroke-width','1');

        var dataFunc = chartServiceHandlers[chartServiceFunction].dataFunc;
        circles.attr('cx', function(d) { return x(d[$scope.selection.axis.key]); })
          .attr('cy', function(d) { return y(dataFunc(d)); })
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
            var color = $scope.colorRange[pair.color],
                seriesData = nonNullData.filter(function(d) { return d.color === color; });
            if(seriesData.length > 0) {
                var datas = seriesData.sort(function(o1,o2){ // sorting isn't necessary but makes it easy to pick min/max x
                        return o1[$scope.selection.axis.key] - o2[$scope.selection.axis.key];
                    }),
                    xSeries = datas.map(function(d) { return d[$scope.selection.axis.key]; }).filter(angular.isNumber),
                    ySeries = datas.map(dataFunc).filter(angular.isNumber),
                    leastSquaresCoeff = ChartService.leastSquares(xSeries,ySeries),
                    x1 = xSeries[0],
                    y1 = ChartService.approxY(leastSquaresCoeff,x1),
                    x2 = xSeries[xSeries.length-1],
                    y2 = ChartService.approxY(leastSquaresCoeff,x2);
                regressionLines.push({
                    id: pair.species_id+'.'+pair.phenophase_id,
                    legend: $filter('speciesTitle')(pair)+'/'+pair.phenophase_name+
                            (($scope.selection.regressionLines && !isNaN(leastSquaresCoeff[2])) ? ' (R^2 = '+float_fmt(leastSquaresCoeff[2])+')' : ''),
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
          .style('font-size','1em')
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
        commonChartUpdates();
        $scope.working = false;
    }

    function visFunc(chartFunction){
        return function(){
            chartServiceFunction = chartFunction;
            data = chartServiceHandlers[chartServiceFunction].data;
            if(data) {
                return draw();
            }
            var dataFunc = chartServiceHandlers[chartServiceFunction].dataFunc,
                firstYesYearFunc = chartServiceHandlers[chartServiceFunction].firstYesYearFunc;
            $scope.working = true;
            $log.debug('visualize',$scope.selection.axis,$scope.toPlot);
            var dateArg = FilterService.getFilter().getDateArg(),
                params = {
                    climate_data: 1,
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
            function processResponse(response,filteredLqd){
                $scope.data = data = response.filter(function(d,i) {
                    var keep = true;
                    d.color = $scope.colorRange[colorMap[d.species_id+'.'+d.phenophase_id]];
                    if(d.color) {
                        d.id = i;
                        // store the "first yes year" in a common place to use
                        d.fyy = firstYesYearFunc(d);
                        // this is the day # that will get plotted 1 being the first day of the start_year
                        // 366 being the first day of start_year+1, etc.
                        d.day_in_range = ((d.fyy-start_year)*365)+dataFunc(d);
                    } else {
                        // this can happen if a phenophase id spans two species but is only plotted for one
                        // e.g. boxelder/breaking leaf buds, boxelder/unfolding leaves, red maple/breaking leaf buds
                        // the service will return data for 'red maple/unfolding leaves' but the user hasn't requested
                        // that be plotted so we need to discard this data.
                        keep = false;
                    }
                    return keep;
                });
                $scope.data = chartServiceHandlers[chartServiceFunction].data = data;
                $scope.filteredDisclaimer = filteredLqd;
                $log.debug('scatterPlot data',data);
                draw();
            }
            ChartService[chartFunction](params,processResponse);
        };
    }
    var visualizeSiteLevelData = visFunc('getSiteLevelData'),
        visualizeSummarizedData = visFunc('getSummarizedData');
    $scope.$watch('selection.useIndividualPhenometrics',function(summary){
        delete $scope.data;
        $scope.visualize = summary ? visualizeSummarizedData : visualizeSiteLevelData;
    });
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
                label: 'Record Count'
            },{
                value: 'station-count',
                q: 'sc',
                label: 'Site Count'
            }/*,{
                value: 'station-observation-count',
                q: 'soc',
                label: 'Station Count/Record Count'
            }*/]
        },
        filterLqdSummary: {
            name: 'filter-lqd-summary',
            q: 'flqdf',
            value: true
        },
        onlyYesData: {
            name: 'only-yes-data',
            q: 'oyd',
            value: false
        },
        dataPrecisionFilter: {
            name: 'filter-data-precision',
            q: 'fdp',
            value: 30,
            options: [7,14,30]
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
    'npn-viz-tool.gridded',
    'npn-viz-tool.settings',
    'uiGmapgoogle-maps'
])
/**
 * Important one and only one instance of this directive should ever be in use in the application
 * because upon instantiation it examines the current URL query args and uses its contents to
 * populate the filter, etc.
 */
.directive('shareControl',['uiGmapIsReady','FilterService','LayerService','DateFilterArg','SpeciesFilterArg','NetworkFilterArg','GeoFilterArg','BoundsFilterArg','$location','$log','SettingsService','GriddedControlService',
    function(uiGmapIsReady,FilterService,LayerService,DateFilterArg,SpeciesFilterArg,NetworkFilterArg,GeoFilterArg,BoundsFilterArg,$location,$log,SettingsService,GriddedControlService){
    return {
        restrict: 'E',
        template: '<a title="Share" href id="share-control" class="btn btn-default btn-xs" ng-disabled="!getFilter().hasSufficientCriteria() && !gridSelected()" ng-click="share()"><i class="fa fa-share"></i></a><div ng-show="url" id="share-content"><input type="text" class="form-control" ng-model="url" ng-blur="url = null" onClick="this.setSelectionRange(0, this.value.length)"/></div>',
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
			
			$scope.gridSelected = function() {
                return GriddedControlService.layer;
            };

            $scope.getFilter = FilterService.getFilter;
            $scope.share = function() {

                if($scope.url) {
                    $scope.url = null;
                    return;
                }

				var params = {},
					absUrl = $location.absUrl(),
					q = absUrl.indexOf('?');				
				if(!FilterService.isFilterEmpty()){
					
					var filter = FilterService.getFilter();
					
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
				}

                GriddedControlService.addSharingUrlArgs(params);

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
    'npn-viz-tool.vis-cache',
    'npn-viz-tool.cluster',
    'npn-viz-tool.settings',
    'npn-viz-tool.layers',
    'npn-viz-tool.vis'
])
.factory('StationService',['$rootScope','$http','$log','$url','FilterService','ChartService',function($rootScope,$http,$log,$url,FilterService,ChartService){
    var infoWindow,
        markerEvents = {
        'click':function(m){
            $log.debug('click',m);
            if(infoWindow) {
                infoWindow.close();
                infoWindow = undefined;
            }
            //m.info = new google.maps.InfoWindow();
            //m.info.setContent('<div class="station-details"><i class="fa fa-circle-o-notch fa-spin"></i></div>');
            //m.info.open(m.map,m);
            $log.debug('Fetching info for station '+m.model.station_id);
            $http.get($url('/npn_portal/stations/getStationDetails.json'),{params:{ids: m.model.station_id}}).success(function(info){
                function litem(label,value) {
                    return value && value !== '' ?
                     '<li><label>'+label+':</label> '+value+'</li>' : '';
                }
                if(info && info.length === 1) {
                    var i = info[0],
                        html = '<div class="station-details">';
                    $log.debug(i);
                    //html += '<h5>'+i.site_name+'</h5>';
                    html += '<ul class="list-unstyled">';
                    html += litem('Site Name',i.site_name);
                    html += litem('Group',i.group_name);
                    if(m.model.observationCount) {
                        html += litem('Records',m.model.observationCount);
                    } else {
                        html += litem('Individuals',i.num_individuals);
                        html += litem('Records',i.num_records);
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
                    var details = $.parseHTML(html)[0];
                    if(!FilterService.isFilterEmpty()) {
                        var visualizations = ChartService.getVisualizations();
                        html = '<div>';
                        html += '<label>Visualize Site Data</label>';
                        html += '<ul class="list-unstyled">';
                        ChartService.getVisualizations().forEach(function(vis){
                            if(typeof(vis.singleStation) === 'undefined' || vis.singleStation) {
                                html += '<li>';
                                html += '<a id="'+vis.controller+'" href="#">'+vis.title+'</a>';
                                html += '</li>';
                            }
                        });
                        html += '</ul></div>';
                        var visLinks = $.parseHTML(html)[0];
                        $(details).append(visLinks);
                        ChartService.getVisualizations().forEach(function(vis){
                            var link = $(details).find('#'+vis.controller);
                            link.click(function(){
                                $rootScope.$apply(function(){
                                    ChartService.openSingleStationVisualization(m.model.station_id,vis);
                                });
                            });
                        });
                    }

                    infoWindow = new google.maps.InfoWindow({
                        maxWidth: 500,
                        content: details
                    });
                    infoWindow.open(m.map,m);
                }
            });
        }
    },
    service = {
        getMarkerEvents: function() { return markerEvents; }
    };
    return service;
}])
.directive('npnStations',['$http','$log','$timeout','$url','LayerService','SettingsService','StationService','ClusterService','CacheService',
    function($http,$log,$timeout,$url,LayerService,SettingsService,StationService,ClusterService,CacheService){
    return {
        restrict: 'E',
        template: '<ui-gmap-markers models="regions.markers" idKey="\'name\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" isLabel="true"></ui-gmap-markers><ui-gmap-markers models="stations.markers" idKey="\'station_id\'" coords="\'self\'" icon="\'icon\'" options="\'markerOpts\'" doCluster="doCluster" events="markerEvents" clusterOptions="clusterOptions"></ui-gmap-markers>',
        scope: {
        },
        controller: ['$scope',function($scope) {
            $scope.doCluster = SettingsService.getSettingValue('clusterMarkers');
            $scope.$on('setting-update-clusterMarkers',function(event,data){
                $scope.doCluster = data.value;
            });
            var clusterOptions = ClusterService.getDefaultClusterOptions();
            $scope.clusterOptions = angular.extend(clusterOptions,{
                calculator: function(markers,styleCount) {
                    var r = {
                        text: markers.length,
                        index:1
                    };
                    for(var i = 0; i <clusterOptions.styles.length;i++) {
                        if(markers.length >= clusterOptions.styles[i].n) {
                            r.index = (i+1);
                        }
                    }
                    return r;
                }
            });
            $scope.regions = {
                markers: []
            };
            $scope.stations = {
                states: [],
                markers: []
            };
            $scope.markerEvents = StationService.getMarkerEvents();
            var eventListeners = [],
                stationCounts = CacheService.get('stations-counts-by-state');
            if(stationCounts) {
                handleCounts(stationCounts);
            } else {
                $http.get($url('/npn_portal/stations/getStationCountByState.json')).success(function(counts){
                    CacheService.put('stations-counts-by-state',counts);
                    handleCounts(counts);
                });
            }
            function handleCounts(counts){
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
                                        title: name + ' ('+count.number_stations+' Sites)',
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
                                // remove the station count marker, splice doesn't work here.
                                $scope.regions.markers = $scope.regions.markers.filter(function(m){
                                    return m.name !== state;
                                });
                                $scope.stations.states.push(state);
                                $timeout(function(){
                                    // simply drop the feature as opposed to re-styling it
                                    map.data.remove(event.feature);
                                    map.panTo(event.latLng);
                                    var waitTime = 0;
                                    if(map.getZoom() != 6) {
                                        map.setZoom(6);
                                        waitTime = 500; // give more time for map tiles to load
                                    }
                                    $timeout(function(){
                                        $http.get($url('/npn_portal/stations/getAllStations.json'),
                                                    {params:{state_code:state}})
                                            .success(function(data){
                                                data.forEach(function(d){
                                                    d.markerOpts = {
                                                        title: d.station_name,
                                                        icon: {
                                                            path: google.maps.SymbolPath.CIRCLE,
                                                            fillColor: '#e6550d',
                                                            fillOpacity: 1.0,
                                                            scale: 8,
                                                            strokeColor: '#204d74',
                                                            strokeWeight: 1
                                                        }
                                                    };
                                                });
                                                var newMarkers = $scope.stations.markers.concat(data),
                                                    n = (newMarkers.length > 512 ? Math.round(newMarkers.length/2) : 512),i;
                                                for(i = clusterOptions.styles.length-1; i >= 0; i--) {
                                                    clusterOptions.styles[i].n = n;
                                                    n = Math.round(n/2);
                                                }
                                                $scope.stations.markers = newMarkers;
                                            });
                                    },waitTime);
                                },500);
                            }
                        }));
                    });
                });
            }
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

angular.module('npn-viz-tool.vis-time',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.settings',
    'ui.bootstrap'
])
.controller('TimeSeriesVisCtrl',['$scope','$uibModalInstance','$log','$filter','$http','$url','$q','$timeout','layer','legend','latLng','ChartService',
function($scope,$uibModalInstance,$log,$filter,$http,$url,$q,$timeout,layer,legend,latLng,ChartService){
    // DEVELOPMENT - for development hard-coding lat/lng so that the proxy server can cache
    // the results and avoid waiting repeatedly for the web service to respond (8-10 seconds per)..
    /*latLng = {
        // somewhere in AZ
        lat: function() { return 32.84267363195431; },
        lng: function() { return -112.412109375; }
    };*/

    $scope.layer = layer;
    $scope.legend = legend;
    $scope.modal = $uibModalInstance;
    $scope.latLng = latLng;

    var degF = 'F',//'\u00B0F',//'°F',
        dateFmt = 'yyyy-MM-dd',
        date = $filter('date'),
        number = $filter('number'),
        this_year = (new Date()).getFullYear(),
        extent_year = layer.extent.current && layer.extent.current.date ? layer.extent.current.date.getFullYear() : this_year,
        start = (function(){
            var d = new Date();
            d.setFullYear(extent_year);
            d.setMonth(0);
            d.setDate(1);
            return d;
        })(),
        forecast = extent_year === this_year,
        end = (function(){
            var d = forecast ?
                // use the latest date the layer supports
                new Date(layer.extent.values[layer.extent.values.length-1].date.getTime()) :
                new Date();
            if(!forecast) {
                // if this year end today (no more data)
                // if previous year then get the full year's data
                d.setFullYear(extent_year);
                d.setMonth(11);
                d.setDate(31);
            }
            return d;
        })(),
        avg_params = {
            latitude: latLng.lat(),
            longitude: latLng.lng()
        },
        params = {
            layer : layer.name,
            start_date: date(start,dateFmt),
            end_date: date(end,dateFmt),
            latitude: latLng.lat(),
            longitude: latLng.lng()
        };
    avg_params.layer = (params.layer === 'gdd:agdd') ? 'gdd:30yr_avg_agdd' : 'gdd:30yr_avg_agdd_50f';
    var base_temp = (params.layer === 'gdd:agdd') ? 32 : 50;

    $log.debug('TimeSeries.avg_params',avg_params);
    $log.debug('TimeSeries.params',params);

    var sizing = ChartService.getSizeInfo({top: 80,left: 80}),
        chart,thresholdLine,
        d3_date_fmt = d3.time.format('%m/%d'),
        date_fmt = function(d){
            var time = ((d-1)*ChartService.ONE_DAY_MILLIS)+start.getTime(),
                date = new Date(time);
            return d3_date_fmt(date);
        },
        x = d3.scale.linear().range([0,sizing.width]).domain([1,365]),
        xAxis = d3.svg.axis().scale(x).orient('bottom').tickFormat(date_fmt),
        yMax = 20000, // the max possible, initially
        y = d3.scale.linear().range([sizing.height,0]).domain([0,yMax]),
        yAxis = d3.svg.axis().scale(y).orient('left'),
        dataFunc = function(d) { return d.point_value; },
        idFunc = function(d) { return d.doy; }, // id is the doy which is the index.
        line = d3.svg.line() // TODO remove if decide to not use
            .x(function(d,i){ return x(d.doy); })
            .y(function(d,i){ return y(d.point_value); }).interpolate('basis'),
        data = {}; // keys: selected,average[,previous];

    function addData(key,obj) {
        data[key] = obj;
        data[key].doyMap = data[key].data.reduce(function(map,d){
            map[idFunc(d)] = dataFunc(d);
            return map;
        },{});
    }

    $scope.selection = {
        lastYearValid: extent_year > 2016, // time series data starts in 2016
        showLastYear: false,
        threshold: {
            value: 1000,
            options: {
                floor: 0,
                ceil: yMax,
                step: 10,
                translate: function(n) {
                    return number(n,0)+degF;
                }
            }
        },
        doys: {
            value: 365,
            options: {
                floor: 1,
                ceil: 365,
                step: 1,
                translate: function(n) {
                    return date_fmt(n)+' ('+n+')';
                }
            }
        }
    };

    function commonChartUpdates() {
        chart.selectAll('.axis path')
            .style('fill','none')
            .style('stroke','#000')
            .style('shape-rendering','crispEdges');
        chart.selectAll('.axis line')
            .style('fill','none')
            .style('stroke','#000')
            .style('shape-rendering','crispEdges');

        chart.selectAll('text')
            .style('font-family','Arial');

        var fontSize = '14px';

        chart.selectAll('g .x.axis text')
            .style('font-size', fontSize);

        chart.selectAll('g .y.axis text')
            .style('font-size', fontSize);
    }

    function updateLegend() {
        chart.select('.legend').remove();
        var legend = chart.append('g')
              .attr('class','legend')
              .attr('transform','translate(30,-45)') // relative to the chart, not the svg
              .style('font-size','1em'),
            rect = legend.append('rect')
                .style('fill','white')
                .style('stroke','black')
                .style('opacity','0.8')
                .attr('width',100)
                .attr('height',55),
            fontSize = 12,
            r = 5,
            vpad = 4,
            keys = ['average','selected','forecast','previous'], //Object.keys(data), hard coding to control order
            plotCnt = keys.reduce(function(cnt,key,i) {
                var row;
                if(data[key] && data[key].plotted && (data[key].filtered||data[key].data).length) {
                    row = legend.append('g')
                        .attr('class','legend-item '+key)
                        .attr('transform','translate(10,'+(((cnt+1)*fontSize)+(cnt*vpad))+')');
                    row.append('circle')
                        .attr('r',r)
                        .attr('fill',data[key].color);
                    row.append('text')
                        .style('font-size', '12px')
                        .attr('x',(2*r))
                        .attr('y',(r/2))
                        .text(data[key].year||'Average');
                    cnt++;
                }
                return cnt;
            },0);
            if(plotCnt < 3) {
                rect.attr('height',40);
            } else if (plotCnt > 3) {
                rect.attr('height',70);
            }
    }

    function removeLine(key) {
        if(data[key]) {
            chart.selectAll('path.gdd.'+key).remove();
            delete data[key].plotted;
            updateLegend();
        }
    }

    function addLine(key) {
        if(data[key]) {
            chart.append('path')
                .attr('class','gdd '+key)
                .attr('fill','none')
                .attr('stroke',data[key].color)
                .attr('stroke-linejoin','round')
                .attr('stroke-linecap','round')
                .attr('stroke-width',1.5)
                .attr('d',line(data[key].filtered||data[key].data));
            data[key].plotted = true;
            updateLegend();
        }
    }
    function updateThreshold() {
        var yCoord = y($scope.selection.threshold.value);
        thresholdLine.attr('y1',yCoord).attr('y2',yCoord);
    }

    function updateAxes() {
        var lineKeys = Object.keys(data),maxes;
        if(lineKeys.length) {
            // calculate/re-calculate the y-axis domain so that the data fits nicely
            maxes = lineKeys.reduce(function(arr,key){
                arr.push(d3.max((data[key].filtered||data[key].data),dataFunc));
                return arr;
            },[]);
            $scope.selection.threshold.options.ceil = Math.round(yMax = d3.max(maxes));
            if($scope.selection.threshold.value > $scope.selection.threshold.options.ceil) {
                $scope.selection.threshold.value = $scope.selection.threshold.options.ceil;
            }
            yMax = yMax*1.05;
            yAxis.scale(y.domain([0,yMax]));
            updateThreshold();
            // updathe x-axis as necessary
            xAxis.scale(x.domain([1,$scope.selection.doys.value]));
            // if this happens we need to re-draw all lines that have been plotted
            // because the domain of our axis just changed
            lineKeys.forEach(function(key) {
                if(data[key].plotted) {
                    removeLine(key);
                    addLine(key);
                }
            });

        }

        chart.selectAll('g .axis').remove();
        chart.append('g')
            .attr('class', 'y axis')
            .call(yAxis)
            .append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', '0')
            .attr('dy','-4em')
            .attr('x',-1*(sizing.height/2)) // looks odd but to move in the Y we need to change X because of transform
            .style('text-anchor', 'middle')
            .text('AGDD');

        chart.append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate(0,' + sizing.height + ')')
            .call(xAxis)
            .append('text')
            .attr('y','0')
            .attr('dy','3em')
            .attr('x',(sizing.width/2))
            .style('text-anchor', 'middle')
            .text('DOY');
        commonChartUpdates();
    }

    // this initializes the empty visualization and gets the ball rolling
    // it is within a timeout so that the HTML gets rendered and we can grab
    // the nested chart element (o/w it doesn't exist yet).
    $timeout(function(){
        $scope.$broadcast('rzSliderForceRender');
        var svg = d3.select('.chart')
            .attr('width', sizing.width + sizing.margin.left + sizing.margin.right)
            .attr('height', sizing.height + sizing.margin.top + sizing.margin.bottom);
        svg.append('g').append('rect').attr('width','100%').attr('height','100%').attr('fill','#fff');
        chart = svg.append('g')
            .attr('transform', 'translate(' + sizing.margin.left + ',' + sizing.margin.top + ')');

        chart.append('g')
             .attr('class','chart-title')
             .append('text')
             .attr('y', '0')
             .attr('dy','-3em')
             .attr('x', (sizing.width/2))
             .style('text-anchor','middle')
             .style('font-size','18px')
             .text(start.getFullYear()+' AGDD Daily Trends for '+
                number(latLng.lat())+','+
                number(latLng.lng())+' '+base_temp+' Base Temp ('+degF+')');

        updateAxes();

        svg.append('g').append('text').attr('dx',5)
            .attr('dy',sizing.height + 136)
            .attr('font-size', '11px')
            .attr('font-style','italic')
            .attr('text-anchor','right').text('USA National Phenology Network, www.usanpn.org');

        thresholdLine = chart.append('line')
            .attr('class','threshold')
            .attr('fill','none')
            .attr('stroke','green')
            .attr('stroke-width',1)
            .attr('x1',x(1))
            .attr('y1',y(yMax))
            .attr('x2',x(365))
            .attr('y2',y(yMax));

        var hover = svg.append('g')
            .attr('transform', 'translate(' + sizing.margin.left + ',' + sizing.margin.top + ')')
            .style('display','none');
        var hoverLine = hover.append('line')
                .attr('class','focus')
                .attr('fill','none')
                .attr('stroke','green')
                .attr('stroke-width',1)
                .attr('x1',x(1))
                .attr('y1',y(0))
                .attr('x2',x(1))
                .attr('y2',y(yMax));
        var hoverInfoDy = '1.2em',
            hoverInfoX = 15,
            hoverInfo = hover.append('text')
                .attr('class','gdd-info')
                .attr('font-size',14)
                .attr('y',40),
            doyInfo = hoverInfo.append('tspan').attr('dy','1em').attr('x',hoverInfoX),
            doyLabel = doyInfo.append('tspan').attr('class','gdd-label').text('DOY: '),
            doyValue = doyInfo.append('tspan').attr('class','gdd-value'),
            infoKeys = ['average','previous','selected','forecast'],
            infos = infoKeys.reduce(function(map,key){
                map[key] = hoverInfo.append('tspan').attr('dy',hoverInfoDy).attr('x',hoverInfoX);
                return map;
            },{}),
            infoLabels = infoKeys.reduce(function(map,key){
                map[key] = infos[key].append('tspan').attr('class','gdd-label '+key);
                return map;
            },{}),
            infoValues = infoKeys.reduce(function(map,key){
                map[key] = infos[key].append('tspan').attr('class','gdd-value');
                return map;
            },{}),
            infoDiffs = ['previous','forecast','selected'].reduce(function(map,key){
                map[key] = infos[key].append('tspan').attr('class','gdd-diff');
                return map;
            },{});
        function focusOff() {
            hover.style('display','none');
        }
        function focusOn() {
            hover.style('display',null);
        }
        function updateFocus() {
            var coords = d3.mouse(this),
                xCoord = coords[0],
                yCoord = coords[1],
                doy = Math.round(x.invert(xCoord)),
                lineKeys = Object.keys(data),
                temps;
            hoverLine.attr('transform','translate('+xCoord+')');
            temps = lineKeys.reduce(function(map,key) {
                var temp;
                if(data[key].plotted) {
                    // get the value for doy
                    temp = data[key].doyMap[doy];
                    if(typeof(temp) !== 'undefined') {
                        map[key] = {
                            year: data[key].year,
                            gdd: temp
                        };
                        if(!data[key].focus) {
                            // create a focus ring for this line
                            data[key].focus = hover.append('circle')
                                .attr('r',4.5)
                                .attr('fill','none')
                                .attr('stroke','steelblue');
                        }
                        data[key].focus
                            .style('display',null)
                            .attr('transform','translate('+xCoord+','+y(temp)+')');
                    } else if (data[key].focus) {
                        // invalid doy, hide focus ring
                        data[key].focus.style('display','none');
                    }
                }
                return map;
            },{});
            $log.debug('temps for doy '+doy,temps);
            doyValue.text(doy+' ('+date_fmt(doy)+')');
            Object.keys(infos).forEach(function(key) {
                var temp,diff,avgDoy,diffDoy,text,i;
                if(temps[key]) {
                    infos[key].style('display',null);
                    infoLabels[key].text((temps[key].year||'Average')+': ');
                    temp = temps[key].gdd;
                    infoValues[key].text(number(temp,0)+degF);
                    if(infoDiffs[key]) {
                        diff = temp-temps.average.gdd;
                        text = ' ('+(diff > 0 ? '+' : '')+number(diff,0)+degF;
                        // on what day did the current temperature happen
                        for(i = 0; i < data.average.data.length; i++) {
                            if(dataFunc(data.average.data[i]) > temp) {
                                avgDoy = idFunc(data.average.data[i]);
                                break;
                            }
                        }
                        // this can happen when the year being compared
                        // is now hotter than the average has ever been
                        // i.e. late in the year
                        if(avgDoy > 0 && avgDoy < 366) {
                            diffDoy = (avgDoy-doy);
                            text +='/'+(diffDoy > 0 ?'+' : '')+diffDoy+' days';
                        }

                        text += ')';
                        infoDiffs[key]
                        .attr('class','gdd-diff '+(diff > 0 ? 'above' : 'below'))
                        .text(text);
                    }
                } else {
                    infos[key].style('display','none');
                }
            });

        }
        svg.append('rect')
            .attr('class','overlay')
            .attr('transform', 'translate(' + sizing.margin.left + ',' + sizing.margin.top + ')')
            .style('fill','none')
            .style('pointer-events','all')
            .attr('x',0)
            .attr('y',0)
            .attr('width',x(365))
            .attr('height',y(0))
            .on('mouseover',focusOn)
            .on('mouseout',focusOff)
            .on('mousemove',updateFocus);

        commonChartUpdates();
        visualize();
    });

    function doyTrim() {
        var value = $scope.selection.doys.value;
        if(value === 365) {
            Object.keys(data).forEach(function(key){
                delete data[key].filtered;
            });
        } else {
            Object.keys(data).forEach(function(key) {
                data[key].filtered = data[key].data.filter(function(d) {
                    return idFunc(d) <= value;
                });
            });
        }
        updateAxes();
    }
    var $doyTrimTimer;
    $scope.$watch('selection.doys.value',function(value,oldValue) {
        if(value !== oldValue) {
            if($doyTrimTimer) {
                $timeout.cancel($doyTrimTimer);
            }
            $doyTrimTimer = $timeout(doyTrim,500);
        }
    });

    // only setup a watch on selection.showLastYear if it can even happen
    if($scope.selection.lastYearValid) {
        $scope.$watch('selection.showLastYear',function(show) {
            if(show && (!data.previous)) {
                // no data for last year yet, go get it
                $scope.working = true;
                var lastStart = new Date(start.getTime()),
                    lastEnd = new Date(start.getTime()),
                    previous_params;
                lastStart.setFullYear(lastStart.getFullYear()-1);
                lastEnd.setFullYear(lastStart.getFullYear());
                lastEnd.setMonth(11);
                lastEnd.setDate(31);
                previous_params = angular.extend({},params,{start_date:date(lastStart,dateFmt),end_date:date(lastEnd,dateFmt)});
                $log.debug('previous_params',previous_params);
                $http.get($url('/npn_portal/stations/getTimeSeries.json'),{
                    params:previous_params
                }).then(function(response) {
                    addData('previous',{
                        year: lastStart.getFullYear(),
                        color: 'orange',
                        data: response.data
                    });
                    doyTrim();
                    updateAxes();
                    commonChartUpdates();
                    addLine('previous');
                    delete $scope.working;
                });
            } else if (data.previous) {
                // toggle the line
                if(show) {
                    addLine('previous');
                } else {
                    removeLine('previous');
                }
            }
        });
    }

    // this function, called from the $timeout above, gets the initial data
    // and draws the selected/average lines on the chart.
    function visualize() {
        // setup watch for slider
        $scope.$watch('selection.threshold.value',updateThreshold);
        $scope.working = true;
        $q.all({
            average: $http.get($url('/npn_portal/stations/getTimeSeries.json'),{
                params:avg_params
            }),
            selected: $http.get($url('/npn_portal/stations/getTimeSeries.json'),{
                params:params
            })
        }).then(function(results){
            if(forecast) {
                // need to separate out <=today and >today
                // this is kind of quick and dirty for doy
                var todayString = date(new Date(),'yyyy-MM-dd'),
                    processed = results.selected.data.reduce(function(map,d){
                        if(!map.forecast) {
                            map.selected.push(d);
                            if(d.date === todayString) {
                                // include the last day of the selected range
                                // on the forecast so the two connect on the graph
                                map.forecast = [d]; // forecast data starts here
                            }
                        } else {
                            map.forecast.push(d);
                        }
                        return map;
                    },{
                        selected: []
                    });
                addData('selected',{
                    year: start.getFullYear(),
                    color: 'black',
                    data: processed.selected
                });
                addData('forecast',{
                    year: start.getFullYear()+' forecast',
                    color: 'red',
                    data: processed.forecast
                });
            } else {
                addData('selected',{
                    year: start.getFullYear(),
                    color: 'black',
                    data: results.selected.data
                });
            }
            addData('average',{
                color: 'blue',
                data: results.average.data
            });
            $log.debug('draw',data);

            updateAxes();

            addLine('average');
            addLine('selected');
            if(forecast) {
                addLine('forecast');
            }
            commonChartUpdates();
            delete $scope.working;

        });
    }
}])
.provider('$timeSeriesVis',[function(){
    this.$get = ['ChartService',function(ChartService){
        return function(layer,legend,latLng) {
            ChartService.openVisualization({
                noFilterRequired: true,
                template: 'js/time/time.html',
                controller: 'TimeSeriesVisCtrl'
            },{
                layer: function() { return layer; },
                legend: function() { return legend; },
                latLng: function() { return latLng; }
            });
        };
    }];
}]);

angular.module('npn-viz-tool.toolbar',[
  'npn-viz-tool.help'
])
.directive('toolbar', ['$rootScope','$timeout','HelpService',function($rootScope,$timeout,HelpService) {
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
        if(t.selected) {
            // in case toolbars contain sliders force them to re-layout
            $timeout(function(){
                $rootScope.$broadcast('rzSliderForceRender');
            },500);
        }
      }
      $scope.select = function(t) {
        t.selected = !t.selected;
        $scope.open = t.selected;
        HelpService.stopLookingAtMe('#toolbar-icon-'+t.id); // mixing view/controller logic :-(
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

/**
 * @ngdoc overview
 * @name npn-viz-tool.vis
 * @description
 *
 * Module for generic visualization support, dialog framework, common services, etc.
 */
angular.module('npn-viz-tool.vis',[
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.vis-scatter',
    'npn-viz-tool.vis-calendar',
    'npn-viz-tool.vis-map',
    'npn-viz-tool.vis-time',
    'ui.bootstrap'
])
/**
 * @ngdoc service
 * @name npn-viz-tool.vis:ChartService
 * @module npn-viz-tool.vis
 * @description
 *
 * Handles data gathering in a generic fashion for visualizations that should share, rather than
 * duplicate such logic.
 */
.factory('ChartService',['$window','$http','$log','$uibModal','$url','FilterService','SettingsService',
    function($window,$http,$log,$uibModal,$url,FilterService,SettingsService){
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
        },
        VISUALIZATIONS = [{
            title: 'Scatter Plots',
            controller: 'ScatterVisCtrl',
            template: 'js/scatter/scatter.html',
            description: 'This visualization plots selected geographic or climactic variables against estimated onset dates for individuals for up to three species/phenophase pairs.'
        },{
            title: 'Calendars',
            controller: 'CalendarVisCtrl',
            template: 'js/calendar/calendar.html',
            description: 'This visualization illustrates annual timing of phenophase activity for selected species/phenophase pairs. Horizontal bars represent phenological activity at a site to regional level for up to two years.'
        },{
            title: 'Maps',
            controller: 'MapVisCtrl',
            template: 'js/mapvis/mapvis.html',
            description: 'This visualization maps ground-based observations against USA-NPN phenology maps, including Accumulated Growing Degree Days and Spring Index models.',
            singleStation: false // doesn't make sense for a single station visualization.
        }],
        visualizeSingleStationId;
    function filterSuspectSummaryData (d){
        var bad = (d.latitude === 0.0 || d.longitude === 0.0 || d.elevation_in_meters < 0);
        if(bad) {
            $log.warn('suspect station data',d);
        }
        return !bad;
    }
    function filterLqSummaryData (d) {
        var keep = d.numdays_since_prior_no >= 0;
        if(!keep) {
            $log.debug('filtering less precise data from summary output',d);
        }
        return keep;
    }
    function filterLqSiteData(d) {
        var keep = d.mean_numdays_since_prior_no >= 0;
        if(!keep) {
            $log.debug('filtering less precise data from site level output',d);
        }
        return keep;
    }
    function addCommonParams(params) {
        if(visualizeSingleStationId) {
            params['station_id[0]'] = visualizeSingleStationId;
        } else {
            var filter = FilterService.getFilter();
            // if geo filtering add the explicit station_ids in question.
            if(filter.getGeographicArgs().length) {
                FilterService.getFilteredMarkers().forEach(function(marker,i){
                    params['station_id['+i+']'] = marker.station_id;
                });
            }
            // if network filtering in play add network_id/s
            filter.getNetworkArgs().forEach(function(n,i){
                params['network['+i+']'] = n.getName();
				params['network_id['+i+']'] = n.getId();
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
    function setVisualizeSingleStationId(id) {
        visualizeSingleStationId = id;
    }
    var service = {
        /**
         * @ngdoc property
         * @propertyOf npn-viz-tool.vis:ChartService
         * @name ONE_DAY_MILLIS
         * @description constant for the number of milliseconds in a day.
         */
        ONE_DAY_MILLIS: (24*60*60*1000),
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name getSizeInfo
         * @description
         *
         * Get common info about how a chart should be sized with respect to actual
         * window size.
         *
         * <strong>Note:</strong> This method will result in information about how to
         * statically size an image within a visualization dialog.  However d3 can dynamically
         * deliver width/height information for an SVG if full height/width is desired.  E.g.
         * <pre>
         * var width = parseFloat(svg.style('width').replace('px','')),
         *     height = parseFloat(svg.style('height').replace('px',''));
         * </pre>
         *
         * @param {object} marginOverride Allows for overriding of defaults.
         */
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
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name leastSquares
         * @description
         *
         * Perform leastSquares regression mathematics for drawing regression lines.
         *
         * @param {Array} xSeries the x-series
         * @param {Array} ySeries the y-series
         */
        leastSquares: function(xSeries,ySeries) {
            if(xSeries.length === 0 || ySeries.length === 0) {
                return [Number.NaN,Number.NaN,Number.NaN];
            }
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
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name approxY
         * @description
         *
         * Generate an approximate value for y based on the least squares coefficient and a known x.
         *
         * @param {Array} leastSquaresCoeff the coefficient array.
         * @param {number} x The value for x.
         */
        approxY: function(leastSquaresCoeff,x) {
            // y = a + bx
            var a = leastSquaresCoeff[1],
                b = leastSquaresCoeff[0];
            return a + (b*x);
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name getSiteLevelData
         * @description
         *
         * Issue a request for site level data.  Common parameters will be implicitly added like
         * networks in the base filter or lists of sites if geographic filtering is enabled.
         *
         * @param {Object} params Parameters to send to the web service.
         * @param {function} success The success callback to receive the data.
         */
        getSiteLevelData: function(params,success) {
            params.num_days_quality_filter = SettingsService.getSettingValue('dataPrecisionFilter');
            $http({
                method: 'POST',
                url: $url('/npn_portal/observations/getSiteLevelData.json'),
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                transformRequest: txformUrlEncoded,
                data: addCommonParams(params)
            }).success(function(response){
                var minusSuspect = response.filter(filterSuspectSummaryData),
                    filtered = minusSuspect.filter(SettingsService.getSettingValue('filterLqdSummary') ? filterLqSiteData : angular.identity);
                $log.debug('filtered out '+(response.length-minusSuspect.length)+'/'+response.length+' suspect records');
                $log.debug('filtered out '+(minusSuspect.length-filtered.length)+'/'+minusSuspect.length+' LQD records.');
                success(filtered,(minusSuspect.length !== filtered.length));
            });
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name getSummarizedData
         * @description
         *
         * Issue a request for summarized data.  Common parameters will be implicitly added like
         * networks in the base filter or lists of sites if geographic filtering is enabled.
         *
         * @param {Object} params Parameters to send to the web service.
         * @param {function} success The success callback to receive the data, "suspect" and "imprecise" data (if told to do so) will be implicitly filtered from the result.
         */
        getSummarizedData: function(params,success) {
            $http({
                method: 'POST',
                url: $url('/npn_portal/observations/getSummarizedData.json'),
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                transformRequest: txformUrlEncoded,
                data: addCommonParams(params)
            }).success(function(response){
                var minusSuspect = response.filter(filterSuspectSummaryData),
                    filtered = minusSuspect.filter(SettingsService.getSettingValue('filterLqdSummary') ? filterLqSummaryData : angular.identity),
                    individuals = filtered.reduce(function(map,d){
                        var key = d.individual_id+'/'+d.phenophase_id+'/'+d.first_yes_year;
                        map[key] = map[key]||[];
                        map[key].push(d);
                        return map;
                    },{}),
                    uniqueIndividuals = [];
                $log.debug('filtered out '+(response.length-minusSuspect.length)+'/'+response.length+' suspect records');
                $log.debug('filtered out '+(minusSuspect.length-filtered.length)+'/'+minusSuspect.length+' LQD records.');
                angular.forEach(individuals,function(arr,key){
                    if(arr.length > 1) {
                        // sort by first_yes_doy
                        arr.sort(function(a,b){
                            return a.first_yes_doy - b.first_yes_doy;
                        });
                    }
                    // use the earliest record
                    uniqueIndividuals.push(arr[0]);
                });
                $log.debug('filtered out '+(filtered.length-uniqueIndividuals.length)+'/'+filtered.length+ ' individual records (preferring lowest first_yes_doy)');
                success(uniqueIndividuals,(minusSuspect.length !== filtered.length));
            });
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name getObservationDates
         * @description
         *
         * Issue a request for observation.  Common parameters will be implicitly added like
         * networks in the base filter or lists of sites if geographic filtering is enabled.
         *
         * @param {Object} params Parameters to send to the web service.
         * @param {function} success The success callback to receive the response data.
         */
        getObservationDates: function(params,success) {
            $http({
                method: 'POST',
                url: $url('/npn_portal/observations/getObservationDates.json'),
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                transformRequest: txformUrlEncoded,
                data: addCommonParams(params)
            }).success(success);
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name isFilterEmpty
         * @description
         *
         * Convenience shortcut to <code>FilterService.isFilterEmpty</code>.
         */
        isFilterEmpty: FilterService.isFilterEmpty,
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name getVisualizations
         * @description Get the coded list of visualization definitions.
         * @returns {Array} The visualization definitions for use by the UI control.
         */
        getVisualizations: function() {
            return VISUALIZATIONS;
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name openSingleStationVisualization
         * @description Open a visualization dialog focused on a single station.
         *
         * @param {string} station_id The station id.
         * @param {object} vis The visualization object.
         */
        openSingleStationVisualization: function(station_id,vis) {
            setVisualizeSingleStationId(station_id);
            var modal_instance = service.openVisualization(vis);
            if(modal_instance) {
                // when modal instance closes should unset single station id.
                modal_instance.result.then(setVisualizeSingleStationId,setVisualizeSingleStationId);
            } else {
                setVisualizeSingleStationId();
            }
        },
        /**
         * @ngdoc method
         * @methodOf npn-viz-tool.vis:ChartService
         * @name openVisualization
         * @description Open a visualization dialog.
         *
         * @param {object} vis The visualization object.
         * @param {object} resolve The resolve object used to populate the modal scope (if necessary).
         */
        openVisualization: function(vis,resolve) {
            if(vis.noFilterRequired || !FilterService.isFilterEmpty()) {
                var modalDef = {
                    templateUrl: vis.template,
                    controller: vis.controller,
                    windowClass: 'vis-dialog-window',
                    backdrop: 'static',
                    keyboard: false,
                    size: 'lg'
                };
                if(resolve) {
                    modalDef.resolve = resolve;
                }
                return $uibModal.open(modalDef);
            }
        }
    };
    return service;
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis:vis-dialog
 * @module npn-viz-tool.vis
 * @description A visualization dialog
 *
 * @param {string} title The title.
 * @param {object} modal The modal dialog.
 */
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
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis:vis-control
 * @module npn-viz-tool.vis
 * @description The visualization slide out control.
 */
.directive('visControl',['ChartService',function(ChartService){
    return {
        restrict: 'E',
        templateUrl: 'js/vis/visControl.html',
        scope: {
        },
        controller: function($scope) {
            $scope.isFilterEmpty = ChartService.isFilterEmpty;
            $scope.open = ChartService.openVisualization;
            $scope.visualizations = ChartService.getVisualizations();
        }
    };
}])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.vis:vis-download
 * @module npn-viz-tool.vis
 * @description Vis download.
 */
.directive('visDownload',[function(){
    return {
        restrict: 'E',
        templateUrl: 'js/vis/visDownload.html',
        scope: {
            selector: '@',
            filename: '@'
        },
        controller: ['$scope',function($scope){
            $scope.download = function() {
                var chart = d3.select($scope.selector),
                    html = chart.attr('version', 1.1)
                                .attr('xmlns', 'http://www.w3.org/2000/svg')
                                .node().parentNode.innerHTML,
                    imgsrc = 'data:image/svg+xml;base64,'+ window.btoa(html),
                    canvas = document.querySelector('#visDownloadCanvas');
                canvas.width = chart.attr('width');
                canvas.height = chart.attr('height');

                var context = canvas.getContext('2d'),
                    image = new Image();
                image.onload = function() {
                    context.drawImage(image,0,0);
                    var canvasdata = canvas.toDataURL('image/png'),
                        a = $('#vis-download-link')[0];//document.createElement('a');
                    a.download = $scope.filename||'visualization.png';
                    a.href = canvasdata;
                    a.click();
                };
                image.src = imgsrc;
            };
        }]
    };
}]);
