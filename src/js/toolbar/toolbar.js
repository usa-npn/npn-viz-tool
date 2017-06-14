angular.module('npn-viz-tool.toolbar',[
  'npn-viz-tool.help'
])
.directive('toolbar', ['$rootScope','$timeout','HelpService',function($rootScope,$timeout,HelpService) {
  return {
    restrict: 'E',
    templateUrl: 'js/toolbar/toolbar.html',
    transclude: true,
    scope: {},
    controller: ['$scope',function($scope) {
      var tools = $scope.tools = [];
      function broadcastChange(t) {
        $rootScope.$broadcast('tool-'+(t.selected ? 'open' : 'close'),{
          tool: t
        });
        if(t.selected) {
            // in case toolbars contain sliders force them to re-layout
            $timeout(function(){
                $rootScope.$broadcast('rzSliderForceRender');
            },500);
        }
      }
      $scope.select = function(t) {
        t.selected = !t.selected;
        $scope.open = t.selected;
        HelpService.stopLookingAtMe('#toolbar-icon-'+t.id); // mixing view/controller logic :-(
        broadcastChange(t);
      };
      this.addTool = function(t) {
        tools.push(t);
      };
      this.closeTool = function(t) {
        $scope.open = t.selected = false;
        broadcastChange(t);
      };
    }]
  };
}])
.directive('tool', [function() {
  return {
    restrict: 'E',
    require: '^toolbar',
    templateUrl: 'js/toolbar/tool.html',
    transclude: true,
    scope: {
      id: '@',
      title: '@',
      icon: '@'
    },
    link: function(scope, element, attrs, tabsCtrl) {
      tabsCtrl.addTool(scope);
      scope.close = function() {
        tabsCtrl.closeTool(scope);
      };
    }
  };
}]);
