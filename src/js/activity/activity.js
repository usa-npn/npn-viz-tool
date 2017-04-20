angular.module('npn-viz-tool.vis-activity',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.settings',
    'ui.bootstrap'
])
.factory('ActivityCurveInput',['$filter','FilterService',function($filter,FilterService) {
    var DOY = $filter('doy'),
        COMMON_METRICS = [{
            id: 'num_yes_records',
            label: 'Total Yes Records'
        },{
            id: 'proportion_yes_records',
            label: 'Proportion Yes Records'
        }],
        KINGDOM_METRICS = {
            Plantae: COMMON_METRICS.concat([{
                id: 'numindividuals_with_yes_record',
                label: 'Total Individuals with Yes Records'
            },{
                id: 'proportion_individuals_with_yes_record',
                label: 'Proportion Individuals with Yes Records'
            }]),
            Animalia: COMMON_METRICS.concat([{
                id: 'numsites_with_yes_record',
                label: 'Total Sites with Yes Records'
            },{
                id: 'proportion_sites_with_yes_record',
                label: 'Proportion Sites with Yes Records'
            },{
                id: 'animal_TODO_3',
                label: 'Animals In-Phase/Hour'
            },{
                id: 'animal_TODO_4',
                label: 'Animals In-Phase/Hour/Acre'
            }])
        },
        ActivityCurveInput = function(id) {
            var self = this,
                _species,
                _phenophases,
                _metrics;
            self.id = id;
            Object.defineProperty(this,'validPhenophases',{
                get: function() { return _phenophases; }
            });
            Object.defineProperty(this,'validMetrics',{
                get: function() { return _metrics; }
            });
            Object.defineProperty(this,'species',{
                enumerable: true,
                get: function() { return _species; },
                set: function(s) {
                    _species = s;
                    _metrics = _species && _species.kingdom  ? (KINGDOM_METRICS[_species.kingdom]||[]) : [];
                    if(self.metric && _metrics.indexOf(self.metric) === -1) {
                        // previous metric has become invalid
                        delete self.metric;
                    }
                    if(_metrics.length && !self.metric) {
                        self.metric = _metrics[0];
                    }
                    if(_species) {
                        FilterService.getFilter().getPhenophasesForSpecies(_species.species_id).then(function(list){
                            _phenophases = list;
                            if(self.phenophase && _phenophases.indexOf(self.phenophase)) {
                                delete self.phenophase;
                            }
                            if(_phenophases.length && !self.phenophase) {
                                self.phenophase = _phenophases[0];
                            }
                        });
                    }
                }
            });
        };
    ActivityCurveInput.prototype.data = function(_) {
        if(arguments.length) {
            delete this.$data;
            if(_) {
                _.forEach(function(d) {
                    d.start_doy = DOY(d.start_date);
                    d.end_doy = DOY(d.end_date);
                });
                _.sort(function(a,b) {
                    return a.start_doy - b.start_doy;
                });
                this.$data = _;
            }
            return this;
        }
        return this.$data;
    };
    ActivityCurveInput.prototype.color = function(_) {
        if(arguments.length) {
            this.$color = _;
            return this;
        }
        return this.$color;
    };
    ActivityCurveInput.prototype.x = function(_) {
        if(arguments.length) {
            this.$$x = _;
            return this;
        }
        return this.$$x;
    };
    ActivityCurveInput.prototype.y = function(_) {
        if(arguments.length) {
            this.$$y = _;
            return this;
        }
        if(this.$$y) {
            this.$$y.domain(this.domain());
        }
        return this.$$y;
    };
    ActivityCurveInput.prototype.isValid = function() {
        return this.species && this.phenophase && this.year && this.metric;
    };
    ActivityCurveInput.prototype.domain = function() {
        var self = this;
        if(self.$data && self.metric) {
            return d3.extent(self.$data,function(d){
                return d[self.metric.id];
            });
        }
        return [0,100];
    };
    ActivityCurveInput.prototype.draw = function(chart) {
        var self = this,
            x,y,line;
        chart.selectAll('path.curve.curve-'+self.id).remove();
        if(self.$data) {
            x = self.x();
            y = self.y();
            line = d3.svg.line()
                .interpolate('basis')
                .x(function(d) { return x(d.start_doy); })
                .y(function(d) { return y(d[self.metric.id]); });
            chart.append('path')
                .attr('class','curve curve-'+self.id)
                .attr('fill','none')
                .attr('stroke',self.color())
                .attr('stroke-linejoin','round')
                .attr('stroke-linecap','round')
                .attr('stroke-width',1.5)
                .attr('d',line(self.$data));
        }
    };
    return ActivityCurveInput;
}])
.controller('ActivityCurvesVisCtrl',['$scope','$q','$uibModalInstance','$timeout','$log','$filter','ActivityCurveInput','FilterService','ChartService',

    function($scope,$q,$uibModalInstance,$timeout,$log,$filter,ActivityCurveInput,FilterService,ChartService){
    $scope.modal = $uibModalInstance;
    $scope.frequencies = [{
        value: 30,
        label: 'Monthly'
    },{
        value: 14,
        label: 'Bi-weekly'
    },{
        value: 7,
        label: 'Weekly'
    }];
    $scope.selection = {
        $updateCount: 0,
        curves: ['red','blue'].map(function(color,i){ return new ActivityCurveInput(i).color(color); }),
        frequency: $scope.frequencies[0],
        haveValidCurve: function() {
            return $scope.selection.curves.reduce(function(valid,c){
                return valid||(c.isValid() ? true : false);
            },false);
        }
    };
    $scope.visualize = function() {
        function endDate(year) {
            var now = new Date();
            if(year === now.getFullYear()) {
                return $filter('date')(now,'yyyy-MM-dd');
            }
            return year+'-12-31';
        }
        // one request per valid curve
        var promises = $scope.selection.curves.filter(function(c) {
                return c.data(null).isValid();
            }).map(function(c){
                var def = $q.defer(),
                    params = {
                        request_src: 'npn-vis-activity-curves',
                        start_date: c.year+'-01-01',
                        end_date: endDate(c.year),
                        frequency: $scope.selection.frequency.value,
                        'species_id[0]': c.species.species_id,
                        'phenophase_id[0]': c.phenophase.phenophase_id
                    };
                $log.debug('params',params);
                $scope.working = true;
                ChartService.getMagnitudeData(params,function(data){
                    def.resolve(c.data(data));
                });
                return def.promise;
            });
        $q.all(promises).then(function(){
            $log.debug('all activity data has arrived');
            $scope.selection.$updateCount++;
            delete $scope.working;
        });
    };
}])
.directive('activityCurveControl',['$log','FilterService',function($log,FilterService){
    return {
        restrict: 'E',
        templateUrl: 'js/activity/curve-control.html',
        scope: {
            input: '='
        },
        link: function($scope) {
            $scope.validYears = (function(current){
                var thisYear = (new Date()).getFullYear(),
                    years = [];
                while(current <= thisYear) {
                    years.push(current++);
                }
                return years;
            })(2010);
            $scope.input.year = $scope.validYears[$scope.validYears.length-2];
            FilterService.getFilter().getSpeciesList().then(function(list) {
                $log.debug('speciesList',list);
                $scope.speciesList = list;
                if(list.length) {
                    $scope.input.species = $scope.input.id < list.length ? list[$scope.input.id] : list[0];
                }
            });
        }
    };
}])
.directive('activityCurvesChart',['$log','$timeout','ChartService',function($log,$timeout,ChartService){
    function doyIntervalTick(interval) {
        var doy = 1,
            ticks = [];
        while(doy <= 365) {
            ticks.push(doy);
            doy += interval;
        }
        return ticks;
    }
    var X_TICK_VALUES = {
        7: doyIntervalTick(14), // 52 is too many tickes
        14: doyIntervalTick(14),
        30: [1,32,60,91,121,152,182,213,244,274,305,335]
    },
    ROOT_DATE = new Date(2010,0);
    return {
        restrict: 'E',
        replace: true,
        template: '<div class="chart-container">'+
        '<vis-download ng-if="data" selector=".chart" filename="npn-activity-curves.png"></vis-download>'+
        '<div><svg class="chart"></svg></div>'+
        '</div>',
        scope: {
            selection: '='
        },
        link: function($scope) {
            var selection = $scope.selection,
                chart,
                sizing = ChartService.getSizeInfo({top: 80,left: 80,right: 80}),
                d3_date_fmt = d3.time.format('%m/%d'),
                date_fmt = function(d){
                    var time = ((d-1)*ChartService.ONE_DAY_MILLIS)+ROOT_DATE.getTime(),
                        date = new Date(time);
                    return d3_date_fmt(date);
                },
                x = d3.scale.linear().range([0,sizing.width]).domain([1,365]),
                xAxis = d3.svg.axis().scale(x).orient('bottom')
                    .tickValues(X_TICK_VALUES[selection.frequency.value])
                    .tickFormat(date_fmt),
                ylAxis = d3.svg.axis().scale(selection.curves[0].y(d3.scale.linear().range([sizing.height,0])).y()).orient('left'),
                yrAxis = d3.svg.axis().scale(selection.curves[1].y(d3.scale.linear().range([sizing.height,0])).y()).orient('right');

            // pass along the x-axis
            selection.curves.forEach(function(c) { c.x(x); });

            function updateChart() {
                chart.selectAll('g .axis').remove();

                ylAxis.scale(selection.curves[0].y());
                chart.append('g')
                    .attr('class', 'y axis left')
                    .call(ylAxis)
                    .append('text')
                    .attr('transform', 'rotate(-90)')
                    .attr('y', '0')
                    .attr('dy','-4em')
                    .attr('x',-1*(sizing.height/2)) // looks odd but to move in the Y we need to change X because of transform
                    .style('text-anchor', 'middle')
                    .text(selection.curves[0].metric.label);

                if(selection.curves[0].metric.id !== selection.curves[1].metric.id) {
                    yrAxis.scale(selection.curves[1].y());
                    chart.append('g')
                        .attr('class', 'y axis right')
                        .attr('transform','translate('+sizing.width+')')
                        .call(yrAxis)
                        .append('text')
                        .attr('transform', 'rotate(-90)')
                        .attr('y', '0')
                        .attr('dy','4em')
                        .attr('x',-1*(sizing.height/2)) // looks odd but to move in the Y we need to change X because of transform
                        .style('text-anchor', 'middle')
                        .text(selection.curves[1].metric.label);
                }

                chart.append('g')
                    .attr('class', 'x axis')
                    .attr('transform', 'translate(0,' + sizing.height + ')')
                    .call(xAxis)
                    .append('text')
                    .attr('y','0')
                    .attr('dy','3em')
                    .attr('x',(sizing.width/2))
                    .style('text-anchor', 'middle')
                    .text('Date');


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

                selection.curves.forEach(function(c) {
                    c.draw(chart);
                });
            }

            $timeout(function(){
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
                     .text('Activity Curves');

                svg.append('g').append('text').attr('dx',5)
                    .attr('dy',sizing.height + 136)
                    .attr('font-size', '11px')
                    .attr('font-style','italic')
                    .attr('text-anchor','right').text('USA National Phenology Network, www.usanpn.org');

                updateChart();
            });

            $scope.$watch('selection.$updateCount',function(count){
                if(count > 0) {
                    updateChart();
                }
            });
        }
    };
}]);
