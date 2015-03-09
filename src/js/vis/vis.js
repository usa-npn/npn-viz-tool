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
            i = 0;
        angular.forEach($scope.toPlot,function(tp) {
            params['species_id['+i+']'] = tp.species_id;
            params['phenophase_id['+(i++)+']'] = tp.phenophase_id;
        });
        $http.get('/npn_portal/observations/getSummarizedData.json',{params:params}).success(function(data){
            console.log(data);
        });
    };
}]);