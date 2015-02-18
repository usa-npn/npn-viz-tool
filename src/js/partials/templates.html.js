angular.module('templates-npnvis', ['js/map/map.html']);

angular.module("js/map/map.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/map/map.html",
    "<ui-gmap-google-map ng-if=\"map\" center='map.center' zoom='map.zoom' options=\"map.options\">\n" +
    "\n" +
    "</ui-gmap-google-map>\n" +
    "\n" +
    "<npn-viz-layers></npn-viz-layers>");
}]);
