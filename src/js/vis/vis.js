angular.module('npn-viz-tool.vis',[
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'ui.bootstrap'
])
.factory('ChartService',['$window',function($window){
    // TODO - currently this is hard coded info but should eventually
    // be dynamically generated based on available screen realestate.
    var CHART_W = 930,
        CHART_H =500,
        MARGIN = {top: 20, right: 30, bottom: 60, left: 40},
        WIDTH = CHART_W - MARGIN.left - MARGIN.right,
        HEIGHT = CHART_H - MARGIN.top - MARGIN.bottom,
        SIZING = {
            margin: MARGIN,
            width: WIDTH,
            height: HEIGHT
        };
    var service = {
        getSizeInfo: function(marginOverride){
            // make the chart 92% of the window width
            var margin = angular.extend({},MARGIN,marginOverride),
                cw = Math.round($window.innerWidth*0.92),
                ch = Math.round(cw*0.5376), // ratio based on initial w/h of 930/500
                w = cw  - margin.left - margin.right,
                h = ch  - margin.top - margin.bottom,
                sizing = {width: w, height : h, margin: margin};
            console.log('sizing',sizing);
            return sizing;
        }
    };
    return service;
}])
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
.directive('visControl',['$modal',function($modal){
    var visualizations = [{
        title: 'Scatter Plot',
        controller: 'ScatterPlotCtrl',
        template: 'js/vis/scatterPlot.html',
        description: 'This visualization uses site-level data and allows users to set different variables as the X and Y axes. The user can select a number of geographic or climatic variables on the X axis and phenometric type variables on the Y axis. The graph presents a legend for multiple species, as well as produces a regression line.'
    }];
    return {
        restrict: 'E',
        templateUrl: 'js/vis/visControl.html',
        scope: {

        },
        controller: function($scope) {
            $scope.visualizations = visualizations;
            $scope.open = function(vis) {
                $modal.open({
                    templateUrl: vis.template,
                    controller: vis.controller,
                    windowClass: 'vis-dialog-window',
                    backdrop: 'static',
                    keyboard: false,
                    size: 'lg'
                });
            };
        }
    };
}])
.controller('ScatterPlotCtrl',['$scope','$modalInstance','$http','$timeout','FilterService','ChartService',function($scope,$modalInstance,$http,$timeout,FilterService,ChartService){
    $scope.modal = $modalInstance;
    $scope.colorScale = d3.scale.category20();
    $scope.colors = new Array(20);
    $scope.selection = {
        color: 0,
        axis: 'latitude'
    };
    $scope.plottable = [];
    angular.forEach(FilterService.getFilter().getSpeciesArgs(),function(sarg) {
        angular.forEach(sarg.phenophases,function(pp){
            $scope.plottable.push(angular.extend({},sarg.arg,pp));
        });
    });
    $scope.toPlot = [];
    $scope.axis = [{key: 'latitude', label: 'Latitude'},{key: 'longitude', label: 'Longitude'},{key:'elevation_in_meters',label:'Elevation'}];
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
        ONE_DAY = 24*60*60*1000,
        end_year = dateArg.arg.end_date,
        sizing = ChartService.getSizeInfo({left: 80}),
        chart,
        x = d3.scale.linear().range([0,sizing.width]).domain([0,100]), // bogus domain initially
        xAxis = d3.svg.axis().scale(x).orient('bottom'),
        y = d3.scale.linear().range([sizing.height,0]).domain([1,(((end_year-start_year)+1)*365)]).nice(),
        d3_date_fmt = d3.time.format('%x'),
        local_date_fmt = function(d){
                var time = ((d-1)*ONE_DAY)+start_date.getTime(),
                    date = new Date(time);
                //console.log('format',d,date);
                return d3_date_fmt(date);
            },
        yAxis = d3.svg.axis().scale(y).orient('left')
            .tickFormat(local_date_fmt);
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
              .call(xAxis)
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-65)');

          chart.append('g')
              .attr('class', 'y axis')
              .call(yAxis)
            .append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 6)
            .attr('dy', '.71em')
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
        // update the x-axis
        var padding = 1;
        function xData(d) { return d[$scope.selection.axis]; }
        x.domain([d3.min(data,xData)-padding,d3.max(data,xData)+padding]);
        xAxis.scale(x).tickFormat(d3.format(',f'));
        chart.selectAll('g .x.axis').call(xAxis);
        // update the chart data (TODO transitions??)
        var circles = chart.selectAll('.circle').data(data,function(d) { return d.id; });
        circles.exit().remove();
        circles.enter().append('circle')
          .attr('class', 'circle');

        circles.attr('cx', function(d) { return x(d[$scope.selection.axis]); })
          .attr('cy', function(d) { return y(d.day_in_range); })
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
    }
    $scope.visualize = function() {
        if(data) {
            return draw();
        }
        console.log('key',$scope.selection.axis);
        console.log('toPlot',$scope.toPlot);
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
        $http.get('/npn_portal/observations/getSummarizedData.json',{params:params}).success(function(response){
            response.forEach(function(d,i){
                d.id = i;
                d.latitude = parseFloat(d.latitude);
                d.longitude = parseFloat(d.longitude);
                d.elevation_in_meters = parseInt(d.elevation_in_meters);
                d.first_yes_year = parseInt(d.first_yes_year);
                d.first_yes_doy = parseInt(d.first_yes_doy);
                // this is the day # that will get plotted 1 being the first day of the start_year
                // 366 being the first day of start_year+1, etc.
                d.day_in_range = ((d.first_yes_year-start_year)*365)+d.first_yes_doy;
                d.color = $scope.colorScale(colorMap[d.species_id+'.'+d.phenophase_id]);
            });
            data = response.filter(function(d,i){
                var bad = (d.latitude === 0.0 || d.longitude === 0.0 || d.elevation_in_meters < 0);
                if(bad) {
                    console.warn('suspect station data',d);
                }
                return !bad;
            });
            console.log(data);
            draw();
        });
    };
}]);