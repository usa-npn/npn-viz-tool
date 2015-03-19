angular.module('templates-npnvis', ['js/calendar/calendar.html', 'js/filter/dateFilterTag.html', 'js/filter/filterControl.html', 'js/filter/filterTags.html', 'js/filter/speciesFilterTag.html', 'js/layers/layerControl.html', 'js/map/map.html', 'js/scatter/scatter.html', 'js/settings/settingsControl.html', 'js/toolbar/tool.html', 'js/toolbar/toolbar.html', 'js/vis/visControl.html', 'js/vis/visDialog.html']);

angular.module("js/calendar/calendar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/calendar/calendar.html",
    "<vis-dialog title=\"Calendar\" modal=\"modal\">\n" +
    "<form class=\"form-inline plot-criteria-form\">\n" +
    "    <div class=\"form-group\" ng-if=\"!selection.start_year\">\n" +
    "        <label for=\"yearsInput\">Starting Year</label>\n" +
    "        <select name=\"yearsInput\" class=\"form-control\" ng-model=\"selection.start_year\" ng-options=\"year for year in availableYears\"></select>\n" +
    "    </div>\n" +
    "    <div class=\"form-group animated-show-hide\" ng-if=\"selection.start_year\">\n" +
    "        <label for=\"toPlotInput\">Species/Phenophase Pairs</label>\n" +
    "        <select name=\"toPlotInput\" class=\"form-control\" ng-model=\"selection.toPlot\" ng-options=\"o.phenophase_name group by (o|speciesTitle) for o in plottable\"></select>\n" +
    "        <div class=\"btn-group\" dropdown is-open=\"selection.color_isopen\">\n" +
    "          <button type=\"button\" class=\"btn btn-default dropdown-toggle\" dropdown-toggle style=\"background-color: {{colorScale(selection.color)}};\">\n" +
    "            &nbsp; <span class=\"caret\"></span>\n" +
    "          </button>\n" +
    "          <ul class=\"dropdown-menu\" role=\"menu\">\n" +
    "            <li ng-repeat=\"i in colors track by $index\" style=\"background-color: {{colorScale($index)}};\"><a href ng-click=\"selection.color=$index;\">&nbsp;</a></li>\n" +
    "          </ul>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <button class=\"btn btn-default\" ng-click=\"addToPlot()\" ng-disabled=\"!canAddToPlot()\"><i class=\"fa fa-plus\"></i></button>\n" +
    "</form>\n" +
    "\n" +
    "<div class=\"panel panel-default main-vis-panel\" >\n" +
    "    <div class=\"panel-body\">\n" +
    "        <center>\n" +
    "        <ul class=\"date-range list-inline animated-show-hide\">\n" +
    "            <li>{{selection.start_year}}</li>\n" +
    "            <li>-</li>\n" +
    "            <li>{{selection.end_year}}</li>\n" +
    "        </ul>\n" +
    "        <ul class=\"to-plot list-inline animated-show-hide\" ng-if=\"toPlot.length\">\n" +
    "            <li class=\"criteria\" ng-repeat=\"tp in toPlot\">{{tp|speciesTitle}}/{{tp.phenophase_name}} <i style=\"color: {{colorScale(tp.color)}};\" class=\"fa fa-circle\"></i>\n" +
    "                <a href ng-click=\"removeFromPlot($index)\"><i class=\"fa fa-times-circle-o\"></i></a>\n" +
    "            </li>\n" +
    "            <li ng-if=\"!data\"><button class=\"btn btn-default\" ng-click=\"visualize()\">Visualize</button></li>\n" +
    "        </ul>\n" +
    "        <div id=\"vis-container\">\n" +
    "            <div id=\"vis-working\" ng-show=\"working\"><i class=\"fa fa-circle-o-notch fa-spin fa-5x\"></i></div>\n" +
    "            <svg class=\"chart\"></svg>\n" +
    "        </div>\n" +
    "        </center>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<pre ng-if=\"record\">{{record | json}}</pre>\n" +
    "\n" +
    "</vis-dialog>");
}]);

angular.module("js/filter/dateFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/dateFilterTag.html",
    "<div class=\"btn-group\">\n" +
    "    <button class=\"btn btn-default\" disabled>\n" +
    "        {{arg.arg.start_date}} - {{arg.arg.end_date}} <span class=\"badge\">{{counts | speciesBadge:badgeFormat}}</span>\n" +
    "    </button>\n" +
    "    <button class=\"btn btn-default\" ng-click=\"removeFromFilter(arg)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </button>\n" +
    "</div>");
}]);

angular.module("js/filter/filterControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/filterControl.html",
    "<a class=\"btn btn-default\" id=\"filter-placebo\" href ng-click=\"$parent.close()\" ng-disabled=\"!filterHasSufficientCriteria()\">Execute Filter <i class=\"fa fa-search\"></i></a>\n" +
    "\n" +
    "<ul class=\"list-unstyled\">\n" +
    "    <li>\n" +
    "        <label for=\"yearInputForm\">Years (at most ten)</label>\n" +
    "        <form id=\"yearInputForm\" name=\"yearInputForm\">\n" +
    "        <input id=\"start_date\" type=\"number\" class=\"form-control\"\n" +
    "               max=\"{{selected.date.end_date || thisYear}}\"\n" +
    "               ng-model=\"selected.date.start_date\"\n" +
    "               typeahead=\"year for year in validYears | lte:selected.date.end_date | filter:$viewValue\"\n" +
    "               required placeholder=\"From\" /> - \n" +
    "        <input id=\"end_date\" type=\"number\" class=\"form-control\"\n" +
    "                min=\"{{selected.date.start_date || 1900}}\"\n" +
    "                ng-model=\"selected.date.end_date\"\n" +
    "                typeahead=\"year for year in validYears | gte:selected.date.start_date | filter:$viewValue\"\n" +
    "                required placeholder=\"To\" />\n" +
    "        <button class=\"btn btn-default\"\n" +
    "                ng-disabled=\"yearInputForm.$invalid || ((selected.date.end_date - selected.date.start_date) > 10)\"\n" +
    "                ng-click=\"addDateRangeToFilter()\"><i class=\"fa fa-plus\"></i></button>\n" +
    "        </form>\n" +
    "        <p ng-if=\"selected.date.start_date < 2008\" class=\"disclaimer\">\n" +
    "            You have selected a starting year prior to 2008 when the contemprary phenology data begins.  Prior to 2008 there is\n" +
    "            a much more limited set of historical data and a limited number of species (E.g. lilac and honeysuckle).\n" +
    "        </p>\n" +
    "    </li>\n" +
    "    <li class=\"divider\" ng-if=\"filterHasDate()\"></li>\n" +
    "    <li ng-if=\"filterHasDate()\">\n" +
    "        <label for=\"species\">Species</label>\n" +
    "        <input id=\"species\"\n" +
    "               type=\"text\" class=\"form-control\"\n" +
    "               placeholder=\"Add Species To Filter\"\n" +
    "               typeahead=\"sp as sp.$display for sp in findSpecies()  | filter:{common_name:$viewValue} | limitTo:15\"\n" +
    "               typeahead-loading=\"findingSpecies\"\n" +
    "               ng-model=\"selected.addSpecies\"\n" +
    "               ng-disabled=\"findSpeciesParamsEmpty\" />\n" +
    "        <button class=\"btn btn-default\" ng-disabled=\"!selected.speciesToAdd\"\n" +
    "                ng-click=\"addSpeciesToFilter(selected.speciesToAdd)\">\n" +
    "            <i class=\"fa\" ng-class=\"{'fa-refresh fa-spin': findingSpecies, 'fa-plus': !findingSpecies}\"></i>\n" +
    "        </button>\n" +
    "    </li>\n" +
    "    <li ng-if=\"filterHasDate()\">\n" +
    "        <label>Animal Types</label>\n" +
    "        <div isteven-multi-select\n" +
    "            max-labels=\"3\"\n" +
    "            input-model=\"animalTypes\"\n" +
    "            output-model=\"speciesInput.animals\"\n" +
    "            button-label=\"species_type\"\n" +
    "            item-label=\"species_type\"\n" +
    "            tick-property=\"selected\"\n" +
    "            orientation=\"horizontal\"\n" +
    "            helper-elements=\"all none reset filter\"></div>\n" +
    "    </li>\n" +
    "    <li ng-if=\"filterHasDate()\">\n" +
    "        <label>Plant Types</label>\n" +
    "        <div isteven-multi-select\n" +
    "            max-labels=\"3\"\n" +
    "            input-model=\"plantTypes\"\n" +
    "            output-model=\"speciesInput.plants\"\n" +
    "            button-label=\"species_type\"\n" +
    "            item-label=\"species_type\"\n" +
    "            tick-property=\"selected\"\n" +
    "            orientation=\"horizontal\"\n" +
    "            helper-elements=\"all none reset filter\"></div>\n" +
    "    </li>\n" +
    "    <li ng-if=\"filterHasDate()\">\n" +
    "        <label>Partners</label>\n" +
    "        <div isteven-multi-select\n" +
    "            max-labels=\"3\"\n" +
    "            input-model=\"partners\"\n" +
    "            output-model=\"speciesInput.networks\"\n" +
    "            button-label=\"network_name\"\n" +
    "            item-label=\"network_name\"\n" +
    "            tick-property=\"selected\"\n" +
    "            orientation=\"horizontal\"\n" +
    "            helper-elements=\"all none reset filter\"></div>\n" +
    "    </li>\n" +
    "</ul>\n" +
    "");
}]);

angular.module("js/filter/filterTags.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/filterTags.html",
    "<ul class=\"list-inline filter-tags\">\n" +
    "    <li ng-repeat=\"s in getFilter().getSpeciesArgs()\"><species-filter-tag arg=\"s\"></species-filter-tag></li>\n" +
    "    <li ng-if=\"(date = getFilter().getDateArg())\"><date-filter-tag arg=\"date\"></date-filter-tag></li>\n" +
    "</ul>");
}]);

angular.module("js/filter/speciesFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/speciesFilterTag.html",
    "<div class=\"btn-group filter-tag\" ng-class=\"{open: status.isopen}\">\n" +
    "    <button type=\"button\" class=\"btn btn-primary\" style=\"background-color: {{arg.color}};\" ng-disabled=\"!arg.phenophases\" ng-click=\"status.isopen = !status.isopen\">\n" +
    "        {{arg.arg | speciesTitle:titleFormat}} <span class=\"badge\">{{arg.counts | speciesBadge:badgeFormat}}</span> <span class=\"caret\"></span>\n" +
    "    </button>\n" +
    "    <ul class=\"dropdown-menu phenophase-list\" role=\"menu\">\n" +
    "        <li class=\"inline\">Select <a href ng-click=\"selectAll(true)\">all</a> <a href ng-click=\"selectAll(false)\">none</a></li>\n" +
    "        <li class=\"divider\"></li>\n" +
    "        <li ng-repeat=\"phenophase in arg.phenophases\">\n" +
    "            <input type=\"checkbox\" ng-model=\"phenophase.selected\"> <span class=\"badge\">{{phenophase.count}}</span> {{phenophase.phenophase_name}}\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "    <button class=\"btn btn-primary\" style=\"background-color: {{arg.color}};\" ng-click=\"removeFromFilter(arg)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </button>\n" +
    "</div>");
}]);

angular.module("js/layers/layerControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/layers/layerControl.html",
    "<ul class=\"list-unstyled\">\n" +
    "    <li><input type=\"radio\" id=\"layer-none\" ng-model=\"layerOnMap.layer\" value=\"none\"/> <label for=\"layer-none\">None</label></li>\n" +
    "    <li ng-repeat=\"layer in layers\">\n" +
    "        <input type=\"radio\" id=\"layer-{{layer.id}}\" ng-model=\"layerOnMap.layer\" ng-value=\"layer\"/> <label for=\"layer-{{layer.id}}\">{{layer.label}}</label>\n" +
    "        <span ng-if=\"layer.source\">(<a href=\"{{layer.source}}\" target=\"_blank\">Source</a>)</span>\n" +
    "        <span ng-if=\"layer.img\">\n" +
    "            <a ng-if=\"layer.link\" href=\"{{layer.link}}\" target=\"_blank\"><img ng-src=\"{{layer.img}}\" /></a>\n" +
    "            <img ng-if=\"!layer.link\" ng-src=\"{{layer.img}}\" />\n" +
    "        </span>\n" +
    "    </li>\n" +
    "</ul>");
}]);

angular.module("js/map/map.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/map/map.html",
    "<a title=\"Reset\" href id=\"reset-control\" class=\"btn btn-default btn-xs\" ng-click=\"reset()\"><i class=\"fa fa-refresh\"></i></a>\n" +
    "\n" +
    "<npn-working></npn-working>\n" +
    "\n" +
    "<ui-gmap-google-map ng-if=\"map\" center='map.center' zoom='map.zoom' options=\"map.options\">\n" +
    "    <npn-stations ng-if=\"stationView\"></npn-stations>\n" +
    "    <npn-filter-results></npn-filter-results>\n" +
    "</ui-gmap-google-map>\n" +
    "\n" +
    "<share-control></share-control>\n" +
    "<filter-tags></filter-tags>\n" +
    "\n" +
    "<toolbar>\n" +
    "    <tool id=\"filter\" icon=\"fa-search\" title=\"Filter\">\n" +
    "        <filter-control></filter-control>\n" +
    "    </tool>\n" +
    "    <tool id=\"layers\" icon=\"fa-bars\" title=\"Layers\">\n" +
    "        <layer-control></layer-control>\n" +
    "    </tool>\n" +
    "    <tool id=\"visualizations\" icon=\"fa-bar-chart\" title=\"Visualizations\">\n" +
    "        <vis-control></vis-control>\n" +
    "    </tool>\n" +
    "    <tool id=\"settings\" icon=\"fa-cog\" title=\"Settings\">\n" +
    "        <settings-control></settings-control>\n" +
    "    </tool>\n" +
    "</toolbar>");
}]);

angular.module("js/scatter/scatter.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/scatter/scatter.html",
    "<vis-dialog title=\"Scatter Plot\" modal=\"modal\">\n" +
    "<form class=\"form-inline plot-criteria-form\">\n" +
    "    <div class=\"form-group\">\n" +
    "        <label for=\"toPlotInput\">Species/Phenophase Pairs (at most three)</label>\n" +
    "        <select name=\"toPlotInput\" class=\"form-control\" ng-model=\"selection.toPlot\" ng-options=\"o.phenophase_name group by (o|speciesTitle) for o in plottable\"></select>\n" +
    "        <div class=\"btn-group\" dropdown is-open=\"selection.color_isopen\">\n" +
    "          <button type=\"button\" class=\"btn btn-default dropdown-toggle\" dropdown-toggle style=\"background-color: {{colorScale(selection.color)}};\">\n" +
    "            &nbsp; <span class=\"caret\"></span>\n" +
    "          </button>\n" +
    "          <ul class=\"dropdown-menu\" role=\"menu\">\n" +
    "            <li ng-repeat=\"i in colors track by $index\" style=\"background-color: {{colorScale($index)}};\"><a href ng-click=\"selection.color=$index;\">&nbsp;</a></li>\n" +
    "          </ul>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <button class=\"btn btn-default\" ng-click=\"addToPlot()\" ng-disabled=\"!canAddToPlot()\"><i class=\"fa fa-plus\"></i></button>\n" +
    "</form>\n" +
    "\n" +
    "<div class=\"panel panel-default main-vis-panel\" >\n" +
    "    <div class=\"panel-body\">\n" +
    "        <center>\n" +
    "        <ul class=\"to-plot list-inline animated-show-hide\" ng-if=\"toPlot.length\">\n" +
    "            <li class=\"criteria\" ng-repeat=\"tp in toPlot\">{{tp|speciesTitle}}/{{tp.phenophase_name}} <i style=\"color: {{colorScale(tp.color)}};\" class=\"fa fa-circle\"></i>\n" +
    "                <a href ng-click=\"removeFromPlot($index)\"><i class=\"fa fa-times-circle-o\"></i></a>\n" +
    "            </li>\n" +
    "            <li>\n" +
    "                <select class=\"form-control vis-axis\" ng-model=\"selection.axis\" ng-options=\"o as o.label for o in axis\"></select>\n" +
    "            </li>\n" +
    "            <li>\n" +
    "                <label for=\"fitLinesInput\">Fit Line{{toPlot.length > 1 ? 's' : ''}}</label>\n" +
    "                <input type=\"checkbox\" id=\"fitLinesInput\" ng-model=\"selection.regressionLines\" />\n" +
    "            </li>\n" +
    "            <li ng-if=\"!data\"><button class=\"btn btn-default\" ng-click=\"visualize()\">Visualize</button></li>\n" +
    "        </ul>\n" +
    "        <div id=\"vis-container\">\n" +
    "            <div id=\"vis-working\" ng-show=\"working\"><i class=\"fa fa-circle-o-notch fa-spin fa-5x\"></i></div>\n" +
    "            <svg class=\"chart\"></svg>\n" +
    "            <div ng-if=\"filteredDisclaimer\" class=\"filter-disclaimer\">Some selected data points have been filtered out from this visualization for quality assurance purposes.</div>\n" +
    "        </div>\n" +
    "        </center>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<pre ng-if=\"record\">{{record | json}}</pre>\n" +
    "\n" +
    "</vis-dialog>");
}]);

angular.module("js/settings/settingsControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/settings/settingsControl.html",
    "<ul class=\"list-unstyled\">\n" +
    "    <li>\n" +
    "        <Label for=\"clusterMarkersSetting\">Cluster Markers</label>\n" +
    "        <ul class=\"list-unstyled\">\n" +
    "            <li ng-repeat=\"option in [true,false]\">\n" +
    "                <input type=\"radio\" id=\"clusterMarkers{{option}}\" ng-model=\"settings.clusterMarkers.value\"\n" +
    "                       ng-value=\"{{option}}\" /> <label for=\"clusterMarkers{{option}}\">{{option | yesNo}}</label>\n" +
    "            </li>\n" +
    "        </ul>\n" +
    "    </li>\n" +
    "    <li class=\"divider\"></li>\n" +
    "    <li>\n" +
    "        <label>Species Badge Contents</label>\n" +
    "        <ul class=\"list-unstyled\">\n" +
    "            <li ng-repeat=\"option in settings.tagBadgeFormat.options\">\n" +
    "                <input type=\"radio\"\n" +
    "                       id=\"{{option.value}}\" ng-model=\"settings.tagBadgeFormat.value\"\n" +
    "                       value=\"{{option.value}}\"> <label for=\"{{option.value}}\">{{option.label}}</label>\n" +
    "            </li>\n" +
    "        </ul>\n" +
    "\n" +
    "    </li>\n" +
    "    <li class=\"divider\"></li>\n" +
    "    <li>\n" +
    "        <label>Species Tag Title</label>\n" +
    "        <ul class=\"list-unstyled\">\n" +
    "            <li ng-repeat=\"option in settings.tagSpeciesTitle.options\">\n" +
    "                <input type=\"radio\"\n" +
    "                       id=\"{{option.value}}\" ng-model=\"settings.tagSpeciesTitle.value\"\n" +
    "                       value=\"{{option.value}}\"> <label for=\"{{option.value}}\">{{option.label}}</label>\n" +
    "            </li>\n" +
    "        </ul>\n" +
    "\n" +
    "    </li>\n" +
    "</ul>");
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

angular.module("js/vis/visControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/vis/visControl.html",
    "<ul class=\"list-unstyled\">\n" +
    "    <li ng-repeat=\"vis in visualizations\">\n" +
    "        <a href ng-click=\"open(vis)\">{{vis.title}}</a>\n" +
    "        <p>{{vis.description}}</p>\n" +
    "    </li>\n" +
    "</ul>");
}]);

angular.module("js/vis/visDialog.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/vis/visDialog.html",
    "<div class=\"modal-header\">\n" +
    "    <a href class=\"modal-dismiss\" ng-click=\"modal.dismiss()\"><i class=\"fa fa-times-circle-o fa-2x\"></i></a>\n" +
    "    <h3 class=\"modal-title\">{{title}}</h3>\n" +
    "</div>\n" +
    "<div class=\"modal-body vis-dialog {{title | cssClassify}}\" ng-transclude>\n" +
    "</div>");
}]);
