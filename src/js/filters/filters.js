angular.module('npn-viz-tool.filters',[
])
.filter('cssClassify',function(){
    return function(input) {
        if(typeof(input) === 'string') {
            return input.trim().toLowerCase().replace(/\s+/g,'-');
        }
        return input;
    };
})
.filter('yesNo',function(){
    return function(input) {
        return input ? 'Yes' : 'No';
    };
})
.filter('gte',function(){
    return function(input,num) {
        if(!num || !angular.isArray(input)) {
            return input;
        }
        return input.filter(function(i){
            return i >= num;
        });
    };
})
.filter('lte',function(){
    return function(input,num) {
        if(!num || !angular.isArray(input)) {
            return input;
        }
        return input.filter(function(i){
            return i <= num;
        });
    };
})
.filter('trim',function(){
    return function(input) {
        if(angular.isString(input)) {
            return input.trim();
        }
        return input;
    };
})
.filter('ellipses',function(){
    return function(input) {
        var maxLen = arguments.length == 2 ? arguments[1] : 55;
        if(typeof(input) == 'string' && input.length > maxLen) {
            return input.substring(0,maxLen)+' ...';
        }
        return input;
    };
});