/**
 * @ngdoc overview
 * @name npn-viz-tool.cache
 * @description
 *
 * Caching functionality.
 */
angular.module('npn-viz-tool.vis-cache',[
    'angular-md5'
])
/**
 * @ngdoc service
 * @name npn-viz-tool.cache:CacheService
 * @module npn-viz-tool.cache
 * @description
 *
 * Simple service that can be used to store content for a period of time to avoid needing
 * to return to the server for it.
 */
.factory('CacheService',['$log','$timeout','md5',function($log,$timeout,md5){
    var cache = [];
    var service = {
      /**
       * @ngdoc method
       * @methodOf npn-viz-tool.cache:CacheService
       * @name  keyFromObject
       * @description
       *
       * Generates a unique key (md5 hash) based on an object that can be used as a cache key.
       *
       * @param {object} obj A JavaScript object to generate a key from.
       * @return {string} A unique key that can be used to cache/retrieve something from the cache.
       */
      keyFromObject : function(obj) {
        return md5.createHash(JSON.stringify(obj));
      },
      /**
       * @ngdoc method
       * @methodOf npn-viz-tool.cache:CacheService
       * @name  dump
       * @description
       *
       * Dump the contents of the cache the log (for debug purposes).
       */
      dump : function() {
        $log.debug('cache',cache);
      },
      /**
       * @ngdoc method
       * @methodOf npn-viz-tool.cache:CacheService
       * @name  put
       * @description
       *
       * Place an object in the cache.  The default time to live for an object in the cache is 5 minutes.
       *
       * @param {string} key The cache key to store the object under.
       * @param {object} obj The object to cache.  If null will drop the key from the cache if it exists.
       * @param {int} ttl Optional argument that specifies how long in milliseconds the object should remained cached.  A negative value means the object won't expire.
       */
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
	  
	  
      push : function(key,obj) {
        if ( key == null ) {
          return;
        }
        if ( obj == null ) {
          $log.debug( 'removing cached object \''+key+'\'', cache[key]);
          // probably should slice to shrink cache array but...
          cache[key] = null;
          return;
        }
		
		if(cache[key] && cache[key].length){
			Array.prototype.push.apply(cache[key], obj);			
		}else{
			this.put(key,obj);
		}

      },	  
	  
      /**
       * @ngdoc method
       * @methodOf npn-viz-tool.cache:CacheService
       * @name  get
       * @description
       *
       * Fetch an object from the cache.
       *
       * @param {string} key The cache key of the object to fetch.
       * @returns {object} The object in the cache if still valid or null if not found or expired.
       */
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