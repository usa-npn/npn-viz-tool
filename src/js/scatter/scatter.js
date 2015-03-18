angular.module('npn-viz-tool.vis-scatter',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'ui.bootstrap'
])
.controller('ScatterVisCtrl',['$scope','$modalInstance','$http','$timeout','$filter','FilterService','ChartService',
    function($scope,$modalInstance,$http,$timeout,$filter,FilterService,ChartService){
    $scope.modal = $modalInstance;
    $scope.colorScale = d3.scale.category20();
    $scope.colors = new Array(20);
    $scope.axis = [{key: 'latitude', label: 'Latitude'},{key: 'longitude', label: 'Longitude'},{key:'elevation_in_meters',label:'Elevation'}];
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
            .attr('y', 0)
            .attr('dy', '-3.5em')
            .style('text-anchor', 'end')
            .text('Onset DOY');
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
          .attr('x',sizing.width)
          .attr('dy', '3em')
          .style('text-anchor', 'end')
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
                seriesData = data.filter(function(d) { return d.color === color; }),
                datas = seriesData.sort(function(o1,o2){ // sorting isn't necessary but makes it easy to pick min/max x
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
            .attr('stroke-width', 2)
            .style('display', $scope.selection.regressionLines ? 'inherit' : 'none');


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
        console.log('visualize',$scope.selection.axis,$scope.toPlot);
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
            data = response.filter(function(d,i) {
                var keep = d.first_yes_year === d.last_yes_year;
                if(!keep) {
                    console.log('filtering out record with first/last yes in different years.',d);
                } else {
                    d.id = i;
                    // this is the day # that will get plotted 1 being the first day of the start_year
                    // 366 being the first day of start_year+1, etc.
                    d.day_in_range = ((d.first_yes_year-start_year)*365)+d.first_yes_doy;
                    d.color = $scope.colorScale(colorMap[d.species_id+'.'+d.phenophase_id]);
                }
                return keep;
            });
            console.log('scatterPlot data',data);
            draw();
        });
    };
}]);