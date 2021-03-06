NG_DOCS={
  "sections": {
    "api": "API Documentation"
  },
  "pages": [
    {
      "section": "api",
      "id": "index",
      "shortName": "NPN Visualization Tool",
      "type": "overview",
      "moduleName": "NPN Visualization Tool",
      "shortDescription": "This documentation attempts to capture at a high level the components of the NPN visualization tool",
      "keywords": "api attempts capture components documentation high level npn overview reference tool visualization"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.bounds",
      "shortName": "npn-viz-tool.bounds",
      "type": "overview",
      "moduleName": "npn-viz-tool.bounds",
      "shortDescription": "Bounds related functionality.",
      "keywords": "api bounds functionality npn-viz-tool overview"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.bounds:bounds-manager",
      "shortName": "bounds-manager",
      "type": "directive",
      "moduleName": "npn-viz-tool.bounds",
      "shortDescription": "Handles the ability for users to draw rectangles on the main map and have it affect the underlying filter.",
      "keywords": "ability affect api bounds directive draw filter handles main map npn-viz-tool rectangles underlying users"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.bounds:RestrictedBoundsService",
      "shortName": "RestrictedBoundsService",
      "type": "service",
      "moduleName": "npn-viz-tool.bounds",
      "shortDescription": "Provides objects that can be used to handle Google Map &#39;center_changed&#39; events to keep the user",
      "keywords": "$scope add api app argument associated boundaries bounds boundsrestrictor center_changed center_changned changed defined events fetch getrestrictor google handle identifiy initial instance key latlngbounds main_map map maps method movements moving npn-viz-tool object objects opaque panning partially query recenter rectangle restrict restricted restrictedboundsservice restrictor service set setbounds showing time unique user var white"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.cache",
      "shortName": "npn-viz-tool.cache",
      "type": "overview",
      "moduleName": "npn-viz-tool.cache",
      "shortDescription": "Caching functionality.",
      "keywords": "api cache caching functionality npn-viz-tool overview"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.cache:CacheService",
      "shortName": "CacheService",
      "type": "service",
      "moduleName": "npn-viz-tool.cache",
      "shortDescription": "Simple service that can be used to store content for a period of time to avoid needing",
      "keywords": "api argument avoid based cache cached content contents debug default drop dump exists expire expired fetch generate generates hash javascript key keyfromobject live log long method milliseconds minutes needing negative npn-viz-tool null obj object optional period place purposes remained return server service simple specifies store time ttl unique valid won"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded",
      "shortName": "npn-viz-tool.gridded",
      "type": "overview",
      "moduleName": "npn-viz-tool.gridded",
      "shortDescription": "Base module for controlling gridded map layers.",
      "keywords": "api base controlling gridded layers map module npn-viz-tool overview"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services",
      "shortName": "npn-viz-tool.gridded-services",
      "type": "overview",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Service support for gridded data map visualization.",
      "keywords": "api data gridded gridded-services map npn-viz-tool overview service support visualization"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:agddDefaultTodayElevation",
      "shortName": "agddDefaultTodayElevation",
      "type": "filter",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Selects a default extent value for a doy layer of &quot;today&quot; (if found among the possibilities).",
      "keywords": "api default doy extent filter gridded-services layer npn-viz-tool possibilities selects today"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:agddDefaultTodayTime",
      "shortName": "agddDefaultTodayTime",
      "type": "filter",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Selects a default extent value for a time layer of &quot;today&quot; (if found among the possibilities).",
      "keywords": "api default extent filter gridded-services layer npn-viz-tool possibilities selects time today"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:extentDates",
      "shortName": "extentDates",
      "type": "filter",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Filters an array of extent dates relative to days.",
      "keywords": "$filter api array dates days extent extentdates filter filters gridded-services npn-viz-tool relative today undefined year"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:gridded-opacity-slider",
      "shortName": "gridded-opacity-slider",
      "type": "directive",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Dynamically controls the opacity of map tiles.",
      "keywords": "api controls currently directive dynamically gridded-services layer map npn-viz-tool opacity selected tiles"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:gridded-point-info-window",
      "shortName": "gridded-point-info-window",
      "type": "directive",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "The base info window contents for gridded point data.  This directive doesn&#39;t",
      "keywords": "api base contents currently data directive doesn general gridded gridded-services info infowindow intended latlng layer legend map maps npn-viz-tool open opened point re-use render returned selected window"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:gridded-range-slider",
      "shortName": "gridded-range-slider",
      "type": "directive",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Dynamically controls the opacity ranges of the data from the WMS Server.",
      "keywords": "api controls currently data directive dynamically gridded-services layer map npn-viz-tool opacity ranges selected server wms"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:GriddedInfoWindowHandler",
      "shortName": "GriddedInfoWindowHandler",
      "type": "object",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Injectable class that can be used to produce InfoWindows for a specific map given LatLng, Layer and Legend objects.",
      "keywords": "api associated called checking class close closes currently data format function gridded gridded-services infowindow infowindows injectable input latlng layer lazily legend legnend map maps method missing npn-viz-tool object objects open opened parameters point produce references required response specific supplied"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:legendAgddAnomaly",
      "shortName": "legendAgddAnomaly",
      "type": "filter",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Formats legend numbers for agdd anomaly layers.",
      "keywords": "agdd anomaly api filter formats gridded-services layers legend npn-viz-tool numbers"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:legendDegrees",
      "shortName": "legendDegrees",
      "type": "filter",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Formats legend numbers in degrees, assumes F if no unit supplied.",
      "keywords": "$filter api assumes degrees filter formats gridded-services legend legenddegrees npn-viz-tool numbers supplied unit"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:legendDoy",
      "shortName": "legendDoy",
      "type": "filter",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Simplified version of thirtyYearAvgDayOfYear that simply takes a number day of year",
      "keywords": "$filter api argument current day days defaults defines doy equates filter format formatted gridded-services inconsistent jan legend legenddoy mmm npn-viz-tool number oposed optional regard returns scales second simplified simply takes third thirtyyearavgdayofyear true undefined version year"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:legendGddUnits",
      "shortName": "legendGddUnits",
      "type": "filter",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Formats legend numbers for gdd units.",
      "keywords": "$filter api filter formats gdd gridded-services legend legendgddunits npn-viz-tool numbers units"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:legendSixAnomaly",
      "shortName": "legendSixAnomaly",
      "type": "filter",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Formats legend numbers for spring index anomaly layers",
      "keywords": "anomaly api filter formats gridded-services layers legend npn-viz-tool numbers spring"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:map-vis-date-control",
      "shortName": "map-vis-date-control",
      "type": "directive",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Control for date extents.",
      "keywords": "api control currently directive extents gridded-services layer map npn-viz-tool selected"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:map-vis-doy-control",
      "shortName": "map-vis-doy-control",
      "type": "directive",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "control for day of year extents.",
      "keywords": "api control currently day directive extents gridded-services layer map npn-viz-tool selected year"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:map-vis-layer-control",
      "shortName": "map-vis-layer-control",
      "type": "directive",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Directive to control categorized selection of WMS layers.  This directive",
      "keywords": "api categorized control directive gridded-services layers npn-viz-tool parent scope selection shares wms"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:map-vis-legend",
      "shortName": "map-vis-legend",
      "type": "directive",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Directive to dynamically display an interactive legend for a seleted map layer.",
      "keywords": "api currently directive display dynamically gridded-services interactive layer legend map npn-viz-tool selected seleted"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:map-vis-year-control",
      "shortName": "map-vis-year-control",
      "type": "directive",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Control for year extents.",
      "keywords": "api control currently directive extents gridded-services layer map npn-viz-tool selected year"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:thirtyYearAvgDayOfYear",
      "shortName": "thirtyYearAvgDayOfYear",
      "type": "filter",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Filter that translates a doy value (number) into date text of &#39;Month day&#39;",
      "keywords": "api avg base based day days doy filter gridded-services instance layers month npn-viz-tool text translates year yr"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:WcsService",
      "shortName": "WcsService",
      "type": "service",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Interacts with the NPN geoserver WCS instance to supply underlying gridded data.  Loading of this service",
      "keywords": "activelayer api array associated base based call class data directly expose extends fetch fetching geoserver geoserverurl getgriddeddata google grid gridded gridded-services gridsize import indivdual instance interact interacts larger latlng layer layers loading location map maps method methods_getgriddeddata npn npn-viz-tool number numbers point promise protypes rejected resolved returned service side specific supply underlying url wcs wcsservice"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:WmsMapLayer",
      "shortName": "WmsMapLayer",
      "type": "object",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "A map layer object associated with a specific google map.",
      "keywords": "analytics api array arrives associated bounce bounds constrain currently currentyearonly data defined description doesn exists false fashion fetch fit function getabstract getbounds getgriddeddata getlegend getmap getstylerange gettitle google googlelayer gridded gridded-services imagemaptype indicates instance latlng latlngbounds layer layers legend location map maps method npn-viz-tool numbers object plotted point promise property range rejected resolve resolved restrained selected server set setstyle setstylerange specific string style support supports supportsdata title toggle tracked true underlying updated year"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:WmsMapLegend",
      "shortName": "WmsMapLegend",
      "type": "object",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "A legend object associated with a specific map layer.",
      "keywords": "api array associate associated cell cells colors current data definitino definition dom format formatpointdata formatted getcolors getdata getlabels getoriginallabels getpointdata getquantities getstyledefinition gettitle gridded-services hex labels layer legend map method npn-viz-tool numberic numbers object original point quantities raw set setlayer specific string strings style text title translate undefined zero-index"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded-services:WmsService",
      "shortName": "WmsService",
      "type": "service",
      "moduleName": "npn-viz-tool.gridded-services",
      "shortDescription": "Interacts with the NPN geoserver WMS instance to supply map layer data.",
      "keywords": "addition agdd anangular angualr angular api applied applies args arguments array associated base behavior boolean capabilities categories categorized category cell code configuration configure current currently data default define defined defines definition description displaying document driven eventually exposed exposes extent extent_values_filter extentdates false fetched filter format formatting gdd geo geo_server geoserver getlayers gridded gridded-services indicates indicating individual info inherit instance instances interact interacts involved json labels layer layers legend legend_label_filter legenddegrees legends level list location machine map maps merged method minimum names npn npn-viz-tool numbers object objects optional org organization organize over-ride plotting point points progress promise properties property provided re-organized rejected report reported resolved retrived select selected separated series server service single specifies string strings subset supply support supported supports supports_data time title today top translate true ui unspecified url usanpn valid values visualization wcs whilch windows wms year"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded:gridded-control",
      "shortName": "gridded-control",
      "type": "directive",
      "moduleName": "npn-viz-tool.gridded",
      "shortDescription": "Gridded layers toolbar content.",
      "keywords": "api content directive gridded layers npn-viz-tool toolbar"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded:gridded-legend-main",
      "shortName": "gridded-legend-main",
      "type": "directive",
      "moduleName": "npn-viz-tool.gridded",
      "shortDescription": "Gridded legend for the main map which communicates with the gridded toolbar to display a legend for",
      "keywords": "api communicates currently directive display gridded layer legend main map npn-viz-tool selected toolbar"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.gridded:GriddedControlService",
      "shortName": "GriddedControlService",
      "type": "service",
      "moduleName": "npn-viz-tool.gridded",
      "shortDescription": "This is simply an empty object that can be shared between the gridded-control, gridded-legend-main",
      "keywords": "active acts addsharingurlargs api args array build control current currently directives empty expose extent getlayer getlegend getsharingurlargs gridded gridded-control gridded-legend-main gridded-services hierarchically intermediary layer legend method npn-viz-tool object parameters params populates pulls referenced respect service share shared sharing simply strings undefined url"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis",
      "shortName": "npn-viz-tool.vis",
      "type": "overview",
      "moduleName": "npn-viz-tool.vis",
      "shortDescription": "Module for generic visualization support, dialog framework, common services, etc.",
      "keywords": "api common dialog framework generic module npn-viz-tool overview services support vis visualization"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map",
      "shortName": "npn-viz-tool.vis-map",
      "type": "overview",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "Logic for gridded data map visualization.",
      "keywords": "api data gridded logic map npn-viz-tool overview vis-map visualization"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map:map-vis-bounds-layer",
      "shortName": "map-vis-bounds-layer",
      "type": "directive",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "Transfers any rectangles from the base map to the vis map based on BoundsFilterArgs.",
      "keywords": "api base based boundsfilterargs constrained data directive filtered in-situ map markers npn-viz-tool placing play rectangles strictly transfers vis vis-map visual"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map:map-vis-filter-tags",
      "shortName": "map-vis-filter-tags",
      "type": "directive",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "Displays filter tags on top of the map visualization and supports removal of selections from the",
      "keywords": "api array binding directive displays filter map map-vis-filter npn-viz-tool removal selections species supports tags top vis-map visualization"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map:map-vis-geo-layer",
      "shortName": "map-vis-geo-layer",
      "type": "directive",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "Transfers any geojson features from the base map to the vis map based on GeoFilterArgs.",
      "keywords": "api base based constrained data directive features filtered geofilterargs geojson in-situ map markers npn-viz-tool placing play strictly transfers vis vis-map visual"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map:map-vis-in-situ-control",
      "shortName": "map-vis-in-situ-control",
      "type": "directive",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "Directive to control addition of in-situ data to the visualization map.",
      "keywords": "addition api control currently data directive in-situ layer map npn-viz-tool selected vis-map visualization"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map:map-vis-marker-info-window",
      "shortName": "map-vis-marker-info-window",
      "type": "directive",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "Contents of the InfoWindow when a user clicks on a plotted marker.",
      "keywords": "api clicks contents directive infowindow marker npn-viz-tool plotted user vis-map"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map:MapVisCtrl",
      "shortName": "MapVisCtrl",
      "type": "controller",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "Controller for the gridded data map visualization dialog.",
      "keywords": "api controller data dialog gridded map npn-viz-tool vis-map visualization"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map:MapVisMarkerService",
      "shortName": "MapVisMarkerService",
      "type": "service",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "Holds SVG marker paths for shared use between tags and map markers.  Exposes basic",
      "keywords": "api array base basic build color d3 definition exposes fill fillcolor function functionality getbaseicon google holds icon identifies idx map marker markers method npn-viz-tool object path paths property render rendering rendermarkertosvg selector service shared steelblue svg svgs tags uniquely vis vis-map"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis:ChartService",
      "shortName": "ChartService",
      "type": "service",
      "moduleName": "npn-viz-tool.vis",
      "shortDescription": "Handles data gathering in a generic fashion for visualizations that should share, rather than",
      "keywords": "actual allows api approximate approxy array base based callback chart coded coefficient common constant control convenience d3 data day defaults definitions deliver desired dialog drawing duplicate dynamically enabled fashion filter filtered filtering focused full gathering generate generic geographic getmagnitudedata getobservationdates getsiteleveldata getsizeinfo getsummarizeddata getvisualizations handles height image implicitly imprecise info isfilterempty issue leastsquares leastsquarescoeff level lines list lists logic magnitude marginoverride mathematics method milliseconds modal networks npn-viz-tool number object observation one_day_millis open opensinglestationvisualization openvisualization overriding parameters params parsefloat perform populate property px receive regression replace request resolve respect response result scope send service share shortcut single site sites size sized squares statically station station_id style success summarized suspect svg told ui var vis visualization visualizations web width window x-series xseries y-series yseries"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis:vis-control",
      "shortName": "vis-control",
      "type": "directive",
      "moduleName": "npn-viz-tool.vis",
      "shortDescription": "The visualization slide out control.",
      "keywords": "api control directive npn-viz-tool slide vis visualization"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis:vis-dialog",
      "shortName": "vis-dialog",
      "type": "directive",
      "moduleName": "npn-viz-tool.vis",
      "shortDescription": "A visualization dialog",
      "keywords": "api dialog directive modal npn-viz-tool title vis visualization"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis:vis-download",
      "shortName": "vis-download",
      "type": "directive",
      "moduleName": "npn-viz-tool.vis",
      "shortDescription": "Vis download.",
      "keywords": "api directive download npn-viz-tool vis"
    }
  ],
  "apis": {
    "api": true
  },
  "html5Mode": false,
  "editExample": true,
  "startPage": "/api",
  "scripts": [
    "angular.min.js"
  ]
};