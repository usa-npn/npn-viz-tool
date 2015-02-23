angular.module('npn-viz-tool.toolbar',[
])
.directive('toolbar', function() {
  return {
    restrict: 'E',
    templateUrl: 'js/toolbar/toolbar.html',
    transclude: true,
    scope: {},
    controller: function($scope) {
      var tools = $scope.tools = [];

      $scope.select = function(t) {
        t.selected = !t.selected;
        $scope.open = t.selected;
      };

      this.addTool = function(t) {
        /* TEMPORARY when devloping a specific tab
        if(tools.length === 0) {
          $scope.select(t);
        }*/
        tools.push(t);
      };
    }
  };
})
.directive('tool', function() {
  return {
    restrict: 'E',
    require: '^toolbar',
    templateUrl: 'js/toolbar/tool.html',
    transclude: true,
    scope: {
      title: '@',
      icon: '@'
    },
    link: function(scope, element, attrs, tabsCtrl) {
      tabsCtrl.addTool(scope);
    }
  };
});