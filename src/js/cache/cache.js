angular.module('npn-viz-tool.vis-cache',[
    'angular-md5'
])
/**
 * CacheService
 * Supports a generic place where code can put data that shouldn't be fetched from the
 * server repeatedly, default time to live on data is 5 minutes.
 **/
.factory('CacheService',['$log','$timeout','md5',function($log,$timeout,md5){
    var cache = [];
    var service = {
      keyFromObject : function(obj) {
        return md5.createHash(JSON.stringify(obj));
      },
      dump : function() {
        $log.debug('cache',cache);
      },
      put : function(key,obj) {
        if ( key == null ) {
          return;
        }
        if ( obj == null ) {
          $log.debug( 'removing cached object \''+key+'\'', cache[key]);
          // probably should slice to shrink cache array but...
          cache[key] = null;
          return;
        }
        var ttl = (arguments.length > 2) ?
          arguments[2] :
          (5*60000); // default ttl is 5 minutes
        var expiry = (ttl < 0) ?
          -1 : // never expires
          (new Date()).getTime()+ttl;
        $log.debug('caching (expiry:'+expiry+') \''+key+'\'',obj);
        cache[key] = {
          data: obj,
          expiry : expiry
        };
        if(ttl > 0) {
            $timeout(function(){
                $log.debug('expiring cached object \''+key+'\'', cache[key]);
                cache[key] = null;
            },ttl);
        }
      },
      get : function(key) {
        var obj = cache[key];
        if ( obj == null ) {
          return arguments.length > 1 ? arguments[1] : null;
        }
        if ( obj.expiry < 0 || obj.expiry > (new Date()).getTime() ) {
            $log.debug('cache entry \''+key+'\' is valid returning.');
          return obj.data;
        }
        $log.debug('cache entry \''+key+'\' has expired.');
        // probably should slice to shrink cache array but...
        delete cache[key];
        return arguments.length > 1 ? arguments[1] : null;
      }
    };
    return service;
}]);