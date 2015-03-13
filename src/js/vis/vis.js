angular.module('npn-viz-tool.vis',[
    'npn-viz-tool.filter',
    'npn-viz-tool.filters',
    'npn-viz-tool.vis-scatter',
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
        },
        leastSquares: function(xSeries,ySeries) {
            var reduceSumFunc = function(prev, cur) { return prev + cur; };

            var xBar = xSeries.reduce(reduceSumFunc) * 1.0 / xSeries.length;
            var yBar = ySeries.reduce(reduceSumFunc) * 1.0 / ySeries.length;

            var ssXX = xSeries.map(function(d) { return Math.pow(d - xBar, 2); })
                .reduce(reduceSumFunc);

            var ssYY = ySeries.map(function(d) { return Math.pow(d - yBar, 2); })
                .reduce(reduceSumFunc);

            var ssXY = xSeries.map(function(d, i) { return (d - xBar) * (ySeries[i] - yBar); })
                .reduce(reduceSumFunc);

            var slope = ssXY / ssXX;
            var intercept = yBar - (xBar * slope);
            var rSquare = Math.pow(ssXY, 2) / (ssXX * ssYY);

            return [slope, intercept, rSquare];
        },
        approxY: function(leastSquaresCoeff,x) {
            // y = a + bx
            var a = leastSquaresCoeff[1],
                b = leastSquaresCoeff[0];
            return a + (b*x);
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
        template: 'js/scatter/scatterPlot.html',
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
}]);