angular.module('templates-npnvis', ['js/map/map.html', 'js/toolbar/tool.html', 'js/toolbar/toolbar.html']);

angular.module("js/map/map.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/map/map.html",
    "<ui-gmap-google-map ng-if=\"map\" center='map.center' zoom='map.zoom' options=\"map.options\">\n" +
    "    <npn-stations ng-if=\"stationView\"></npn-stations>\n" +
    "</ui-gmap-google-map>\n" +
    "\n" +
    "");
}]);

angular.module("js/toolbar/tool.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/toolbar/tool.html",
    "<div class=\"tab-pane\" ng-show=\"selected\" ng-transclude>\n" +
    "</div>");
}]);

angular.module("js/toolbar/toolbar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/toolbar/toolbar.html",
    "<div class=\"toolbar\">\n" +
    "  <ul>\n" +
    "    <li ng-repeat=\"t in tools\" ng-class=\"{open: t.selected}\">\n" +
    "      <a href ng-click=\"select(t)\" tooltip-placement=\"right\" tooltip=\"{{t.tt}}\" tooltip-trigger=\"mouseenter\"><i class=\"fa {{t.icon}}\"></i></a>\n" +
    "    </li>\n" +
    "  </ul>\n" +
    "  <div class=\"toolbar-content\" ng-class=\"{open: open}\" ng-transclude></div>\n" +
    "</div>");
}]);
