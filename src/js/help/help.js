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
}]);