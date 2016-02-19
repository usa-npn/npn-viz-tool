/**
 * @ngdoc overview
 * @name npn-viz-tool.bounds
 * @description
 *
 * Bounds related functionality.
 */
angular.module('npn-viz-tool.bounds',[
    'npn-viz-tool.filter',
    'uiGmapgoogle-maps'
])
/**
 * @ngdoc service
 * @name npn-viz-tool.bounds:RestrictedBoundsService
 * @module npn-viz-tool.bounds
 * @description
 *
 * Provides objects that can be used to handle Google Map 'center_changed' events to keep the user
 * from moving a map outside a set of defined boundaries.
 *
 * If you add the query argument <code>allowedBounds</code> to the app then the first time the user tries to
 * recenter the map a partially opaque white rectangle will be added to the map showing the bounds the given map
 * will be restricted to.
 */
.service('RestrictedBoundsService',['$log','$location','uiGmapGoogleMapApi',function($log,$location,uiGmapGoogleMapApi){
    var DEBUG = $location.search()['allowedBounds'],
        instances = {},
        service = {
            /**
             * @ngdoc method
             * @methodOf npn-viz-tool.bounds:RestrictedBoundsService
             * @name  getRestrictor
             * @description
             *
             * Fetch an object that can be used to keep a user from panning a map outside of a
             * set of defined bounds.
             *
             * E.g.
             * <pre>
             * var restrictor = RestrictedBoundsService.getRestrictor('main_map',latLngBounds);
             * $scope.map.events.center_changed = restrictor.center_changned;
             * </pre>
             *
             * @param {string} key A unique key to identifiy the map instance the restrictor is associated with.
             * @param {google.maps.LatLngBounds} bounds The initial set of bounds to restrict movements to.  Can be changed via setBounds.
             * @return {object} A "BoundsRestrictor" object.
             */
            getRestrictor: function(key,bounds) {
                if(!instances[key]) {
                    instances[key] = new BoundsRestrictor(key);
                }
                instances[key].setBounds(bounds);
                return instances[key];
            }
        };
    var BoundsRestrictor = function(key) {
        this.key = key;
        var self = this;
        self.center_changed = function(map,ename,args) {
            $log.debug('['+self.key+'].center_changed');
            if(!self.bounds) {
                $log.debug('['+self.key+'] no bounds set ignoring.');
                return;
            }
            if(DEBUG && !self.rectangle) {
                self.rectangle = new google.maps.Rectangle({
                    strokeColor: '#FFF',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: '#FFF',
                    fillOpacity: 0.35,
                    map: map,
                    bounds: self.bounds
                });
            }
            if(self.bounds.contains(map.getCenter())) {
                self.lastValidCenter = map.getCenter();
                return;
            }
            $log.debug('['+self.key+'] attempted to pan center out of bounds, panning back to ',self.lastValidCenter);
            map.panTo(self.lastValidCenter);
        };
    };
    BoundsRestrictor.prototype.setBounds = function(newBounds) {
        $log.debug('['+this.key+'].setBounds:',newBounds);
        this.bounds = newBounds;
        this.lastValidCenter = newBounds ? newBounds.getCenter() : undefined;
        if(this.rectangle) {
            this.rectangle.setMap(null);
        }
        this.rectangle = undefined;
    };
    BoundsRestrictor.prototype.getBounds = function() {
        return this.bounds;
    };
    return service;
}])
/**
 * @ngdoc directive
 * @name npn-viz-tool.bounds:bounds-manager
 * @module npn-viz-tool.bounds
 * @description
 *
 * Handles the ability for users to draw rectangles on the main map and have it affect the underlying filter.
 */
.directive('boundsManager',['$rootScope','$log','uiGmapGoogleMapApi','FilterService','BoundsFilterArg',
    function($rootScope,$log,uiGmapGoogleMapApi,FilterService,BoundsFilterArg){
    return {
        restrict: 'E',
        template: '<ui-gmap-drawing-manager ng-if="!isFilterEmpty()" options="options" control="control"></ui-gmap-drawing-manager>',
        controller: ['$scope',function($scope) {
            $scope.isFilterEmpty = FilterService.isFilterEmpty;
            function refilter() {
                if(FilterService.getFilter().hasSufficientCriteria()) {
                    $rootScope.$broadcast('filter-rerun-phase2',{});
                }
            }
            uiGmapGoogleMapApi.then(function(maps) {
                var mapsApi = maps,
                    dcOptions = {
                        drawingModes: [mapsApi.drawing.OverlayType.RECTANGLE],
                        position: mapsApi.ControlPosition.TOP_RIGHT,
                        drawingControl: false
                    };
                $log.debug('api',maps);
                $scope.options = {
                    drawingControlOptions: dcOptions,
                    rectangleOptions: BoundsFilterArg.RECTANGLE_OPTIONS
                };
                $scope.control = {};
                $scope.$on('bounds-filter-ready',function(event,data){
                    mapsApi.event.addListener(data.filter.arg,'mouseover',function(){
                        data.filter.arg.setOptions(angular.extend({},BoundsFilterArg.RECTANGLE_OPTIONS,{strokeWeight: 2}));
                    });
                    mapsApi.event.addListener(data.filter.arg,'mouseout',function(){
                        data.filter.arg.setOptions(BoundsFilterArg.RECTANGLE_OPTIONS);
                    });
                    mapsApi.event.addListener(data.filter.arg,'rightclick',function(){
                        FilterService.removeFromFilter(data.filter);
                        refilter();
                    });
                });
                $scope.$watch('control.getDrawingManager',function(){
                    if($scope.control.getDrawingManager){
                        var drawingManager = $scope.control.getDrawingManager();
                        mapsApi.event.addListener(drawingManager,'rectanglecomplete',function(rectangle){
                            drawingManager.setDrawingMode(null);
                            FilterService.addToFilter(new BoundsFilterArg(rectangle));
                            refilter();
                        });
                        $scope.$on('filter-reset',function(event,data){
                            dcOptions.drawingControl = false;
                            drawingManager.setOptions(dcOptions);
                        });
                        $scope.$on('filter-update',function(event,data){
                            dcOptions.drawingControl = FilterService.hasSufficientCriteria();
                            drawingManager.setOptions(dcOptions);
                        });
                    }
                });

            });
        }]
    };
}]);