angular.module('npn-viz-tool.help',[
])
.factory('HelpService',['$timeout',function($timeout){
    var LOOK_AT_ME_CLASS = 'look-at-me',
        LOOK_AT_ME_REMOVE_DELAY = 65000, // how long to leave the class in place, should exeed duration*iteration on the CSS animation
        current,
        service = {
        lookAtMe: function(selector,delay) {
            if(current) {
                service.stopLookingAtMe(current);
            }
            // if the class is there then don't add it again there's a timer set to remove it
            if(!$(selector).hasClass(LOOK_AT_ME_CLASS)) {
                $timeout(function(){
                    $(selector).addClass(LOOK_AT_ME_CLASS);
                    current = selector;
                    $timeout(function(){
                        service.stopLookingAtMe(selector);
                    },LOOK_AT_ME_REMOVE_DELAY);
                },(delay||0));
            }
        },
        stopLookingAtMe: function(selector) {
            $(selector).removeClass(LOOK_AT_ME_CLASS);
            current = null;
        }
    };
    return service;
}])
.directive('helpVideoControl',['$http','$sce',function($http,$sce) {

    return {
        restrict: 'E',
        template: '<a ng-show="videos.length" title="Help" href id="help-video-control" class="btn btn-default btn-xs" ng-click="visible = !visible;"><i class="fa fa-question"></i></a>'+
        '<div ng-show="visible" id="help-video-content">'+
        '<a class="close" href ng-click="visible = false"><i class="fa fa-times-circle-o" aria-hidden="true"></i></a>'+
        '<h4>Help videos</h4>'+
        '<ul class="list-unstyled">'+
        '<li ng-repeat="video in videos"><a href ng-click="selection.video = video;" ng-class="{selected: selection.video === video}">{{video.title}}</a></li>'+
        '</ul>'+
        '<span ng-if="selection.video" ng-bind-html="selection.video.$embed"></span>',
        scope: {},
        link: function($scope) {
            $scope.visible = false;
            $scope.$watch('visible',function() {
                $scope.selection = {};
            });
            $http.get('help-videos.json').then(function(response) {
                $scope.videos = response.data.map(function(v) {
                    v.$embed = $sce.trustAsHtml(v.embed);
                    return v;
                });
            });
        }
    };
}]);
