angular.module('templates-npnvis', ['js/calendar/calendar.html', 'js/filter/choroplethInfo.html', 'js/filter/dateFilterTag.html', 'js/filter/filterControl.html', 'js/filter/filterTags.html', 'js/filter/networkFilterTag.html', 'js/filter/speciesFilterTag.html', 'js/layers/layerControl.html', 'js/map/map.html', 'js/mapvis/date-control.html', 'js/mapvis/doy-control.html', 'js/mapvis/filter-tags.html', 'js/mapvis/in-situ-control.html', 'js/mapvis/layer-control.html', 'js/mapvis/legend.html', 'js/mapvis/mapvis.html', 'js/mapvis/year-control.html', 'js/scatter/scatter.html', 'js/settings/settingsControl.html', 'js/toolbar/tool.html', 'js/toolbar/toolbar.html', 'js/vis/visControl.html', 'js/vis/visDialog.html', 'js/vis/visDownload.html']);

angular.module("js/calendar/calendar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/calendar/calendar.html",
    "<vis-dialog title=\"Calendar\" modal=\"modal\">\n" +
    "<form class=\"form-inline plot-criteria-form\">\n" +
    "    <div class=\"form-group\">\n" +
    "        <label for=\"yearsOneInput\">Select up to two years</label>\n" +
    "        <input id=\"yearsOneInput\" type=\"number\" class=\"form-control\"\n" +
    "               ng-model=\"selection.year\"\n" +
    "               uib-typeahead=\"year for year in validYears | filter:$viewValue\"\n" +
    "               required placeholder=\"Year\" />\n" +
    "        <button class=\"btn btn-default\" ng-click=\"addYear()\" ng-disabled=\"!canAddYear()\"><i class=\"fa fa-plus\"></i></button>\n" +
    "    </div>\n" +
    "    <div class=\"form-group animated-show-hide\">\n" +
    "        <label for=\"speciesInput\">Species phenophase combinations</label>\n" +
    "        <select name=\"speciesInput\" class=\"form-control\" ng-model=\"selection.species\" ng-options=\"(o|speciesTitle) for o in speciesList\"></select>\n" +
    "        <select name=\"phenophaseInput\" class=\"form-control\" ng-model=\"selection.phenophase\" ng-options=\"o.phenophase_name for o in phenophaseList\"></select>\n" +
    "        <div class=\"btn-group\" uib-dropdown is-open=\"selection.color_isopen\">\n" +
    "          <button type=\"button\" class=\"btn btn-default dropdown-toggle\" uib-dropdown-toggle style=\"background-color: {{colorRange[selection.color]}};\">\n" +
    "            &nbsp; <span class=\"caret\"></span>\n" +
    "          </button>\n" +
    "          <ul class=\"dropdown-menu\" role=\"menu\">\n" +
    "            <li ng-repeat=\"i in colors track by $index\" style=\"background-color: {{colorRange[$index]}};\"><a href ng-click=\"selection.color=$index;\">&nbsp;</a></li>\n" +
    "          </ul>\n" +
    "        </div>\n" +
    "        <button class=\"btn btn-default\" ng-click=\"addToPlot()\" ng-disabled=\"!canAddToPlot()\"><i class=\"fa fa-plus\"></i></button>\n" +
    "    </div>\n" +
    "</form>\n" +
    "\n" +
    "<div class=\"panel panel-default main-vis-panel\" >\n" +
    "    <div class=\"panel-body\">\n" +
    "        <center ng-if=\"error_message\"><p class=\"text-danger\">{{error_message}}</p></center>\n" +
    "        <center>\n" +
    "        <ul class=\"to-plot list-inline animated-show-hide\" ng-if=\"toPlot.length || toPlotYears.length\">\n" +
    "            <li class=\"criteria\" ng-repeat=\"y in toPlotYears\">{{y}}\n" +
    "                <a href ng-click=\"removeYear($index)\"><i class=\"fa fa-times-circle-o\"></i></a>\n" +
    "            </li>\n" +
    "            <li class=\"criteria\" ng-repeat=\"tp in toPlot\">{{tp|speciesTitle}}/{{tp.phenophase_name}} <i style=\"color: {{colorRange[tp.color]}};\" class=\"fa fa-circle\"></i>\n" +
    "                <a href ng-click=\"removeFromPlot($index)\"><i class=\"fa fa-times-circle-o\"></i></a>\n" +
    "            </li>\n" +
    "            <li ng-if=\"data\">\n" +
    "                <label for=\"negativeInput\">Negative Data</label>\n" +
    "                <input type=\"checkbox\" id=\"negativeInput\" ng-model=\"selection.negative\" />\n" +
    "            </li>\n" +
    "            <li ng-if=\"!data && toPlotYears.length && toPlot.length\"><button class=\"btn btn-primary\" ng-click=\"visualize()\">Visualize</button></li>\n" +
    "        </ul>\n" +
    "        <div id=\"vis-container\">\n" +
    "            <div id=\"vis-working\" ng-show=\"working\"><i class=\"fa fa-circle-o-notch fa-spin fa-5x\"></i></div>\n" +
    "            <div class=\"chart-container\">\n" +
    "                <vis-download ng-if=\"data\"\n" +
    "                              selector=\".chart\"\n" +
    "                              filename=\"npn-calendar.png\"></vis-download>\n" +
    "                <div><svg class=\"chart\"></svg></div>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "        </center>\n" +
    "        <ul class=\"list-inline calendar-chart-controls\" ng-if=\"data\" style=\"float: right;\">\n" +
    "            <li>Label Size\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"decrFontSize()\"><i class=\"fa fa-minus\"></i></a>\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"incrFontSize()\"><i class=\"fa fa-plus\"></i></a>\n" +
    "            </li>\n" +
    "            <li>Label Position\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"yAxisConfig.labelOffset=(yAxisConfig.labelOffset-1)\"><i class=\"fa fa-minus\"></i></a>\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"yAxisConfig.labelOffset=(yAxisConfig.labelOffset+1)\"><i class=\"fa fa-plus\"></i></a>\n" +
    "            </li>\n" +
    "            <li>Band Size\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"incrBandPadding()\" ng-disabled=\"yAxisConfig.bandPadding >= 0.95\"><i class=\"fa fa-minus\"></i></a>\n" +
    "                <a href class=\"btn btn-default btn-xs\" ng-click=\"decrBandPadding()\" ng-disabled=\"yAxisConfig.bandPadding <= 0.05\"><i class=\"fa fa-plus\"></i></a>\n" +
    "            </li>\n" +
    "        </ul>\n" +
    "    </div>\n" +
    "</div>\n" +
    "\n" +
    "</vis-dialog>");
}]);

angular.module("js/filter/choroplethInfo.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/choroplethInfo.html",
    "<div id=\"choroplethHelp\" ng-show=\"show\">\n" +
    "    <h4>{{station_name}}</h4>\n" +
    "    <h5>Record Densit{{data.length == 1 ? 'y' : 'ies'}}</h5>\n" +
    "    <ul class=\"list-unstyled\">\n" +
    "        <li ng-repeat=\"scale in data\">\n" +
    "            <label>{{scale.title}} ({{scale.count}})</label>\n" +
    "            <ul class=\"list-inline color-scale\">\n" +
    "                <li ng-repeat=\"color in scale.colors\" style=\"background-color: {{color}};\" class=\"{{scale.color === color ? 'selected' :''}}\">\n" +
    "                    <div ng-if=\"$first\">{{scale.domain[0]}}</div>\n" +
    "                    <div ng-if=\"$last\">{{scale.domain[1]}}</div>\n" +
    "                </li>\n" +
    "            </ul>\n" +
    "        </li>\n" +
    "    </li>\n" +
    "</div>");
}]);

angular.module("js/filter/dateFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/dateFilterTag.html",
    "<div class=\"btn-group filter-tag date\">\n" +
    "    <a class=\"btn btn-default\">\n" +
    "        <span popover-placement=\"bottom\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "              popover-trigger=\"mouseenter\" uib-popover=\"Indicates the span of time represented on the map\">{{arg.arg.start_date}} - {{arg.arg.end_date}} </span>\n" +
    "        <span class=\"badge\"\n" +
    "              popover-placement=\"bottom\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "              popover-trigger=\"mouseenter\" uib-popover=\"{{badgeTooltip}}\">{{counts | speciesBadge:badgeFormat}}</span>\n" +
    "    </a>\n" +
    "    <a class=\"btn btn-default\" ng-click=\"removeFromFilter(arg)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </a>\n" +
    "</div>");
}]);

angular.module("js/filter/filterControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/filterControl.html",
    "<ul class=\"list-unstyled\">\n" +
    "    <li>\n" +
    "        <label for=\"yearInputForm\">Select up to ten (consecutive) years</label>\n" +
    "        <form id=\"yearInputForm\" name=\"yearInputForm\">\n" +
    "        <input id=\"start_date\" type=\"number\" class=\"form-control\"\n" +
    "               max=\"{{selected.date.end_date || thisYear}}\"\n" +
    "               ng-model=\"selected.date.start_date\"\n" +
    "               uib-typeahead=\"year for year in validYears | lte:selected.date.end_date | filter:$viewValue\"\n" +
    "               required placeholder=\"From\" /> - \n" +
    "        <input id=\"end_date\" type=\"number\" class=\"form-control\"\n" +
    "                min=\"{{selected.date.start_date || 1900}}\"\n" +
    "                ng-model=\"selected.date.end_date\"\n" +
    "                uib-typeahead=\"year for year in validYears | gte:selected.date.start_date | filter:$viewValue\"\n" +
    "                required placeholder=\"To\" />\n" +
    "        <button class=\"btn btn-default\"\n" +
    "                ng-disabled=\"yearInputForm.$invalid || ((selected.date.end_date - selected.date.start_date) > 10)\"\n" +
    "                ng-click=\"addDateRangeToFilter()\"\n" +
    "                popover-placement=\"right\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "                popover-trigger=\"mouseenter\" popover=\"Add this filter to the map\"><i class=\"fa fa-plus\"></i></button>\n" +
    "        </form>\n" +
    "        <p ng-if=\"selected.date.start_date < 2008\" class=\"disclaimer\">\n" +
    "            You have selected a starting year prior to 2008 when the contemprary phenology data begins.  Prior to 2008 there is\n" +
    "            a much more limited set of historical data and a limited number of species (E.g. lilac and honeysuckle).\n" +
    "        </p>\n" +
    "    </li>\n" +
    "    <li class=\"divider\" ng-if=\"filterHasDate()\"></li>\n" +
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
    "            helper-elements=\"all none reset filter\"\n" +
    "            on-close=\"findSpecies()\"></div>\n" +
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
    "            helper-elements=\"all none reset filter\"\n" +
    "            on-close=\"findSpecies()\"></div>\n" +
    "    </li>\n" +
    "    <li ng-if=\"filterHasDate()\">\n" +
    "        <label>Partners</label>\n" +
    "        <div class=\"row\">\n" +
    "            <div class=\"col-xs-9\">\n" +
    "                <div isteven-multi-select\n" +
    "                    max-labels=\"3\"\n" +
    "                    input-model=\"partners\"\n" +
    "                    output-model=\"speciesInput.networks\"\n" +
    "                    button-label=\"network_name\"\n" +
    "                    item-label=\"network_name\"\n" +
    "                    tick-property=\"selected\"\n" +
    "                    orientation=\"horizontal\"\n" +
    "                    helper-elements=\"none reset filter\"\n" +
    "                    on-close=\"findSpecies()\"></div>\n" +
    "            </div>\n" +
    "            <div class=\"col-xs-3\">\n" +
    "                <button id=\"add-networks-button\" class=\"btn btn-default\"\n" +
    "                        ng-disabled=\"!speciesInput.networks.length || networksMaxedOut()\"\n" +
    "                        ng-click=\"addNetworksToFilter()\"\n" +
    "                        popover-placement=\"right\" popover-popup-delay=\"500\"\n" +
    "                        popover-trigger=\"mouseenter\" uib-popover=\"Add this filter to the map\" popover-append-to-body=\"true\">\n" +
    "                    <i class=\"fa fa-plus\"></i>\n" +
    "                </button>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "\n" +
    "    </li>\n" +
    "    <li ng-if=\"filterHasDate()\">\n" +
    "        <label for=\"species\">Species</label>\n" +
    "        <div class=\"row\">\n" +
    "            <div class=\"col-xs-9\">\n" +
    "                <div isteven-multi-select\n" +
    "                    max-labels=\"3\"\n" +
    "                    input-model=\"speciesList\"\n" +
    "                    output-model=\"selected.species\"\n" +
    "                    button-label=\"display\"\n" +
    "                    item-label=\"display\"\n" +
    "                    tick-property=\"selected\"\n" +
    "                    orientation=\"horizontal\"\n" +
    "                    helper-elements=\"none reset filter\"></div>\n" +
    "            </div>\n" +
    "            <div class=\"col-xs-3\">\n" +
    "                <button id=\"add-species-button\" class=\"btn btn-default\"\n" +
    "                        ng-disabled=\"!selected.species.length || speciesMaxedOut()\"\n" +
    "                        ng-click=\"addSpeciesToFilter()\"\n" +
    "                        popover-placement=\"right\" popover-popup-delay=\"500\"\n" +
    "                        popover-trigger=\"mouseenter\" uib-popover=\"Add this filter to the map\" popover-append-to-body=\"true\">\n" +
    "                    <i class=\"fa\" ng-class=\"{'fa-refresh fa-spin': findingSpecies, 'fa-plus': !findingSpecies}\"></i>\n" +
    "                </button>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </li>\n" +
    "    <li ng-if=\"filterHasDate()\" style=\"text-align: right;\">\n" +
    "        <a class=\"btn btn-lg btn-primary\" id=\"filter-placebo\" href ng-click=\"$parent.$parent.close()\" ng-disabled=\"!filterHasSufficientCriteria()\">Execute Filter <i class=\"fa fa-search\"></i></a>\n" +
    "    </li>\n" +
    "</ul>\n" +
    "");
}]);

angular.module("js/filter/filterTags.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/filterTags.html",
    "<ul class=\"list-inline filter-tags\">\n" +
    "    <li ng-repeat=\"s in getFilter().getSpeciesArgs()\"><species-filter-tag arg=\"s\"></species-filter-tag></li>\n" +
    "    <li ng-repeat=\"n in getFilter().getNetworkArgs()\"><network-filter-tag arg=\"n\"></network-filter-tag></li>\n" +
    "    <li ng-if=\"(date = getFilter().getDateArg())\"><date-filter-tag arg=\"date\"></date-filter-tag></li>\n" +
    "</ul>");
}]);

angular.module("js/filter/networkFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/networkFilterTag.html",
    "<div class=\"btn-group filter-tag date\">\n" +
    "    <a class=\"btn btn-default\">\n" +
    "        {{arg.arg.network_name}} \n" +
    "        <span class=\"badge\"\n" +
    "              popover-placement=\"bottom\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "              popover-trigger=\"mouseenter\" uib-popover=\"{{badgeTooltip}}\">{{arg.counts | speciesBadge:badgeFormat}}</span>\n" +
    "    </a>\n" +
    "    <a class=\"btn btn-default\" ng-click=\"removeFromFilter(arg)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </a>\n" +
    "</div>");
}]);

angular.module("js/filter/speciesFilterTag.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/filter/speciesFilterTag.html",
    "<div class=\"btn-group filter-tag\" ng-class=\"{open: status.isopen}\">\n" +
    "    <a class=\"btn btn-primary\" style=\"background-color: {{arg.color}};\" ng-disabled=\"!arg.phenophases\" ng-click=\"status.isopen = !status.isopen\">\n" +
    "        {{arg.arg | speciesTitle:titleFormat}} \n" +
    "        <span class=\"badge\"\n" +
    "              popover-placement=\"bottom\" popover-popup-delay=\"500\" popover-append-to-body=\"true\"\n" +
    "              popover-trigger=\"mouseenter\" uib-popover=\"{{badgeTooltip}}\">{{arg.counts | speciesBadge:badgeFormat}}</span> \n" +
    "        <span class=\"caret\"></span>\n" +
    "    </a>\n" +
    "    <ul class=\"dropdown-menu phenophase-list\" role=\"menu\">\n" +
    "        <li class=\"inline\">Select <a href ng-click=\"selectAll(true)\">all</a> <a href ng-click=\"selectAll(false)\">none</a></li>\n" +
    "        <li class=\"divider\"></li>\n" +
    "        <li ng-repeat=\"phenophase in arg.phenophases | filter:hasCount\">\n" +
    "            <input type=\"checkbox\" ng-model=\"phenophase.selected\"> <span class=\"badge\">{{phenophase.count}}</span> {{phenophase.phenophase_name}}\n" +
    "        </li>\n" +
    "    </ul>\n" +
    "    <a class=\"btn btn-primary\" style=\"background-color: {{arg.color}};\" ng-click=\"removeFromFilter(arg)\">\n" +
    "        <i class=\"fa fa-times-circle-o\"></i>\n" +
    "    </a>\n" +
    "</div>");
}]);

angular.module("js/layers/layerControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/layers/layerControl.html",
    "<p class=\"empty-filter-notes\" ng-if=\"isFilterEmpty()\">\n" +
    "    Before adding a layer to the map you must create and execute a filter.\n" +
    "    A map layer will allow you to filter sites based on the geographic boundaries it defines.\n" +
    "</p>\n" +
    "<ul class=\"list-unstyled\" ng-if=\"!isFilterEmpty()\">\n" +
    "    <li><label ng-class=\"{'selected-layer': layerOnMap.layer === 'none'}\"><a href ng-click=\"layerOnMap.layer='none'\">None</a></label>\n" +
    "        <!--input type=\"radio\" id=\"layer-none\" ng-model=\"layerOnMap.layer\" value=\"none\"/> <label for=\"layer-none\">None</label-->\n" +
    "    </li>\n" +
    "    <li ng-repeat=\"layer in layers\">\n" +
    "        <label  ng-class=\"{'selected-layer': layerOnMap.layer === layer}\">{{layer.label}}</label>\n" +
    "        <a href ng-click=\"layerOnMap.layer=layer\"><img ng-src=\"{{layer.img}}\" /></a>\n" +
    "        <ul class=\"list-inline layer-links\">\n" +
    "            <li ng-if=\"layer.link\"><a href=\"{{layer.link}}\" target=\"_blank\">More Info</a></li>\n" +
    "            <li ng-if=\"layer.source\"><a href=\"{{layer.source}}\" target=\"_blank\">Source</a></li>\n" +
    "        </ul>\n" +
    "    </li>\n" +
    "</ul>");
}]);

angular.module("js/map/map.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/map/map.html",
    "<a title=\"Reset\" href id=\"reset-control\" class=\"btn btn-default btn-xs\" ng-click=\"reset()\"><i class=\"fa fa-refresh\"></i></a>\n" +
    "\n" +
    "<npn-working></npn-working>\n" +
    "\n" +
    "<ui-gmap-google-map ng-if=\"map\" center='map.center' zoom='map.zoom' options=\"map.options\" events=\"map.events\">\n" +
    "    <npn-stations ng-if=\"stationView\"></npn-stations>\n" +
    "    <npn-filter-results></npn-filter-results>\n" +
    "    <bounds-manager></bounds-manager>\n" +
    "</ui-gmap-google-map>\n" +
    "\n" +
    "<share-control></share-control>\n" +
    "<export-control></export-control>\n" +
    "<filter-tags></filter-tags>\n" +
    "<choropleth-info></choropleth-info>\n" +
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

angular.module("js/mapvis/date-control.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/mapvis/date-control.html",
    "<label>Date</label>\n" +
    "<p class=\"input-group\">\n" +
    "  <input type=\"text\" class=\"form-control\"\n" +
    "        uib-datepicker-popup=\"longDate\"\n" +
    "        ng-model=\"selection\"\n" +
    "        is-open=\"isOpen\"\n" +
    "        min-date=\"minDate\"\n" +
    "        max-date=\"maxDate\"\n" +
    "        close-text=\"Close\" />\n" +
    "  <span class=\"input-group-btn\">\n" +
    "    <button type=\"button\" class=\"btn btn-default\" ng-click=\"open()\"><i class=\"glyphicon glyphicon-calendar\"></i></button>\n" +
    "  </span>\n" +
    "</p>");
}]);

angular.module("js/mapvis/doy-control.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/mapvis/doy-control.html",
    "<label>Day of Year</label>\n" +
    "<div class=\"form-inline\" style=\"margin-bottom: 15px;\">\n" +
    "    <div class=\"form-group\">\n" +
    "        <label for=\"selectedMonth\" class=\"sr-only\">Month</label>\n" +
    "        <select id=\"selectedMonth\" class=\"form-control\" ng-model=\"selection.month\"\n" +
    "                ng-options=\"m as (m | date:'MMMM') for m in months\"></select>\n" +
    "    </div>\n" +
    "    <div class=\"form-group\" ng-if=\"selection.month\">\n" +
    "        <label for=\"selectedDate\" class=\"sr-only\">Day</label>\n" +
    "        <select id=\"selectedDate\" class=\"form-control\" ng-model=\"selection.date\"\n" +
    "                ng-options=\"d for d in dates\"></select>\n" +
    "    </div>\n" +
    "    <div class=\"form-group\">\n" +
    "        <input class=\"form-control\" style=\"width: 50px; cursor: default;\" type=\"text\" value=\"{{layer.extent.current.value | number:0}}\" disabled />\n" +
    "    </div>\n" +
    "</div>");
}]);

angular.module("js/mapvis/filter-tags.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/mapvis/filter-tags.html",
    "<ul class=\"filter-tags map-vis list-inline pull-right\">\n" +
    "    <li ng-repeat=\"tag in mapVisFilter\">\n" +
    "        <div class=\"btn-group filter-tag\">\n" +
    "            <a class=\"btn btn-default\">\n" +
    "                <span>{{tag.species | speciesTitle}}, {{tag.phenophase.phenophase_name}}, {{tag.year}} </span>\n" +
    "                <svg id=\"map-vis-marker-{{$index}}\"></svg>\n" +
    "            </a>\n" +
    "            <a class=\"btn btn-default\" ng-click=\"removeFromFilter($index)\">\n" +
    "                <i class=\"fa fa-times-circle-o\"></i>\n" +
    "            </a>\n" +
    "        </div>\n" +
    "    </li>\n" +
    "</ul>");
}]);

angular.module("js/mapvis/in-situ-control.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/mapvis/in-situ-control.html",
    "<div class=\"in-situ-control\" ng-if=\"layer && layer.supportsData()\">\n" +
    "    <hr />\n" +
    "    <div class=\"form-group\" ng-if=\"speciesList\">\n" +
    "        <label for=\"selectedSpecies\">Species</label>\n" +
    "        <select id=\"selectedSpecies\" class=\"form-control\" ng-model=\"selection.species\"\n" +
    "                ng-options=\"s as (s | speciesTitle) for s in speciesList\"></select>\n" +
    "    </div>\n" +
    "    <div class=\"form-group\" ng-if=\"selection.species && phenophaseList.length\">\n" +
    "        <label for=\"selectedPhenophse\">Species</label>\n" +
    "        <select id=\"selectedPhenophse\" class=\"form-control\" ng-model=\"selection.phenophase\"\n" +
    "                ng-options=\"p as p.phenophase_name for p in phenophaseList\"></select>\n" +
    "    </div>\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"col-xs-9\">\n" +
    "            <div class=\"form-group\" ng-if=\"selection.species && selection.phenophase\">\n" +
    "                <label for=\"selectedYear\">Year</label>\n" +
    "                <select id=\"selectedYear\" class=\"form-control\" ng-model=\"selection.year\"\n" +
    "                        ng-options=\"y as y for y in years\"></select>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "        <div class=\"col-xs-3\">\n" +
    "            <div class=\"form-group text-right\">\n" +
    "                <label for=\"addToMapVis\" style=\"visibility: hidden; display: block;\">Add</label>\n" +
    "                <button id=\"addToMapVis\" class=\"btn btn-default\"\n" +
    "                        ng-click=\"addSelectionToFilter()\"\n" +
    "                        ng-disabled=\"!validSelection()\"\n" +
    "                        popover-placement=\"left\" popover-popup-delay=\"500\"\n" +
    "                        popover-trigger=\"mouseenter\"\n" +
    "                        uib-popover=\"Add this species/phenophase/year to the map\"\n" +
    "                        popover-append-to-body=\"true\">\n" +
    "                    <i class=\"fa fa-plus\"></i>\n" +
    "                </button>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "    <div class=\"row\">\n" +
    "        <div class=\"col-xs-12\">\n" +
    "            <button id=\"mapVisPlot\" class=\"btn btn-default pull-right\"\n" +
    "                    ng-click=\"mapVisPlot()\"\n" +
    "                    ng-disabled=\"!mapVisFilter.length\"\n" +
    "                    popover-placement=\"left\" popover-popup-delay=\"500\"\n" +
    "                    popover-trigger=\"mouseenter\"\n" +
    "                    uib-popover=\"Add this species/phenophase/year to the map\"\n" +
    "                    popover-append-to-body=\"true\">Plot data</button>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</div>");
}]);

angular.module("js/mapvis/layer-control.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/mapvis/layer-control.html",
    "<div ng-if=\"layers\" class=\"map-vis-layer-control\">\n" +
    "    <div class=\"form-group\">\n" +
    "        <label for=\"selectedCategory\">Category</label>\n" +
    "        <select id=\"selectedCategory\" class=\"form-control\" ng-model=\"selection.layerCategory\"\n" +
    "                ng-options=\"cat as cat.name for cat in layers.categories\"></select>\n" +
    "    </div>\n" +
    "    <div class=\"form-group\" ng-if=\"selection.layerCategory\">\n" +
    "        <label for=\"selectedLayer\">Layer</label>\n" +
    "        <select id=\"selectedLayer\" class=\"form-control\" ng-model=\"selection.layer\"\n" +
    "                ng-options=\"l as (l.style.title + ' - ' + l.title) for l in selection.layerCategory.layers\"></select>\n" +
    "    </div>\n" +
    "    <div class=\"extent-control\" ng-if=\"selection.layer.extent\" ng-switch=\"selection.layer.extent.type\">\n" +
    "        <map-vis-doy-control ng-switch-when=\"doy\" layer=\"selection.layer\"></map-vis-doy-control>\n" +
    "        <map-vis-date-control ng-switch-when=\"date\" layer=\"selection.layer\"></map-vis-date-control>\n" +
    "        <map-vis-year-control ng-switch-when=\"year\" layer=\"selection.layer\"></map-vis-year-control>\n" +
    "    </div>\n" +
    "    <map-vis-opacity-slider layer=\"selection.layer\"></map-vis-opacity-slider>\n" +
    "    <p ng-if=\"selection.layer.abstract\">{{selection.layer.abstract}}</p>\n" +
    "</div>");
}]);

angular.module("js/mapvis/legend.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/mapvis/legend.html",
    "<svg class=\"legend\"></svg>");
}]);

angular.module("js/mapvis/mapvis.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/mapvis/mapvis.html",
    "<vis-dialog title=\"Gridded Data\" modal=\"modal\">\n" +
    "    <div class=\"container-fluid\">\n" +
    "        <div class=\"row\">\n" +
    "            <div class=\"col-xs-8\">\n" +
    "                <div id=\"vis-working\" ng-show=\"working\"><i class=\"fa fa-circle-o-notch fa-spin fa-5x\"></i></div>\n" +
    "                <map-vis-filter-tags map-vis-filter=\"speciesSelections\"></map-vis-filter-tags>\n" +
    "                <ui-gmap-google-map ng-if=\"wms_map\" center='wms_map.center' zoom='wms_map.zoom' options=\"wms_map.options\" events=\"wms_map.events\">\n" +
    "                    <ui-gmap-markers models=\"results.markers\"\n" +
    "                                    idKey=\"'$markerKey'\"\n" +
    "                                    coords=\"'self'\"\n" +
    "                                    icon=\"'icon'\"\n" +
    "                                    options=\"'markerOpts'\"\n" +
    "                                    doCluster=\"false\"\n" +
    "                                    events=\"markerEvents\"></ui-gmap-markers>\n" +
    "                    <map-vis-geo-layer></map-vis-geo-layer>\n" +
    "                    <map-vis-bounds-layer></map-vis-bounds-layer>\n" +
    "                </ui-gmap-google-map>\n" +
    "                <map-vis-legend legend=\"legend\"></map-vis-legend>\n" +
    "            </div>\n" +
    "            <div class=\"col-xs-4\">\n" +
    "                <map-vis-layer-control></map-vis-layer-control>\n" +
    "                <map-vis-in-situ-control layer=\"selection.layer\" map-vis-filter=\"speciesSelections\" map-vis-plot=\"plotMarkers()\"></map-vis-in-situ-control>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "    </div>\n" +
    "</vis-dialog>");
}]);

angular.module("js/mapvis/year-control.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/mapvis/year-control.html",
    "<div class=\"form-group\" ng-if=\"layer.extent\">\n" +
    "    <label for=\"selectedExtent\">Year</label>\n" +
    "    <select id=\"selectedExtent\" class=\"form-control\" ng-model=\"layer.extent.current\" ng-options=\"v as v.label for v in layer.extent.values\"></select>\n" +
    "</div>");
}]);

angular.module("js/scatter/scatter.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/scatter/scatter.html",
    "<vis-dialog title=\"Scatter Plot\" modal=\"modal\">\n" +
    "<form class=\"form-inline plot-criteria-form\">\n" +
    "    <div class=\"form-group\">\n" +
    "        <label for=\"speciesInput\">Select up to three species phenophase combinations</label>\n" +
    "        <select name=\"speciesInput\" class=\"form-control\" ng-model=\"selection.species\" ng-options=\"(o|speciesTitle) for o in speciesList\"></select>\n" +
    "        <select name=\"phenophaseInput\" class=\"form-control\" ng-model=\"selection.phenophase\" ng-options=\"o.phenophase_name for o in phenophaseList\"></select>\n" +
    "        <div class=\"btn-group\" uib-dropdown is-open=\"selection.color_isopen\">\n" +
    "          <button type=\"button\" class=\"btn btn-default dropdown-toggle\" uib-dropdown-toggle style=\"background-color: {{colorRange[selection.color]}};\">\n" +
    "            &nbsp; <span class=\"caret\"></span>\n" +
    "          </button>\n" +
    "          <ul class=\"dropdown-menu\" role=\"menu\">\n" +
    "            <li ng-repeat=\"i in colors track by $index\" style=\"background-color: {{colorRange[$index]}};\"><a href ng-click=\"selection.color=$index;\">&nbsp;</a></li>\n" +
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
    "            <li class=\"criteria\" ng-repeat=\"tp in toPlot\">{{tp|speciesTitle}}/{{tp.phenophase_name}} <i style=\"color: {{colorRange[tp.color]}};\" class=\"fa fa-circle\"></i>\n" +
    "                <a href ng-click=\"removeFromPlot($index)\"><i class=\"fa fa-times-circle-o\"></i></a>\n" +
    "            </li>\n" +
    "            <li>\n" +
    "                <select class=\"form-control vis-axis\" ng-model=\"selection.axis\" ng-options=\"o as o.label for o in axis\"></select>\n" +
    "            </li>\n" +
    "            <li>\n" +
    "                <label for=\"fitLinesInput\">Fit Line{{toPlot.length > 1 ? 's' : ''}}</label>\n" +
    "                <input type=\"checkbox\" id=\"fitLinesInput\" ng-model=\"selection.regressionLines\" />\n" +
    "            </li>\n" +
    "            <li ng-if=\"!data\"><button class=\"btn btn-primary\" ng-click=\"visualize()\">Visualize</button></li>\n" +
    "        </ul>\n" +
    "        <div id=\"vis-container\">\n" +
    "            <div id=\"vis-working\" ng-show=\"working\"><i class=\"fa fa-circle-o-notch fa-spin fa-5x\"></i></div>\n" +
    "            <div class=\"chart-container\">\n" +
    "                <vis-download ng-if=\"data\"\n" +
    "                              selector=\".chart\"\n" +
    "                              filename=\"npn-scatter-plot.png\"></vis-download>\n" +
    "                <div><svg class=\"chart\"></svg></div>\n" +
    "            </div>\n" +
    "            <div ng-if=\"filteredDisclaimer\" class=\"filter-disclaimer\">For quality assurance purposes, only onset dates that are preceded by negative records are included in the visualization.</div>\n" +
    "        </div>\n" +
    "        </center>\n" +
    "    </div>\n" +
    "</div>\n" +
    "<!--pre ng-if=\"record\">{{record | json}}</pre-->\n" +
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
    "        <label>Variable Displayed</label>\n" +
    "        <ul class=\"list-unstyled\">\n" +
    "            <li ng-repeat=\"option in settings.tagBadgeFormat.options\">\n" +
    "                <input type=\"radio\"\n" +
    "                       id=\"{{option.value}}\" ng-model=\"settings.tagBadgeFormat.value\"\n" +
    "                       value=\"{{option.value}}\"> <label for=\"{{option.value}}\">{{option.label}}</label>\n" +
    "            </li>\n" +
    "        </ul>\n" +
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
    "    </li>\n" +
    "    <li class=\"divider\"></li>\n" +
    "    <li>\n" +
    "        <label for=\"clusterMarkersSetting\">Exclude less precise data from visualizations</label>\n" +
    "        <ul class=\"list-unstyled\">\n" +
    "            <li ng-repeat=\"option in [true,false]\">\n" +
    "                <input type=\"radio\" id=\"filterLqdSummary{{option}}\" ng-model=\"settings.filterLqdSummary.value\"\n" +
    "                       ng-value=\"{{option}}\" /> <label for=\"filterLqdSummary{{option}}\">{{option | yesNo}}</label>\n" +
    "            </li>\n" +
    "        </ul>\n" +
    "        <p>Selecting <strong>Yes</strong> will exclude data points which lack a \"no\" record preceding the first \"yes\" record from certain visualizations. </p>\n" +
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
    "        popover-placement=\"right\" uib-popover=\"{{t.title}}\" popover-trigger=\"mouseenter\" popover-popup-delay=\"1000\"\n" +
    "        ng-click=\"select(t)\">\n" +
    "      <i id=\"toolbar-icon-{{t.id}}\" class=\"toolbar-icon fa {{t.icon}}\"></i>\n" +
    "    </li>\n" +
    "  </ul>\n" +
    "  <div class=\"toolbar-content\" ng-class=\"{open: open}\" ng-transclude></div>\n" +
    "</div>");
}]);

angular.module("js/vis/visControl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/vis/visControl.html",
    "<p class=\"empty-filter-notes\" ng-if=\"isFilterEmpty()\">\n" +
    "    Before using a visualization you must create and execute a filter.\n" +
    "    Visualizations use the species, and sometimes, date ranges you've identified\n" +
    "    in your filter as the basis for what you want to visualize.\n" +
    "</p>\n" +
    "<ul class=\"list-unstyled\">\n" +
    "    <li ng-repeat=\"vis in visualizations\">\n" +
    "        <a href ng-click=\"open(vis)\" ng-class=\"{disabled: isFilterEmpty()}\">{{vis.title}}</a>\n" +
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

angular.module("js/vis/visDownload.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("js/vis/visDownload.html",
    "<div class=\"vis-download\">\n" +
    "    <a href ng-click=\"download()\" title=\"Download\"><i class=\"fa fa-download\"></i></a>\n" +
    "    <canvas id=\"visDownloadCanvas\" style=\"display: none;\"></canvas>\n" +
    "    <a id=\"vis-download-link\" style=\"display: none;\">download</a>\n" +
    "</div>");
}]);
