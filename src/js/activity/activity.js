angular.module('npn-viz-tool.vis-activity',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.settings',
    'ui.bootstrap'
])
.factory('ActivityCurve',['$log','$filter','FilterService',function($log,$filter,FilterService) {
    var DOY = $filter('doy'),
        SPECIES_TITLE = $filter('speciesTitle'),
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
                id: 'animals_in_phase',
                label: 'Animals In-Phase/Hour'
            },{
                id: 'animal_TODO_4',
                label: '(TODO) Animals In-Phase/Hour/Acre'
            }])
        },
        ActivityCurve = function(id) {
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
                    _phenophases = undefined;
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
    ActivityCurve.prototype.axisLabel = function() {
        return this.metric ? this.metric.label : '?';
    };
    ActivityCurve.prototype.legendLabel = function(includeMetric) {
        return this.year+': '+SPECIES_TITLE(this.species)+' - '+this.phenophase.phenophase_name+
            (includeMetric ? (' ('+this.metric.label+')') : '');
    };
    ActivityCurve.prototype.metricId = function() {
        return this.metric ? this.metric.id : undefined;
    };
    ActivityCurve.prototype.data = function(_) {
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
    ActivityCurve.prototype.color = function(_) {
        if(arguments.length) {
            this.$color = _;
            return this;
        }
        return this.$color;
    };
    ActivityCurve.prototype.axisOrient = function(_) {
        if(arguments.length) {
            this.$orient = _;
            return this;
        }
        return this.$orient;
    };
    ActivityCurve.prototype.axis = function() {
        if(!this.$axis) {
            this.$axis = d3.svg.axis();
        }
        this.$axis.scale(this.y());
        return this.$axis.orient(this.axisOrient()||'left');
    };
    ActivityCurve.prototype.x = function(_) {
        if(arguments.length) {
            this.$$x = _;
            return this;
        }
        return this.$$x;
    };
    ActivityCurve.prototype.y = function(_) {
        if(arguments.length) {
            this.$$y = _;
            return this;
        }
        return this.$$y;
    };
    ActivityCurve.prototype.isValid = function() {
        return this.species && this.phenophase && this.year && this.metric;
    };
    ActivityCurve.prototype.domain = function() {
        var self = this;
        if(self.$data && self.metric) {
            return d3.extent(self.$data,function(d){
                return d[self.metric.id];
            });
        }
    };
    ActivityCurve.prototype.draw = function(chart) {
        var self = this,
            x,y,data,line;
        chart.selectAll('path.curve.curve-'+self.id).remove();
        if(data = self.$data) {
            x = self.x();
            y = self.y();
            line = d3.svg.line()
                .interpolate(self.interpolate||'monotone')//'cardinal')
                .x(function(d,i) {
                    // TODO should each point be duplicated and plotted for both
                    // the start/end_doy or something like this?
                    if(i === 0) {
                        return x(d.start_doy);
                    }
                    if(i === (data.length-1)) {
                        return x(d.end_doy);
                    }
                    return x(d.start_doy+Math.round((d.end_doy-d.start_doy)/2));
                })
                .y(function(d) { return y(d[self.metric.id]); });
            $log.debug('ActivityCurve.draw',self.species,self.phenophase,self.year,self.metric,data,self.domain(),y.domain());
            chart.append('path')
                .attr('class','curve curve-'+self.id)
                .attr('fill','none')
                .attr('stroke',self.color())
                .attr('stroke-linejoin','round')
                .attr('stroke-linecap','round')
                .attr('stroke-width',1.5)
                .attr('d',line(data));
        }
    };
    return ActivityCurve;
}])
.controller('ActivityCurvesVisCtrl',['$scope','$q','$uibModalInstance','$timeout','$log','$filter','ActivityCurve','FilterService','ChartService',
    function($scope,$q,$uibModalInstance,$timeout,$log,$filter,ActivityCurve,FilterService,ChartService){
    $scope.modal = $uibModalInstance;
    $scope.frequencies = [{
        value: 'months',
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
        interpolate: 'monotone',
        curves: [{color:'#0000ff',orient:'left'},{color:'#ff0000',orient:'right'}].map(function(config,i){ return new ActivityCurve(i).color(config.color).axisOrient(config.orient); }),
        frequency: $scope.frequencies[0],
        haveValidCurve: function() {
            return $scope.selection.curves.reduce(function(valid,c){
                return valid||(c.isValid() ? true : false);
            },false);
        }
    };
    function updateChart() {
        if($scope.selection.$updateCount > 0) {
            $scope.selection.$updateCount++;
        }
    }
    $scope.$watch('selection.interpolate',function(interpolate) {
        $scope.selection.curves.forEach(function(c) {
            if(interpolate) {
                c.interpolate = interpolate;
            } else {
                delete c.interpolate;
            }
            updateChart();
        });
    });
    $scope.$watch('selection.curves[0].metric',updateChart);
    $scope.$watch('selection.curves[1].metric',updateChart);
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
    var X_TICK_CFG = {
        7: {
            rotate: 45,
            values: doyIntervalTick(14)
        },
        14: {
            rotate: 45,
            values: doyIntervalTick(28)
        },
        months: {
            values: [1,32,60,91,121,152,182,213,244,274,305,335]
        }
    },
    ROOT_DATE = new Date(2010,0);
    return {
        restrict: 'E',
        replace: true,
        template: '<div class="chart-container">'+
        '<vis-download ng-if="selection.$updateCount > 0" selector=".chart" filename="npn-activity-curves.png"></vis-download>'+
        '<div><svg class="chart"></svg></div>'+
        '</div>',
        scope: {
            selection: '='
        },
        link: function($scope) {
            var selection = $scope.selection,
                chart,
                sizing = ChartService.getSizeInfo({top: 80,left: 80,right: 80,bottom: 80}),
                d3_date_fmt = d3.time.format('%m/%d'),
                date_fmt = function(d){
                    var time = ((d-1)*ChartService.ONE_DAY_MILLIS)+ROOT_DATE.getTime(),
                        date = new Date(time);
                    return d3_date_fmt(date);
                },
                x = d3.scale.linear().range([0,sizing.width]).domain([1,365]),
                xAxis = d3.svg.axis().scale(x).orient('bottom')
                    .tickFormat(date_fmt),
                new_y = function() { return d3.scale.linear().range([sizing.height,0]).domain([0,100]); };

            // setup
            selection.curves.forEach(function(c) {
                c.x(x) // x
                 .y(new_y()); // bogus y
            });

            function updateChart() {
                chart.selectAll('g .axis').remove();

                var commonMetric = !selection.curves[1].isValid() || // 0 can't be invalid, but if 1 is then there's only 1 axis
                        (selection.curves[0].metricId() === selection.curves[1].metricId());
                if(commonMetric) {
                    // both use the same y-axis domain needs to include all valid curve's data
                    var domain = d3.extent(selection.curves.reduce(function(arr,c){
                            if(c.isValid()) {
                                arr = arr.concat(c.domain());
                            }
                            return arr;
                        },[])),
                        y = new_y().domain(domain);
                    $log.debug('ActivityCurves.common domain',domain);
                    selection.curves.forEach(function(c){
                        c.y(y);
                    });
                } else {
                    selection.curves.forEach(function(c){
                        // re-initialize y in case a previous plot re-used the same y
                        // each has an independent domain
                        if(c.isValid()) {
                            c.y(new_y().domain(c.domain()));
                        }
                    });
                }

                chart.append('g')
                    .attr('class', 'y axis left')
                    .call(selection.curves[0].axis())
                    .append('text')
                    .attr('class','axis-title')
                    .attr('transform', 'rotate(-90)')
                    .attr('y', '0')
                    .attr('dy','-4em')
                    .attr('x',-1*(sizing.height/2)) // looks odd but to move in the Y we need to change X because of transform
                    .style('text-anchor', 'middle')
                    .text(selection.curves[0].axisLabel());

                if(!commonMetric) {
                    chart.append('g')
                        .attr('class', 'y axis right')
                        .attr('transform','translate('+sizing.width+')')
                        .call(selection.curves[1].axis())
                        .append('text')
                        .attr('class','axis-title')
                        .attr('transform', 'rotate(-90)')
                        .attr('y', '0')
                        .attr('dy','4em')
                        .attr('x',-1*(sizing.height/2)) // looks odd but to move in the Y we need to change X because of transform
                        .style('text-anchor', 'middle')
                        .text(selection.curves[1].axisLabel());
                }

                var xTickConfig = X_TICK_CFG[selection.frequency.value];
                xAxis.tickValues(xTickConfig.values);
                chart.append('g')
                    .attr('class', 'x axis')
                    .attr('transform', 'translate(0,' + sizing.height + ')')
                    .call(xAxis)
                    .append('text')
                    .attr('y','0')
                    .attr('dy','3em')
                    .attr('x',(sizing.width/2))
                    .attr('class','axis-label')
                    .style('text-anchor', 'middle')
                    .text('Date');
                if(xTickConfig.rotate) {
                    chart.selectAll('g.x.axis g.tick text')
                        .style('text-anchor','end')
                        .attr('transform','rotate(-'+xTickConfig.rotate+')');
                    chart.selectAll('g.x.axis .axis-label')
                        .attr('dy','4em');
                }

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

                // if not using a common metric (two y-axes)
                // then color the ticks/labels in alignment with their
                // corresponding curve for clarity.
                if(!commonMetric) {
                    chart.selectAll('g.y.axis.left g.tick text')
                        .style('fill',selection.curves[0].color());
                    chart.selectAll('g.y.axis.left text.axis-title')
                        .style('fill',selection.curves[0].color());
                    chart.selectAll('g.y.axis.right g.tick text')
                        .style('fill',selection.curves[1].color());
                    chart.selectAll('g.y.axis.right text.axis-title')
                        .style('fill',selection.curves[1].color());
                }

                // draw the curves
                selection.curves.forEach(function(c) {
                    c.draw(chart);
                });

                // update the legend
                chart.select('.legend').remove();
                fontSize = 14;
                var legend = chart.append('g')
                      .attr('class','legend')
                      // the 150 below was picked just based on the site of the 'Activity Curves' title
                      .attr('transform','translate(150,-'+(sizing.margin.top-10)+')') // relative to the chart, not the svg
                      .style('font-size','1em'),
                    /* legend labels can differ greatly in length, don't try to put them
                       inside a box that will be impossible to size correctly
                    rect = legend.append('rect')
                        .style('fill','white')
                        .style('stroke','black')
                        .style('opacity','0.8')
                        .attr('width',100)
                        .attr('height',55),*/
                    r = 5, vpad = 4,
                    plotCnt = selection.curves.reduce(function(cnt,c){
                        var row;
                        if(c.isValid() && c.data()) {
                            row = legend.append('g')
                                .attr('class','legend-item curve-'+c.id)
                                .attr('transform','translate(10,'+(((cnt+1)*fontSize)+(cnt*vpad))+')');
                            row.append('circle')
                                .attr('r',r)
                                .attr('fill',c.color());
                            row.append('text')
                                .style('font-size', fontSize+'px')
                                .attr('x',(2*r))
                                .attr('y',(r/2))
                                .text(c.legendLabel(!commonMetric));
                            cnt++;
                        }
                        return cnt;
                    },0);


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
                     .attr('x', '0')
                     .style('text-anchor','start')
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
