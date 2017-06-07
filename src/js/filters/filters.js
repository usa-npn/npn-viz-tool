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
})
.filter('doy',function(){
    var ONE_DAY_MILLIS = (24*60*60*1000);
    return function(date,ignoreLeapYear) {
        if(typeof(date) === 'string') {
            var parts = date.split('-');
            if(parts.length === 3) {
                var year = parseInt(parts[0]),
                    month = parseInt(parts[1]),
                    day = parseInt(parts[2]);
                if(!isNaN(year) && !isNaN(month) && !isNaN(day) && month < 13 && day < 32) {
                    date = new Date(year,(month-1),day);
                }
            }
        }
        if(date instanceof Date) {
            date = new Date(date.getTime());
            if(ignoreLeapYear) {
                // ignore leap years, using 2010 which is known to be a non-leap year
                date.setFullYear(2010);
            }
            var doy = date.getDate();
            while (date.getMonth() > 0) {
                // back up to the last day of the last month
                date.setDate(1);
                date.setTime(date.getTime()-ONE_DAY_MILLIS);
                doy += date.getDate();
            }
            return doy;
        }
        return date;
    };
});
