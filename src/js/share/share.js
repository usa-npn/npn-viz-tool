angular.module('npn-viz-tool.share',[
    'npn-viz-tool.filter',
    'npn-viz-tool.layers',
    'npn-viz-tool.settings',
    'uiGmapgoogle-maps'
])
/**
 * Important one and only one instance of this directive should ever be in use in the application
 * because upon instantiation it examines the current URL query args and uses its contents to
 * populate the filter, etc.
 */
.directive('shareControl',['uiGmapIsReady','FilterService','LayerService','DateFilterArg','SpeciesFilterArg','NetworkFilterArg','GeoFilterArg','BoundsFilterArg','$location','$log','SettingsService',
    function(uiGmapIsReady,FilterService,LayerService,DateFilterArg,SpeciesFilterArg,NetworkFilterArg,GeoFilterArg,BoundsFilterArg,$location,$log,SettingsService){
    return {
        restrict: 'E',
        template: '<a title="Share" href id="share-control" class="btn btn-default btn-xs" ng-disabled="!getFilter().hasSufficientCriteria()" ng-click="share()"><i class="fa fa-share"></i></a><div ng-show="url" id="share-content"><input type="text" class="form-control" ng-model="url" ng-blur="url = null" onClick="this.setSelectionRange(0, this.value.length)"/></div>',
        scope: {},
        controller: function($scope){
            FilterService.pause();
            uiGmapIsReady.promise(1).then(function(instances){
                var map = instances[0],
                    qargs = $location.search(),
                    speciesFilterCount = 0,
                    speciesFilterReadyCount = 0,
                    networksFilterCount = 0,
                    networksFilterReadyCount = 0,
                    layersReady = false,
                    layerListener,speciesListener,networksListener;
                function checkReady() {
                    if(layersReady && speciesFilterReadyCount === speciesFilterCount && networksFilterCount === networksFilterReadyCount) {
                        $log.debug('ready..');
                        // unsubscribe
                        layerListener();
                        speciesListener();
                        networksListener();
                        FilterService.resume();
                    }
                }
                layerListener = $scope.$on('layers-ready',function(event,data){
                    $log.debug('layers ready...');
                    layersReady = true;
                    checkReady();
                });
                speciesListener = $scope.$on('species-filter-ready',function(event,data){
                    $log.debug('species filter ready...',data);
                    speciesFilterReadyCount++;
                    checkReady();
                });
                networksListener = $scope.$on('network-filter-ready',function(event,data){
                    $log.debug('network filter ready...',data);
                    networksFilterReadyCount++;
                    checkReady();
                });
                function addSpeciesToFilter(s){
                    SpeciesFilterArg.fromString(s).then(FilterService.addToFilter);
                }
                function addNetworkToFilter(s) {
                    NetworkFilterArg.fromString(s).then(FilterService.addToFilter);
                }
                $log.debug('qargs',qargs);
                if(qargs['d'] && (qargs['s'] || qargs['n'])) {
                    // we have sufficient criteria to alter the filter...
                    FilterService.addToFilter(DateFilterArg.fromString(qargs['d']));
                    if(qargs['b']) {
                        qargs['b'].split(';').forEach(function(bounds_s){
                            FilterService.addToFilter(BoundsFilterArg.fromString(bounds_s,map.map));
                        });
                    }
                    if(qargs['s']) {
                        var speciesList = qargs['s'].split(';');
                        speciesFilterCount = speciesList.length;
                        speciesList.forEach(addSpeciesToFilter);
                    }
                    if(qargs['n']) {
                        var networksList = qargs['n'].split(';');
                        networksFilterCount = networksList.length;
                        networksList.forEach(addNetworkToFilter);
                    }
                } else {
                    FilterService.resume();
                }
            });

            $scope.getFilter = FilterService.getFilter;
            $scope.share = function() {
                if($scope.url) {
                    $scope.url = null;
                    return;
                }
                var filter = FilterService.getFilter(),
                    params = {},
                    absUrl = $location.absUrl(),
                    q = absUrl.indexOf('?');
                params['d'] = filter.getDateArg().toString();
                filter.getSpeciesArgs().forEach(function(s){
                    if(!params['s']) {
                        params['s'] = s.toString();
                    } else {
                        params['s'] += ';'+s.toString();
                    }
                });
                filter.getNetworkArgs().forEach(function(n){
                    if(!params['n']) {
                        params['n'] = n.toString();
                    } else {
                        params['n'] += ';'+n.toString();
                    }
                });
                filter.getGeoArgs().forEach(function(g){
                    if(!params['g']) {
                        params['g'] = g.toString();
                    } else {
                        params['g'] += ';'+g.toString();
                    }
                });
                filter.getBoundsArgs().forEach(function(b){
                    if(!params['b']) {
                        params['b'] = b.toString();
                    } else {
                        params['b'] += ';'+b.toString();
                    }
                });
                if(q != -1) {
                    absUrl = absUrl.substring(0,q);
                }
                absUrl += absUrl.indexOf('#') === -1 ? '#?' : '?';
                Object.keys(params).forEach(function(key,i){
                    absUrl += (i > 0 ? '&' : '') + key + '=' + encodeURIComponent(params[key]);
                });
                absUrl+='&'+SettingsService.getSharingUrlArgs();
                $log.debug('absUrl',absUrl);
                $scope.url = absUrl;
            };
        }
    };
}]);