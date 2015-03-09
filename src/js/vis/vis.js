angular.module('npn-viz-tool.vis',[
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'ui.bootstrap'
])
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
.controller('ScatterPlotCtrl',['$scope','$modalInstance','$http','FilterService',function($scope,$modalInstance,$http,FilterService){
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
    $scope.addToPlot = function() {
        if($scope.selection.toPlot) {
            $scope.toPlot.push(getNewToPlot());
            $scope.selection.color++;
        }
    };
    $scope.removeFromPlot = function(idx) {
        $scope.toPlot.splice(idx,1);
    };
    $scope.visualize = function() {
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
        $http.get('/npn_portal/observations/getSummarizedData.json',{params:params}).success(function(data){
            var start_year = dateArg.arg.start_date,
                end_year = dateArg.arg.end_date,
                i;
            data.forEach(function(d,i){
                d.id = i;
                d.latitude = parseFloat(d.latitude);
                d.longitude = parseFloat(d.longitude);
                d.elevation_in_meters = parseInt(d.elevation_in_meters);
                d.first_yes_year = parseInt(d.first_yes_year);
                d.first_yes_doy = parseInt(d.first_yes_doy);
                // this is the day # that will get plotted 1 being the first day of the start_year
                // 366 being the first day of start_year+1, etc.
                d.day_in_range = ((d.first_yes_year-start_year)*365)+d.first_yes_doy;
            });
            console.log(data);

            var npn = {
                    CHART_W: 930,
                    CHART_H: 500
                },
                margin = {top: 20, right: 30, bottom: 60, left: 40},
                width = npn.CHART_W - margin.left - margin.right,
                height = npn.CHART_H - margin.top - margin.bottom;


            function dataId(d) { return d.id; }
            function xData(d) { return d[$scope.selection.axis]; }
            var x = d3.scale.linear()
                .range([0,width])
                .domain([ d3.min(data,xData),d3.max(data,xData)]);

            var yDomain = [],yDomainMax = (((end_year-start_year)+1)*365);
            for(i = 1; i <= yDomainMax; i++) { yDomain.push(i); }

/*
            var y = d3.scale.ordinal()
                .range([height,0])
                .domain(yDomain);
            console.log('y.domain()',y.domain());
            */
           var y = d3.scale.linear()
               .range([height,0])
               .domain([1,yDomainMax]);

            var xAxis = d3.svg.axis()
                .scale(x)
                .orient('bottom');

            var yAxis = d3.svg.axis()
                .scale(y)
                .orient('left');
/*
                .tickValues(y.domain().filter(function(d,i) {
                    if(d === 1 || (d%365) === 0) {
                        console.log('yTick',d);
                        return true;
                    }
                    return false;
                }));*/

            var chart = d3.select('.chart')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
              .append('g')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

              chart.append('g')
                  .attr('class', 'x axis')
                  .attr('transform', 'translate(0,' + height + ')')
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

            var circles = chart.selectAll('.circle').data(data,dataId);
                circles.exit().remove();
                circles.enter().append('circle')
                  .attr('class', 'circle');

                circles.attr('cx', function(d) { return x(d[$scope.selection.axis]); })
                  .attr('cy', function(d) { return y(d.day_in_range); })
                  .attr('r', '5')
                  .attr('fill',function(d) { return $scope.colorScale(colorMap[d.species_id+'.'+d.phenophase_id]); });
                  /*
                  .append('title')
                  .text(function(d) { return '"'+d.station_name+'" '+d.count+' observations @ '+d.distance.miles+' Miles from equator ('+d.name+').'; });*/
/*
              chart.selectAll(".bar")
                  .data(data)
                .enter().append("rect")
                  .attr("class", "bar")
                  .attr("x", function(d) { return x(d.name); })
                  .attr("y", function(d) { return y(d.value); })
                  .attr("height", function(d) { return height - y(d.value); })
                  .attr("width", x.rangeBand());
              },100);
*/
        });
    };
}]);