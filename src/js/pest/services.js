/**
 * @ngdoc overview
 * @name npn-viz-tool.pest-services
 * @description
 *
 * Service support for pest map visualization.
 */
angular.module('npn-viz-tool.pest-services',[
])
/**
 * @ngdoc directive
 * @restrict E
 * @name npn-viz-tool.pest-services:map-vis-layer-control
 * @module npn-viz-tool.pest-services
 * @description
 *
 * Directive to control categorized selection of WMS layers.  This directive
 * shares the parent scope.
 */
.directive('pestLayerControl',['$log',function($log){
    return {
        restrict: 'E',
        templateUrl: 'js/pest/layer-control.html',
        link: function($scope) {
        }
    };
}])