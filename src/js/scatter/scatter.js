angular.module('npn-viz-tool.vis-scatter',[
    'npn-viz-tool.vis',
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.settings',
    'ui.bootstrap'
])
.controller('ScatterVisCtrl',['$scope','$uibModalInstance','$timeout','$filter','$log','FilterService','ChartService',
    function($scope,$uibModalInstance,$timeout,$filter,$log,FilterService,ChartService){
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
            .text('Onset Day of Year');

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
            //.attr('data-legend-color',function(d) { return d.color; }) // no longer used, uses fill then stroke, added fill below
            .attr('x1', function(d) { return x(d.p1[0]); })
            .attr('y1', function(d) { return y(d.p1[1]); })
            .attr('x2', function(d) { return x(d.p2[0]); })
            .attr('y2', function(d) { return y(d.p2[1]); })
            .attr('fill', function(d) { return d.color; })
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
                        // the site vs summary data stores a few things under different keys
                        // the key is the summary key (what the UI plots) and the value
                        // is the site key if using site data just copy the value over to the
                        // key the summary data would supply
                        angular.forEach({
                            daylength: 'mean_daylength',
                            acc_prcp: 'mean_accum_prcp',
                            gdd: 'mean_gdd'
                        },function(siteKey,summaryKey){
                            if(typeof(d[summaryKey]) === 'undefined') {
                                d[summaryKey] = d[siteKey];
                            }
                        });
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
