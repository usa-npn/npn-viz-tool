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
    latLng = {
        // somewhere in AZ
        lat: function() { return 32.84267363195431; },
        lng: function() { return -112.412109375; }
    };

    $scope.layer = layer;
    $scope.legend = legend;
    $scope.modal = $uibModalInstance;
    $scope.latLng = latLng;

    var dateFmt = 'yyyy-MM-dd',
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
        end = (function(){
            var d = new Date();
            d.setFullYear(extent_year);
            if(extent_year !== this_year) {
                // if this year end today (no more data)
                // if previous year then get the full year's data
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
        chart,
        d3_date_fmt = d3.time.format('%m/%d'),
        date_fmt = function(d){
            var time = (d*ChartService.ONE_DAY_MILLIS)+start.getTime(),
                date = new Date(time);
            return d3_date_fmt(date);
        },
        x = d3.scale.linear().range([0,sizing.width]).domain([1,365]),
        xAxis = d3.svg.axis().scale(x).orient('bottom').tickFormat(date_fmt),
        y = d3.scale.linear().range([sizing.height,0]).domain([0,20000]), // bogus initially
        yAxis = d3.svg.axis().scale(y).orient('left'),
        dataFunc = function(d) { return d.point_value; },
        idFunc = function(d) { return d.doy; }, // id is the doy which is the index.
        line = d3.svg.line() // TODO remove if decide to not use
            .x(function(d,i){ return x(d.doy); })
            .y(function(d,i){ return y(d.point_value); }).interpolate('basis');

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

        chart.selectAll('.legend rect')
            .style('fill','white')
            .style('stroke','black')
            .style('opacity','0.8');

        var fontSize = '12px';

        chart.selectAll('.legend text')
             .style('font-size', fontSize)
             .attr('y',function(d,i){
                return (i*12) + i;
             });

        chart.selectAll('g .x.axis text')
            .style('font-size', fontSize);

        chart.selectAll('g .y.axis text')
            .style('font-size', fontSize);

    }
    function updateYAxis() {
        chart.selectAll('g .y.axis').remove();
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
             .text(start.getFullYear()+' AGDD Daily Trends for '+
                number(latLng.lat())+','+
                number(latLng.lng())+' '+base_temp+'°F Base Temp');

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

      updateYAxis();

      svg.append('g').append('text').attr('dx',5)
		   .attr('dy',sizing.height + 136)
		   .attr('font-size', '11px')
		   .attr('font-style','italic')
		   .attr('text-anchor','right').text('USA National Phenology Network, www.usanpn.org');
        commonChartUpdates();
        visualize();
    });

    /*
    function addLine(key,color) {
        chart.selectAll('line.'+key)
            .data(data[key],idFunc)
            .enter()
            .append('line')
            .attr('class',key)
            .attr('fill','none')
            .attr('stroke',color)
            .attr('stroke-width',2.5)
            .style('cursor','pointer')
            .attr('x1',function(d,i) { return x(i); })
            .attr('y1',function(d,i) { return y(i === 0 ? 0 : data[key][i-1]); })
            .attr('x2',function(d,i) { return x(i+1); })
            .attr('y2',function(d,i) { return y(data[key][i]); })
            .append('title')
            .text(function(d,i) {
                return 'DOY: '+(i+1)+' GDD: '+number((i === 0 ? 0 : data[key][i-1]),2);
            });
    }*/

    function addLine(cls,color,dataset) {
        chart.append('path')
            .attr('class','gdd '+cls)
            .attr('fill','none')
            .attr('stroke',color)
            .attr('stroke-linejoin','round')
            .attr('stroke-linecap','round')
            .attr('stroke-width',1.5)
            .attr('d',line(dataset));
    }

    function draw(data) {
        $log.debug('draw',data);
        $scope.working = true;

        var max = d3.max([d3.max(data.current,dataFunc),d3.max(data.average,dataFunc)]);
        yAxis.scale(y.domain([0,max]));
        updateYAxis();

        /*
        addLine('average','#0000ff');
        addLine('current','#000000');
        */

        /* going this route draws a continuous line but then
           we can't do a mouseover on an individual segment to show the data */
        addLine('average','blue',data.average);
        addLine('current','red',data.current);
        /*
        chart.append('path')
            .attr('class','gdd average')
            .attr('fill','none')
            .attr('stroke','blue')
            .attr('stroke-linejoin','round')
            .attr('stroke-linecap','round')
            .attr('stroke-width',1.5)
            .attr('d',line(data.average));

        chart.append('path')
            .attr('class','gdd current')
            .attr('fill','none')
            .attr('stroke','red')
            .attr('stroke-linejoin','round')
            .attr('stroke-linecap','round')
            .attr('stroke-width',1.5)
            .attr('d',line(data.current));*/

        commonChartUpdates();
        delete $scope.working;
    }

    $scope.selection = {
        lastYearValid: this_year > 2016, // time series data starts in 2016
        showLastYear: false
    };
    var lastYear;
    function addLastYear() {
        addLine('last','orange',lastYear);
    }
    function removeLastYear() {
        chart.selectAll('path.gdd.last').remove();
    }
    if($scope.selection.lastYearValid) {
        $scope.$watch('selection.showLastYear',function(show) {
            if(show && !lastYear) {
                $scope.working = true;
                var lastStart = new Date(start.getTime()),
                    lastEnd = new Date(start.getTime()),
                    last_params;
                lastStart.setFullYear(lastStart.getFullYear()-1);
                lastEnd.setFullYear(lastStart.getFullYear());
                lastEnd.setMonth(11);
                lastEnd.setDate(31);
                last_params = angular.extend({},params,{start_date:date(lastStart,dateFmt),end_date:date(lastEnd,dateFmt)});
                $log.debug('last_params',last_params);
                $http.get($url('/npn_portal/stations/getTimeSeries.json'),{
                    params:last_params
                }).then(function(response) {
                    lastYear = response.data;
                    addLastYear();
                    delete $scope.working;
                });
            } else if (lastYear) {
                if(show) {
                    addLastYear();
                } else {
                    removeLastYear();
                }
            }
        });
    }

    function visualize() {
        $scope.working = true;
        $q.all({
            avg: $http.get($url('/npn_portal/stations/getTimeSeries.json'),{
                params:avg_params
            }),
            current: $http.get($url('/npn_portal/stations/getTimeSeries.json'),{
                params:params
            })
        }).then(function(results){
            draw({
                average: results.avg.data,
                current: results.current.data
            });
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
