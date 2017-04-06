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
                    return number(n,0)+'°F';
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

    function updateLegend() {
        chart.select('.legend').remove();
        var legend = chart.append('g')
          .attr('class','legend')
          .attr('transform','translate(30,-45)') // relative to the chart, not the svg
          .style('font-size','1em');
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
                .attr('d',line(data[key].data));
            data[key].plotted = true;
            updateLegend();
        }
    }
    function updateThreshold() {
        var yCoord = y($scope.selection.threshold.value);
        thresholdLine.attr('y1',yCoord).attr('y2',yCoord);
    }

    function updateYAxis() {
        var lineKeys = Object.keys(data),maxes;
        if(lineKeys.length) {
            // calculate/re-calculate the y-axis domain so that the data fits nicely
            maxes = lineKeys.reduce(function(arr,key){
                arr.push(d3.max(data[key].data,dataFunc));
                return arr;
            },[]);
            $scope.selection.threshold.options.ceil = Math.round(yMax = d3.max(maxes));
            yAxis.scale(y.domain([0,yMax]));
            // if this happens we need to re-draw all lines that have been plotted
            // because the domain of our axis just changed
            lineKeys.forEach(function(key) {
                if(data[key].plotted) {
                    removeLine(key);
                    addLine(key);
                }
            });
            updateThreshold();
        }

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

    // this initializes the empty visualization and gets the ball rolling
    // it is within a timeout so that the HTML gets rendered and we can grab
    // the nested chart element (o/w it doesn't exist yet).
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
                .attr('y',y(0)/2),
            doyInfo = hoverInfo.append('tspan').attr('dy','1em').attr('x',hoverInfoX),
            doyLabel = doyInfo.append('tspan').attr('class','gdd-label').text('DOY: '),
            doyValue = doyInfo.append('tspan').attr('class','gdd-value'),
            infoKeys = ['average','previous','selected'],
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
            infoDiffs = ['previous','selected'].reduce(function(map,key){
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
                        //console.log(key,temp);
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
                var diff;
                if(temps[key]) {
                    infos[key].style('display',null);
                    infoLabels[key].text((temps[key].year||'Average')+': ');
                    infoValues[key].text(number(temps[key].gdd,0)+'°F');
                    if(infoDiffs[key]) {
                        diff = temps[key].gdd-temps.average.gdd;
                        infoDiffs[key]
                        .attr('class','gdd-diff '+(diff > 0 ? 'above' : 'below'))
                        .text(' ('+(diff > 0 ? '+' : '')+number(diff,0)+'°F)');
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

    // only setup a watch on selection.showLastYear if it can even happen
    if($scope.selection.lastYearValid) {
        $scope.$watch('selection.showLastYear',function(show) {
            if(show && (!data.previous)) {
                // no data for last year yet, go get it
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
                    addData('previous',{
                        year: lastStart.getFullYear(),
                        color: 'orange',
                        data: response.data
                    });
                    updateYAxis();
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
            addData('selected',{
                year: start.getFullYear(),
                color: 'black',
                data: results.selected.data
            });
            addData('average',{
                color: 'blue',
                data: results.average.data
            });
            $log.debug('draw',data);

            updateYAxis();

            addLine('average');
            addLine('selected');

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
