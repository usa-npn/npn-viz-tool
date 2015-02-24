angular.module('templates-npnvis', ['js/filter/dateFilterTag.html', 'js/filter/filter.html', 'js/filter/filterTags.html', 'js/filter/speciesFilterTag.html', 'js/map/map.html', 'js/toolbar/tool.html', 'js/toolbar/toolbar.html']);

angular.module("js/filter/dateFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/dateFilterTag.html",
    "<div class=\"btn-group\">\n" +
    "    <button class=\"btn btn-default\" disabled>\n" +
    "        {{item.start_date}} - {{item.end_date}}\n" +
    "    </button>\n" +
    "    <button class=\"btn btn-default\" ng-click=\"removeFromFilter(item)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </button>\n" +
    "</div>");
}]);

angular.module("js/filter/filter.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/filter.html",
    "<ul class=\"list-unstyled\">\n" +
    "    <li>\n" +
    "        <label for=\"species\">Species</label>\n" +
    "        <input id=\"species\"\n" +
    "               type=\"text\" class=\"form-control\"\n" +
    "               placeholder=\"Add Species To Filter\"\n" +
    "               typeahead=\"sp as sp.$display for sp in findSpecies()  | filter:{common_name:$viewValue}\"\n" +
    "               typeahead-loading=\"findingSpecies\"\n" +
    "               ng-model=\"selected.addSpecies\"\n" +
    "               ng-disabled=\"findSpeciesParamsEmpty\" />\n" +
    "        <button class=\"btn btn-default\" ng-disabled=\"!selected.speciesToAdd\"\n" +
    "                ng-click=\"addSpeciesToFilter(selected.speciesToAdd)\">\n" +
    "            <i class=\"fa\" ng-class=\"{'fa-refresh fa-spin': findingSpecies, 'fa-plus': !findingSpecies}\"></i>\n" +
    "        </button>\n" +
    "    </li>\n" +
    "    <li>\n" +
    "        <label>Animal Types</label>\n" +
    "        <div isteven-multi-select\n" +
    "            max-labels=\"3\"\n" +
    "            input-model=\"animalTypes\"\n" +
    "            output-model=\"animals\"\n" +
    "            button-label=\"species_type\"\n" +
    "            item-label=\"species_type\"\n" +
    "            tick-property=\"selected\"\n" +
    "            orientation=\"horizontal\"\n" +
    "            helper-elements=\"all none reset filter\"></div>\n" +
    "    </li>\n" +
    "    <li>\n" +
    "        <label>Plant Types</label>\n" +
    "        <div isteven-multi-select\n" +
    "            max-labels=\"3\"\n" +
    "            input-model=\"plantTypes\"\n" +
    "            output-model=\"plants\"\n" +
    "            button-label=\"species_type\"\n" +
    "            item-label=\"species_type\"\n" +
    "            tick-property=\"selected\"\n" +
    "            orientation=\"horizontal\"\n" +
    "            helper-elements=\"all none reset filter\"></div>\n" +
    "    </li>\n" +
    "    <li>\n" +
    "        <label>Partners</label>\n" +
    "        <div isteven-multi-select\n" +
    "            max-labels=\"1\"\n" +
    "            input-model=\"partners\"\n" +
    "            output-model=\"networks\"\n" +
    "            button-label=\"network_name\"\n" +
    "            item-label=\"network_name\"\n" +
    "            tick-property=\"selected\"\n" +
    "            orientation=\"horizontal\"\n" +
    "            selection-mode=\"single\"></div>\n" +
    "    </li>\n" +
    "    <li class=\"divider\"></li>\n" +
    "    <li>\n" +
    "        <label for=\"yearInputForm\">Years (at most two)</label>\n" +
    "        <form id=\"yearInputForm\" name=\"yearInputForm\">\n" +
    "        <input id=\"start_date\" type=\"number\" class=\"form-control\"\n" +
    "               max=\"{{selected.date.end_date || thisYear}}\"\n" +
    "               ng-model=\"selected.date.start_date\"\n" +
    "               typeahead=\"year for year in validYears | lte:selected.date.end_date | filter:$viewValue\"\n" +
    "               required placeholder=\"From\" /> - \n" +
    "        <input id=\"end_date\" type=\"number\" class=\"form-control\"\n" +
    "                min=\"{{selected.date.start_date || 2010}}\"\n" +
    "                ng-model=\"selected.date.end_date\"\n" +
    "                typeahead=\"year for year in validYears | gte:selected.date.start_date | filter:$viewValue\"\n" +
    "                required placeholder=\"To\" />\n" +
    "        <button class=\"btn btn-default\"\n" +
    "                ng-disabled=\"yearInputForm.$invalid || ((selected.date.end_date - selected.date.start_date) > 2) || filterHasDate()\"\n" +
    "                ng-click=\"addDateRangeToFilter()\"><i class=\"fa fa-plus\"></i></button>\n" +
    "        </form>\n" +
    "    </li>\n" +
    "</ul>\n" +
    "");
}]);

angular.module("js/filter/filterTags.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/filterTags.html",
    "<ul class=\"list-inline filter-tags\">\n" +
    "    <li ng-repeat=\"(key, value) in getFilter()\">\n" +
    "        <species-filter-tag ng-if=\"value.species_id\" item=\"value\"></species-filter-tag>\n" +
    "        <date-filter-tag ng-if =\"value.start_date && value.end_date\" item=\"value\"></date-filter-tag>\n" +
    "    </li>\n" +
    "</ul>");
}]);

angular.module("js/filter/speciesFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/speciesFilterTag.html",
    "<div class=\"btn-group filter-tag\" dropdown is-open=\"status.isopen\">\n" +
    "    <button type=\"button\" class=\"btn btn-primary dropdown-toggle\" style=\"background-color: {{item.color}};\" dropdown-toggle ng-disabled=\"!item.phenophases\">\n" +
    "        {{item.common_name}} <span class=\"badge\">?</span> <span class=\"caret\"></span>\n" +
    "    </button>\n" +
    "    <ul class=\"dropdown-menu phenophase-list\" role=\"menu\">\n" +
    "        <li>\n" +
    "            <a href ng-click=\"removeFromFilter(item)\"><i class=\"fa fa-times-circle-o\"> Remove From Filter</i></a>\n" +
    "        </li>\n" +
    "        <li class=\"divider\"></li>\n" +
    "        <li ng-repeat=\"phenophase in item.phenophases\">\n" +
    "            <input type=\"checkbox\" ng-model=\"phenophase.selected\"> {{phenophase.phenophase_name}}\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "</div>");
}]);

angular.module("js/map/map.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/map/map.html",
    "<ui-gmap-google-map ng-if=\"map\" center='map.center' zoom='map.zoom' options=\"map.options\">\n" +
    "    <npn-stations ng-if=\"stationView\"></npn-stations>\n" +
    "</ui-gmap-google-map>\n" +
    "\n" +
    "<filter-tags></filter-tags>\n" +
    "\n" +
    "<toolbar>\n" +
    "    <tool id=\"filter\" icon=\"fa-search\" title=\"Filter\">\n" +
    "        <filter-control></filter-control>\n" +
    "    </tool>\n" +
    "    <tool id=\"layers\" icon=\"fa-bars\" title=\"Layers\">\n" +
    "        layer content\n" +
    "    </tool>\n" +
    "    <tool id=\"visualizations\" icon=\"fa-bar-chart\" title=\"Visualizations\">\n" +
    "        visualization content\n" +
    "    </tool>\n" +
    "    <tool id=\"settings\" icon=\"fa-cog\" title=\"Settings\">\n" +
    "        settings content\n" +
    "    </tool>\n" +
    "</toolbar>");
}]);

angular.module("js/toolbar/tool.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/toolbar/tool.html",
    "<div class=\"tool-content {{title.toLowerCase()}}\" ng-show=\"selected\">\n" +
    "    <h2>{{title}}</h2>\n" +
    "    <div ng-transclude>\n" +
    "    </div>\n" +
    "</div>");
}]);

angular.module("js/toolbar/toolbar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/toolbar/toolbar.html",
    "<div class=\"toolbar\">\n" +
    "  <ul class=\"tools-list\">\n" +
    "    <li ng-repeat=\"t in tools\" ng-class=\"{open: t.selected}\"\n" +
    "        popover-placement=\"right\" popover=\"{{t.title}}\" popover-trigger=\"mouseenter\" popover-popup-delay=\"1000\"\n" +
    "        ng-click=\"select(t)\">\n" +
    "      <i class=\"fa {{t.icon}}\"></i>\n" +
    "    </li>\n" +
    "  </ul>\n" +
    "  <div class=\"toolbar-content\" ng-class=\"{open: open}\" ng-transclude></div>\n" +
    "</div>");
}]);
