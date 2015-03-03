angular.module('npn-viz-tool.share',[
    'npn-viz-tool.filter',
    'npn-viz-tool.layers',
    'uiGmapgoogle-maps'
])
/**
 * Important one and only one instance of this directive should ever be in use in the application
 * because upon instantiation it examines the current URL query args and uses its contents to
 * populate the filter, etc.
 */
.directive('shareControl',['uiGmapIsReady','FilterService','LayerService','DateFilterArg','SpeciesFilterArg','GeoFilterArg','$location',
    function(uiGmapIsReady,FilterService,LayerService,DateFilterArg,SpeciesFilterArg,GeoFilterArg,$location){
    return {
        restrict: 'E',
        template: '<a href id="share-control" class="btn btn-default btn-xs" ng-disabled="!getFilter().hasSufficientCriteria()" ng-click="share()"><i class="fa fa-share"></i></a>',
        scope: {},
        controller: function($scope){
            function addSpeciesToFilter(s){
                SpeciesFilterArg.fromString(s).then(FilterService.addToFilter);
            }
            function addGeoToFilter(g) {
                console.log('geo',g);
            }
            uiGmapIsReady.promise(1).then(function(){
                var qargs = $location.search();
                console.log('qargs',qargs);
                if(qargs['d'] && qargs['s']) {
                    if(qargs['g']) {
                        qargs['g'].split(';').forEach(addGeoToFilter);
                    }
                    // we have sufficient criteria to alter the filter...
                    FilterService.addToFilter(DateFilterArg.fromString(qargs['d']));
                    qargs['s'].split(';').forEach(addSpeciesToFilter);
                }
            });

            $scope.getFilter = FilterService.getFilter;
            $scope.share = function() {
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
                filter.getGeoArgs().forEach(function(g){
                    if(!params['g']) {
                        params['g'] = g.toString();
                    } else {
                        params['g'] += ';'+g.toString();
                    }
                });
                if(q != -1) {
                    absUrl = absUrl.substring(0,q);
                }
                absUrl += '#?';
                Object.keys(params).forEach(function(key,i){
                    absUrl += (i > 0 ? '&' : '') + key + '=' + encodeURIComponent(params[key]);
                });
                console.log('absUrl',absUrl);
            };
        }
    };
}]);