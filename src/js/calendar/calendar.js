angular.module('npn-viz-tool.vis-calendar',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'ui.bootstrap'
])
.controller('CalendarVisCtrl',['$scope','$modalInstance','$http','$timeout','$filter','FilterService','ChartService',
    function($scope,$modalInstance,$http,$timeout,$filter,FilterService,ChartService){
    var data, // the data from the server....
        dateArg = FilterService.getFilter().getDateArg(),
        start_year = dateArg.arg.start_date,
        end_year = dateArg.arg.end_date,
        sizing = ChartService.getSizeInfo({top: 20, right: 30, bottom: 35, left: 30}),
        chart,
        d3_month_fmt = d3.time.format('%B'),
        x = d3.scale.ordinal().rangeBands([0,sizing.width]).domain(d3.range(1,366)),
        xAxis = d3.svg.axis().scale(x).orient('bottom').tickValues(xTickValues()).tickFormat(formatXTickLabels),
        y = d3.scale.ordinal().rangeBands([sizing.height,0]).domain(d3.range(0,6)),
        yAxis = d3.svg.axis().scale(y).orient('right').tickSize(sizing.width).tickFormat(function(d) {
            return d;
        }).tickFormat(formatYTickLabels);


    $scope.modal = $modalInstance;
    $scope.colorScale = FilterService.getColorScale();
    $scope.colors = $scope.colorScale.domain();
    $scope.selection = {
        color: 0
    };
    $scope.plottable = [];
    angular.forEach(FilterService.getFilter().getSpeciesArgs(),function(sarg) {
        $scope.plottable.push(angular.extend({},sarg.arg,{phenophase_id: -1, phenophase_name: 'All phenophases'}));
        angular.forEach(sarg.phenophases,function(pp){
            $scope.plottable.push(angular.extend({},sarg.arg,pp));
        });
    });
    console.log('plottable',$scope.plottable);
    $scope.toPlot = [];

    if((end_year - start_year) <= 1) {
        $scope.selection.start_year = start_year;
    } else {
        $scope.availableYears = d3.range(start_year,end_year);
    }
    $scope.$watch('selection.start_year',function(){
        if($scope.selection.start_year) {
            // one or two years depending on the base map filter
            $scope.selection.end_year = end_year > $scope.selection.start_year ?
                $scope.selection.start_year+1 : end_year;
        }
    });

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
        console.log('addToPlot',toPlot);
        if(toPlot) {
            if(toPlot.phenophase_id === -1) {
                console.log('add all phenophases...');
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

    function moveYTickLabels(g) {
      var dy = -1*((y.rangeBand()/2)+2);
      g.selectAll('text')
          .attr('x', 0)
          .attr('dy', dy);
    }

    function formatYTickLabels(i) {
        return (data && data.labels && i < data.labels.length ) ? data.labels[i]+' ['+i+']' : '';
    }

    function xTickValues() {
        var y = $scope.selection && $scope.selection.start_year ? $scope.selection.start_year : start_year,
            firsts = [1],i,count = 1;
        for(i = 1; i < 12; i++) {
            var date = new Date(y,i);
            // back up 1 day
            date.setTime(date.getTime()-ChartService.ONE_DAY_MILLIS);
            count += date.getDate();
            firsts.push(count);
        }
        console.log('firsts for '+y,firsts);
        return x.domain().filter(function(d){
            return firsts.indexOf(d) !== -1;
        });
    }
    function formatXTickLabels(i) {
        var y = $scope.selection && $scope.selection.start_year ? $scope.selection.start_year : start_year,
            date = new Date(y,0);
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
        xAxis.scale(x) // x.domain was updated in a watch when the date range was set
             .tickValues(xTickValues());
        chart.selectAll('g .x.axis').call(xAxis);
        // update the y-axis
        y.rangeBands([sizing.height,0],0.5,0.5);
        y.domain(d3.range(0,data.labels.length));
        yAxis.scale(y);
        chart.selectAll('g .y.axis').call(yAxis).call(moveYTickLabels);

        console.log('x.rangeBand()',x.rangeBand());
        console.log('y.rangeBand()',y.rangeBand());

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
        console.log('visualize',$scope.selection.axis,$scope.toPlot);
        var dateArg = FilterService.getFilter().getDateArg(),
            params = {
                request_src: 'npn-vis-calendar'
            },
            colorMap = {},
            yearsRange = d3.range($scope.selection.start_year,$scope.selection.end_year+1);
        yearsRange.forEach(function(d,i){
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
            y = ($scope.toPlot.length*yearsRange.length)-1;

            // translate arrays into maps
            angular.forEach(response,function(species){
                speciesMap[species.species_id] = species;
                var ppMap = {};
                angular.forEach(species.phenophases,function(pp){
                    ppMap[pp.phenophase_id] = pp;
                    // START fix "years", may be temporary
                    if(angular.isArray(pp.years)) {
                        var years = {},keys;
                        angular.forEach(pp.years,function(y){
                            keys = Object.keys(y);
                            if(keys.length > 1) {
                                console.warn('year array member with multiple keys?', y);
                            } else if (keys.length === 1) {
                                years[keys[0]] = y[keys[0]];
                            }
                        });
                        pp.years = years;
                    }
                    // END fix
                });
                species.phenophases = ppMap;
            });

            console.log('speciesMap',speciesMap);
            angular.forEach($scope.toPlot,function(tp){
                console.log('toPlot',tp);
                var species = speciesMap[tp.species_id],
                    phenophase = species.phenophases[tp.phenophase_id];
                angular.forEach(yearsRange,function(year){
                    var doys = phenophase.years[year];
                    console.log('year',y,year,species.common_name,phenophase,doys);
                    angular.forEach(doys,function(doy){
                        toChart.data.push({
                            y: y,
                            x: doy,
                            color: tp.color // TODO - what else is needed here??
                        });
                    });
                    toChart.labels.splice(0,0,$filter('speciesTitle')(tp)+'/'+tp.phenophase_name+' ('+year+')');
                    console.log('y of '+y+' is for '+toChart.labels[0]);
                    y--;
                });
            });
            $scope.data = data = toChart;
            console.log('calendar data',data);
            draw();
        });
    };
}]);