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
      "id": "npn-viz-tool.vis-map",
      "shortName": "npn-viz-tool.vis-map",
      "type": "overview",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "Logic for gridded data map visualization.",
      "keywords": "api data gridded logic map npn-viz-tool overview vis-map visualization"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map-services",
      "shortName": "npn-viz-tool.vis-map-services",
      "type": "overview",
      "moduleName": "npn-viz-tool.vis-map-services",
      "shortDescription": "Service support for gridded data map visualization.",
      "keywords": "api data gridded map npn-viz-tool overview service support vis-map-services visualization"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map-services:thirtyYearAvgDayOfYear",
      "shortName": "thirtyYearAvgDayOfYear",
      "type": "filter",
      "moduleName": "npn-viz-tool.vis-map-services",
      "shortDescription": "Filter that translates a doy value (number) into date text of &#39;Month day&#39;",
      "keywords": "api avg base based day days doy filter instance layers month npn-viz-tool text translates vis-map-services year yr"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map-services:WcsService",
      "shortName": "WcsService",
      "type": "service",
      "moduleName": "npn-viz-tool.vis-map-services",
      "shortDescription": "Interacts with the NPN geoserver WCS instance to supply underlying gridded data.  Loading of this service",
      "keywords": "activelayer api array associated class data extends fetch geoserver getgriddeddata google grid gridded gridsize instance interacts larger latlng layer loading location map maps method npn npn-viz-tool number numbers point promise protypes rejected resolved returned service side specific supply underlying vis-map-services wcs wcsservice"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map-services:WmsService",
      "shortName": "WmsService",
      "type": "service",
      "moduleName": "npn-viz-tool.vis-map-services",
      "shortDescription": "Interacts with the NPN geoserver WMS instance to supply map layer data.",
      "keywords": "api base categorized data eventually fetched geoserver getlayers instance interacts layer layers list map maps method npn npn-viz-tool progress promise rejected resolved service subset supply supported vis-map-services wms"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map:map-vis-date-control",
      "shortName": "map-vis-date-control",
      "type": "directive",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "Control for date extents.",
      "keywords": "api control directive extents npn-viz-tool vis-map"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map:map-vis-doy-control",
      "shortName": "map-vis-doy-control",
      "type": "directive",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "control for day of year extents.",
      "keywords": "api control day directive extents npn-viz-tool vis-map year"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map:map-vis-layer-control",
      "shortName": "map-vis-layer-control",
      "type": "directive",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "Directive to control categorized selection of WMS layers.",
      "keywords": "api categorized control directive layers npn-viz-tool selection vis-map wms"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map:map-vis-year-control",
      "shortName": "map-vis-year-control",
      "type": "directive",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "Control for year extents.",
      "keywords": "api control directive extents npn-viz-tool vis-map year"
    },
    {
      "section": "api",
      "id": "npn-viz-tool.vis-map:MapVisCtrl",
      "shortName": "MapVisCtrl",
      "type": "controller",
      "moduleName": "npn-viz-tool.vis-map",
      "shortDescription": "Controller for the gridded data map visualization dialog.",
      "keywords": "api controller data dialog gridded map npn-viz-tool vis-map visualization"
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