angular.module('templates-npnvis', ['js/map/map.html', 'js/toolbar/tool.html', 'js/toolbar/toolbar.html']);

angular.module("js/map/map.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/map/map.html",
    "<ui-gmap-google-map ng-if=\"map\" center='map.center' zoom='map.zoom' options=\"map.options\">\n" +
    "    <npn-stations ng-if=\"stationView\"></npn-stations>\n" +
    "</ui-gmap-google-map>\n" +
    "\n" +
    "<toolbar>\n" +
    "    <tool icon=\"fa-search\" title=\"Filter\">\n" +
    "        filter content\n" +
    "    </tool>\n" +
    "    <tool icon=\"fa-bars\" title=\"Layers\">\n" +
    "        layer content\n" +
    "    </tool>\n" +
    "    <tool icon=\"fa-bar-chart\" title=\"Visualizations\">\n" +
    "        visualization content\n" +
    "    </tool>\n" +
    "    <tool icon=\"fa-cog\" title=\"Settings\">\n" +
    "        settings content\n" +
    "    </tool>\n" +
    "</toolbar>");
}]);

angular.module("js/toolbar/tool.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/toolbar/tool.html",
    "<div class=\"tool-content\" ng-show=\"selected\">\n" +
    "    <h2>{{title}}</h2>\n" +
    "    <div ng-transclude>\n" +
    "    </div>\n" +
    "</div>");
}]);

angular.module("js/toolbar/toolbar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/toolbar/toolbar.html",
    "<div class=\"toolbar\">\n" +
    "  <ul>\n" +
    "    <li ng-repeat=\"t in tools\" ng-class=\"{open: t.selected}\"\n" +
    "        popover-placement=\"right\" popover=\"{{t.title}}\" popover-trigger=\"mouseenter\" popover-popup-delay=\"1000\"\n" +
    "        ng-click=\"select(t)\">\n" +
    "      <i class=\"fa {{t.icon}}\"></i>\n" +
    "    </li>\n" +
    "  </ul>\n" +
    "  <div class=\"toolbar-content\" ng-class=\"{open: open}\" ng-transclude></div>\n" +
    "</div>");
}]);
