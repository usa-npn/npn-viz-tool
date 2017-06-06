angular.module('npn-viz-tool.vis-activity',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.settings',
    'ui.bootstrap'
])
.factory('ActivityCurve',['$log','$filter','FilterService',function($log,$filter,FilterService) {
    var DOY = $filter('doy'),
        NUMBER = $filter('number'),
        SPECIES_TITLE = $filter('speciesTitle'),
        DECIMAL = function(v) {
            return NUMBER(v,2);
        },
        COMMON_METRICS = [{
            id: 'num_yes_records',
            sampleSize: 'status_records_sample_size',
            label: 'Total Yes Records'
        },{
            id: 'proportion_yes_records',
            sampleSize: 'status_records_sample_size',
            label: 'Proportion Yes Records',
            valueFormat: DECIMAL,
            proportion: true
        }],
        KINGDOM_METRICS = {
            Plantae: COMMON_METRICS.concat([{
                id: 'numindividuals_with_yes_record',
                sampleSize: 'individuals_sample_size',
                label: 'Total Individuals with Yes Records'
            },{
                id: 'proportion_individuals_with_yes_record',
                sampleSize: 'individuals_sample_size',
                label: 'Proportion Individuals with Yes Records',
                valueFormat: DECIMAL,
                proportion: true
            }]),
            Animalia: COMMON_METRICS.concat([{
                id: 'numsites_with_yes_record',
                sampleSize: 'sites_sample_size',
                label: 'Total Sites with Yes Records'
            },{
                id: 'proportion_sites_with_yes_record',
                sampleSize: 'sites_sample_size',
                label: 'Proportion Sites with Yes Records',
                valueFormat: DECIMAL,
                proportion: true
            },{
                id: 'total_numanimals_in-phase',
                sampleSize: 'in-phase_site_visits_sample_size',
                label: 'Total Animals In Phase'
            },
            {
                id: 'mean_numanimals_in-phase',
                sampleSize: 'in-phase_per_hr_sites_sample_size',
                label: 'Animals In Phase',
                valueFormat: DECIMAL
            },{
                id: 'mean_numanimals_in-phase_per_hr',
                sampleSize: 'in-phase_per_hr_sites_sample_size',
                label: 'Animals In Phase per Hour',
                valueFormat: DECIMAL
            },{
                id: 'mean_numanimals_in-phase_per_hr_per_acre',
                sampleSize: 'phase_per_hr_per_acre_sites_sample_size',
                label: 'Animals In Phase per Hour per Acre',
                valueFormat: DECIMAL
            }])
        },
        ActivityCurve = function(id) {
            var self = this,
                _species,
                _year,
                _phenophase,
                _metric,
                _phenophases,
                _metrics;
            self.id = id;
            function reset() {
                delete self.$data;
                delete self.$metricData;
            }
            Object.defineProperty(this,'validPhenophases',{
                get: function() { return _phenophases; }
            });
            Object.defineProperty(this,'validMetrics',{
                get: function() { return _metrics; }
            });
            Object.defineProperty(this,'year',{
                enumerable: true,
                get: function() { return _year; },
                set: function(y) {
                    reset();
                    _year = y;
                }
            });
            Object.defineProperty(this,'phenophase',{
                enumerable: true,
                get: function() { return _phenophase; },
                set: function(p) {
                    reset();
                    _phenophase = p;
                }
            });
            Object.defineProperty(this,'metric',{
                enumerable: true,
                get: function() { return _metric; },
                set: function(m) {
                    reset();
                    _metric = m;
                }
            });
            Object.defineProperty(this,'species',{
                enumerable: true,
                get: function() { return _species; },
                set: function(s) {
                    reset();
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
                            self.phenophase = _phenophases.length ? _phenophases[0] : undefined;
                        });
                    }
                }
            });
        };
    ActivityCurve.prototype.axisLabel = function() {
        return this.metric ? this.metric.label : '?';
    };
    ActivityCurve.prototype.doyDataValue = function() {
        var self = this,
            data = self.data(),
            value,d,i;
        if(self.doyFocus && data) {
            for(i = 0; i < data.length; i++) {
                d = data[i];
                if(self.doyFocus >= d.start_doy && self.doyFocus <= d.end_doy) {
                    value = (self.metric.valueFormat||angular.identity)(d[self.metric.id]);
                    if(d[self.metric.sampleSize] !== -9999) {
                        value += ' N:'+ d[self.metric.sampleSize];
                    }
                    return value;
                }
            }
        }
    };
    ActivityCurve.prototype.legendLabel = function(includeMetric) {
        var doyFocusValue = this.doyDataValue();
        return this.year+': '+SPECIES_TITLE(this.species)+' - '+this.phenophase.phenophase_name+
            (includeMetric ? (' ('+this.metric.label+')') : '')+
            (typeof(doyFocusValue) !== 'undefined' ? (' ['+doyFocusValue+']') : '');
    };
    ActivityCurve.prototype.metricId = function() {
        return this.metric ? this.metric.id : undefined;
    };
    ActivityCurve.prototype.data = function(_) {
        if(arguments.length) {
            delete this.$data;
            delete this.$metricData;
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
        var self = this,
            data = self.$data;
        if(data && self.metric) {
            // avoid re-filtering with UI updates, store the result and re-use until
            // something changes
            if(!self.$metricData) {
                if(!self.metric.sampleSize) {
                    $log.warn('Metric does not define a sampleSize property, cannot filter out invalid data points.');
                }
                data = data.filter(function(d){
                    if(self.metric.sampleSize && d[self.metric.sampleSize] === -9999) {
                        //console.log('SAMPLE_SIZE filter.');
                        return false;
                    }
                    return d[self.metric.id] !== -9999;
                });
                if(data.length !== self.$data.length) {
                    $log.debug('filtered out '+(self.$data.length-data.length)+'/'+ self.$data.length +' of -9999 records for metric ',self.metric);
                }
                /*
                if(data.length === 26) { // simulate situation for development bi-weekly data
                    //console.log('DEBUG CODE MODIFYING DATA!!');
                    // create a single isolated data point and three separate curves
                    // [0-9] [11] [13-19] [21-25]
                    data = data.filter(function(d,i) {
                        return (i !== 10 && i !== 12 && i !== 20);
                    });
                }*/
                self.$metricData = data;
            } else {
                data = self.$metricData;
            }
        }
        return data;
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
        var y = this.y(),
            ticks = y.ticks(), // default is ~10 ticks
            axis = d3.svg.axis().scale(y);
        if(ticks.length) {
            // replace the final tick with the top of the y domain
            // that -would- have been generated and use them explicitly
            // this can result in ticks stacked on on another if too close
            //ticks.push(y.domain()[1]);
            // this often results in a larger space between the two topmost ticks
            ticks[ticks.length-1] = y.domain()[1];
            axis.tickValues(ticks);
        }
        return axis.orient(this.axisOrient()||'left');
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
    ActivityCurve.prototype.plotted = function() {
        // not keeping track of a flag but curves are plotted if they
        // are valid and have data
        return this.isValid() && this.data();
    };
    ActivityCurve.prototype.shouldRevisualize = function() {
        return this.isValid() && !this.data();
    };
    ActivityCurve.prototype.domain = function() {
        var self = this,
            data = self.data(),
            extents;
        if(data && self.metric) {
            extents = d3.extent(data,function(d){
                return d[self.metric.id];
            });
            if(extents[0] > 0) {
                // typically data sets will contain 0 but really always want the
                // lower extent of any y axis to be zero so make it so
                extents[0] = 0;
            } else if(extents[0] < 0) {
                // this shouldn't happen but don't futz with the domain in this
                // case or the graph would go wonky
                $log.warn('negative domain start for metric',extents,self.metric);
            }
            return extents;
        }
    };
    ActivityCurve.prototype.draw = function(chart) {
        var self = this,
            data = self.data(),
            datas = [[]],
            x,y,i,d,dn,line,
            r = 3;
        chart.selectAll('path.curve.curve-'+self.id).remove();
        chart.selectAll('circle.curve-point.curve-point-'+self.id).remove();
        if(data && data.length) {
            // detect any gaps in the data, break it into multiple curves/points
            // to plot
            for(i = 0; i < data.length; i++) {
                d = data[i];
                dn = (i+1) < data.length ? data[i+1] : undefined;
                datas[datas.length-1].push(d);
                if(dn && dn.start_doy !== (d.end_doy+1)) {
                    datas.push([]); // there's a gap in the data, start another curve or point
                }
            }

            x = self.x();
            y = self.y();
            var x_functor = function(d,i) { return x(d.start_doy+Math.round((d.end_doy-d.start_doy)/2)); },
                y_functor = function(d) { return y(d[self.metric.id]); };
            line = d3.svg.line()
                .interpolate(self.interpolate||'monotone')
                .x(x_functor)
                .y(y_functor);
            $log.debug('ActivityCurve.draw',self.species,self.phenophase,self.year,self.metric,self.domain(),y.domain());
            $log.debug('draw.datas',datas);
            datas.forEach(function(curve_data,i){
                if(curve_data.length === 1 || self.dataPoints) {
                    curve_data.forEach(function(d){
                        chart.append('circle')
                            .attr('class','curve-point curve-point-'+self.id)
                            .attr('r',r)
                            .attr('fill',self.color())
                            .attr('cx',x_functor(d))
                            .attr('cy',y_functor(d));
                    });
                }
                if(curve_data.length > 1) {
                    chart.append('path')
                        .attr('class','curve curve-'+self.id)
                        .attr('fill','none')
                        .attr('stroke',self.color())
                        .attr('stroke-linejoin','round')
                        .attr('stroke-linecap','round')
                        .attr('stroke-width',1.5)
                        .attr('d',line(curve_data));
                }
            });
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
        dataPoints: true,
        curves: [{color:'#0000ff',orient:'left'},{color:'orange',orient:'right'}].map(function(config,i){ return new ActivityCurve(i).color(config.color).axisOrient(config.orient); }),
        frequency: $scope.frequencies[0],
        shouldRevisualize: function() {
            return $scope.selection.curves.reduce(function(reviz,c){
                return reviz||c.shouldRevisualize();
            },false);
        }
    };
    $scope.$watch(function(){
        return $scope.selection.shouldRevisualize();
    },function(reviz) {
        if(reviz) {
            $scope.visualize();
        }
    });
    $scope.$watch('selection.frequency',function(f) {
        // any change to frequency invalidates any data currently held by curves
        $scope.selection.curves.forEach(function(c) {
            c.data(null);
        });
    });
    function updateChart() {
        if($scope.selection.$updateCount > 0/* not been drawn yet*/ && !$scope.selection.shouldRevisualize() /*requires new data to redraw*/) {
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
    $scope.$watch('selection.dataPoints',function(dataPoints){
        $scope.selection.curves.forEach(function(c){
            c.dataPoints = dataPoints;
        });
        updateChart();
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
            $scope.metricPopoverText = 'The total number of reported "yes" (presence) records for the species and phenophase within the selected time period.';
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
                if(list.length && $scope.input.id === 0 /* only populate curve #1 by default */ ) {
                    $scope.input.species = $scope.input.id < list.length ? list[$scope.input.id] : list[0];
                }
            });
        }
    };
}])
.directive('activityCurvesChart',['$log','$timeout','$filter','ChartService',function($log,$timeout,$filter,ChartService){
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
    ROOT_DATE = new Date(2010,0),
    // this filter is part of the gridded functionality and maybe a more generic
    // version should be created
    DOY_FILTER = $filter('legendDoy');
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
                fontSize = 14,
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

            function usingCommonMetric() {
                if (!selection.curves[1].isValid() || // 0 can't be invalid, but if 1 is then there's only 1 axis
                    (selection.curves[0].metricId() === selection.curves[1].metricId())) {
                    return selection.curves[0].metric;
                }
            }

            function updateChart() {
                // pad top end of domains by N%
                function padDomain(d,metric) {
                    if(d && d.length === 2) {
                        d = [d[0],(d[1]*1.05)];
                        if(metric && metric.proportion && d[1] > 1) {
                            d[1] = 1.0; // don't allow proportions to overflow for clarity.
                        }
                    }
                    return d;
                }
                chart.selectAll('g .axis').remove();

                var commonMetric = usingCommonMetric();
                if(commonMetric) {
                    // both use the same y-axis domain needs to include all valid curve's data
                    var domain = d3.extent(selection.curves.reduce(function(arr,c){
                            if(c.isValid()) {
                                arr = arr.concat(c.domain());
                            }
                            return arr;
                        },[])),
                        y = new_y().domain(padDomain(domain,commonMetric));
                    $log.debug('ActivityCurves.common domain',domain);
                    selection.curves.forEach(function(c){
                        c.y(y);
                    });
                } else {
                    selection.curves.forEach(function(c){
                        // re-initialize y in case a previous plot re-used the same y
                        // each has an independent domain
                        if(c.isValid()) {
                            c.y(new_y().domain(padDomain(c.domain(),c.metric)));
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

                chart.selectAll('g .x.axis text')
                    .style('font-size', fontSize+'px');

                chart.selectAll('g .y.axis text')
                    .style('font-size', fontSize+'px');

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

                updateLegend();
            }

            function updateLegend() {
                chart.select('.legend').remove();
                var commonMetric = usingCommonMetric(),
                    legend = chart.append('g')
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
                        if(c.plotted()) {
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

                var hover = svg.append('g')
                    .attr('transform', 'translate(' + sizing.margin.left + ',' + sizing.margin.top + ')')
                    .style('display','none');
                var hoverLine = hover.append('line')
                        .attr('class','focus')
                        .attr('fill','none')
                        .attr('stroke','green')
                        .attr('stroke-width',1)
                        .attr('x1',0)
                        .attr('y1',0)
                        .attr('x2',0)
                        .attr('y2',sizing.height),
                    hoverDoy = hover.append('text')
                        .attr('class','focus-doy')
                        .attr('y',10)
                        .attr('x',0)
                        .text('hover doy');
                function focusOff() {
                    selection.curves.forEach(function(c) { delete c.doyFocus; });
                    hover.style('display','none');
                    updateLegend();
                }
                function focusOn() {
                    // only turn on if something has been plotted
                    if(selection.curves.reduce(function(plotted,c){
                            return plotted||c.plotted();
                        },false)) {
                        hover.style('display',null);
                    }
                }
                function updateFocus() {
                    var coords = d3.mouse(this),
                        xCoord = coords[0],
                        yCoord = coords[1],
                        doy = Math.round(x.invert(xCoord)),
                        dataPoint = selection.curves.reduce(function(dp,curve){
                            if(!dp && curve.plotted()) {
                                dp = curve.data().reduce(function(found,point){
                                    return found||(doy >= point.start_doy && doy <= point.end_doy ? point : undefined);
                                },undefined);
                            }
                            return dp;
                        },undefined);
                    hoverLine.attr('transform','translate('+xCoord+')');
                    hoverDoy
                        .style('text-anchor',doy < 324 ? 'start' : 'end')
                        .attr('x',xCoord+(10*(doy < 324 ? 1 : -1)))
                        .text(dataPoint ?
                            DOY_FILTER(dataPoint.start_doy)+' - '+DOY_FILTER(dataPoint.end_doy) :
                            DOY_FILTER(doy));
                    selection.curves.forEach(function(c) { c.doyFocus = doy; });
                    updateLegend();
                }
                svg.append('rect')
                    .attr('class','overlay')
                    .attr('transform', 'translate(' + sizing.margin.left + ',' + sizing.margin.top + ')')
                    .style('fill','none')
                    .style('pointer-events','all')
                    .attr('x',0)
                    .attr('y',0)
                    .attr('width',sizing.width)
                    .attr('height',sizing.height)
                    .on('mouseover',focusOn)
                    .on('mouseout',focusOff)
                    .on('mousemove',updateFocus);
            });

            $scope.$watch('selection.$updateCount',function(count){
                if(count > 0) {
                    updateChart();
                }
            });
        }
    };
}]);
