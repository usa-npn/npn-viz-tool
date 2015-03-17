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
        start_date = new Date(start_year,0),
        ONE_DAY = 24*60*60*1000,
        end_year = dateArg.arg.end_date,
        sizing = ChartService.getSizeInfo({top: 30, right: 30, bottom: 30, left: 30}),
        chart,
        x = d3.time.scale().range([0,sizing.width]).domain([new Date(start_year,0,1),new Date(start_year,12,31)]).nice(0),
        d3_month_fmt = d3.time.format('%B'),
        xAxis = d3.svg.axis().scale(x).ticks(d3.time.months).orient('bottom').tickFormat(function(d){
            return d3_month_fmt(d);
        }),
        y = d3.scale.ordinal().rangeBands([sizing.height,0]).domain(d3.range(0,6)),
        yAxis = d3.svg.axis().scale(y).orient('right').tickSize(sizing.width).tickFormat(function(d) {
            //return '';
            return d;
        }).tickFormat(formatYTickLabels);

    $scope.modal = $modalInstance;
    $scope.colorScale = d3.scale.category20();
    $scope.colors = new Array(20);
    $scope.selection = {
        color: 0
    };
    $scope.plottable = [];
    angular.forEach(FilterService.getFilter().getSpeciesArgs(),function(sarg) {
        angular.forEach(sarg.phenophases,function(pp){
            $scope.plottable.push(angular.extend({},sarg.arg,pp));
        });
    });
    $scope.toPlot = [];

    if((end_year - start_year) <= 1) {
        $scope.selection.start_year = start_year;
    } else {
        $scope.availableYears = d3.range(start_year,end_year);
        console.log('availableYears');
    }
    $scope.$watch('selection.start_year',function(){
        if($scope.selection.start_year) {
            x.domain([new Date($scope.selection.start_year,0,1),new Date($scope.selection.start_year,12,13)]);
            // one or two years depending on the base map filter
            $scope.selection.end_year = end_year > $scope.selection.start_year ?
                $scope.selection.start_year+1 : end_year;
        }
    });

    function getNewToPlot() {
        return angular.extend({},$scope.selection.toPlot,{color: $scope.selection.color});
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

    $scope.addToPlot = function() {
        if($scope.selection.toPlot) {
            $scope.toPlot.push(getNewToPlot());
            $scope.selection.color++;
            data = undefined;
        }
    };
    $scope.removeFromPlot = function(idx) {
        $scope.toPlot.splice(idx,1);
        data = undefined;
    };

    function moveYTickLabels(g) {
      var dy = -1*((y.rangeBand()/2)+8);
      g.selectAll('text')
          .attr('x', 0)
          .attr('dy', dy);
    }

    function formatYTickLabels(i) {
        return (data && i < data.length && data[i].LABEL) ? data[i].LABEL : '';
    }

    function draw() {
        if(!data) {
            return;
        }

        // update the x-axis
        xAxis.scale(x); // x.domain was updated in a watch when the date range was set
        chart.selectAll('g .x.axis').call(xAxis);
        // update the y-axis
        y.rangeBands([sizing.height,0],0.5,0.5);
        y.domain(d3.range(0,data.length));
        yAxis.scale(y);
        chart.selectAll('g .y.axis').call(yAxis).call(moveYTickLabels);

        console.log('y.rangeBand()',y.rangeBand());

        var dayOne = x.domain()[0],
            dayOneTime = dayOne.getTime()-ChartService.ONE_DAY_MILLIS, // minus 1-day because doy is index 1
            dy = y.rangeBand()/2;
        console.log('dayOne',dayOne);
        console.log('x.domain',x.domain());
        console.log('y.domain',y.domain());

        var inPhase = chart.selectAll('.in-phase').data(data);
        inPhase.exit().remove();
        inPhase.enter().append('line').attr('class','in-phase');

        inPhase
            .attr('data-legend',function(d) { return d.legend; } )
            .attr('data-legend-color',function(d) { return $scope.colorScale(d.color); })
            .attr('x1', function(d) { return x(d.FIRST_DOY ? new Date(dayOneTime+(d.FIRST_DOY*ChartService.ONE_DAY_MILLIS)) : dayOne); })
            .attr('y1', function(d,i) { return y(i)+dy; })
            .attr('x2', function(d) { return x(d.LAST_DOY ? new Date(dayOneTime+(d.LAST_DOY*ChartService.ONE_DAY_MILLIS)) : dayOne); })
            .attr('y2', function(d,i) { return y(i)+dy; })
            .attr('stroke', function(d) { return $scope.colorScale(d.color); })
            .attr('stroke-width', y.rangeBand());
    }

    $scope.visualize = function() {
        if(data) {
            return draw();
        }
        console.log('visualize',$scope.selection.axis,$scope.toPlot);
        var dateArg = FilterService.getFilter().getDateArg(),
            params = {
                request_src: 'npn-vis-cealendar',
                start_date: $scope.selection.start_year+'-01-01',
                end_date: $scope.selection.end_year+'-12-31'
            },
            i = 0,
            colorMap = {};
        angular.forEach($scope.toPlot,function(tp) {
            colorMap[tp.species_id+'.'+tp.phenophase_id] = tp.color;
            params['species_id['+i+']'] = tp.species_id;
            params['phenophase_id['+(i++)+']'] = tp.phenophase_id;
        });
        ChartService.getSummarizedData(params,function(response){
            var years = d3.range($scope.selection.start_year,$scope.selection.end_year+1),
                sets = [],toChart = [];
            console.log('years',years);
            if($scope.toPlot.length === 1) {
                sets.push(response);
            } else {
                angular.forEach($scope.toPlot,function(tp){
                    sets.push(response.filter(function(d){
                        return tp.species_id == d.species_id && tp.phenophase_id == d.phenophase_id;
                    }));
                });
            }
            console.log('sets',sets);
            angular.forEach(sets,function(set,i){
                var tp = $scope.toPlot[i];
                angular.forEach(years,function(year){
                    var year_set = set.filter(function(d){ return year === d.first_yes_year && year === d.last_yes_year; });
                    console.log('year_set',year_set);
                    toChart.push(angular.extend({
                        LABEL: $filter('speciesTitle')(tp)+'/'+tp.phenophase_name+' ('+year+')',
                        FIRST_DOY: d3.min(year_set,function(d) { return d.first_yes_doy; }),
                        LAST_DOY: d3.max(year_set,function(d) { return d.last_yes_doy; }),
                    },tp));
                });
            });
            data = toChart.reverse();
            console.log('calendar data',data);
            draw();
        });
    };
}]);