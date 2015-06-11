var fs = require('fs'),
    http = require('http'),
    crypto = require('crypto'),
    url = require('url'),
    default_ttl = 300000; // default 5 minutes
/**
 * Creates a new simple GET only proxy to another system that caches results to minimize repeat traffic.
 *
 * @param  {string} dir      The path to the directory where proxy responses are to be cached (need to call init).
 * @param  {string} base_url The base URL to proxy requests to.
 * @param  {Object} ttl      Options
 *   ttl: Number of milliseconds that proxied responses should be kept (time to live).
 * @param  {Object} headers  A static list of headers to issue with proxy requests.
 * @return {Object}          The cache call serve(path,request,response) to use the proxy.
 */
module.exports = function(dir,base_url,opts) {
    var _opts = opts||{};
    if(!_opts.ttl) {
        _opts.ttl = default_ttl;
    }
    var _dir = dir;
    var _base_url = base_url;
    var _base_url_parsed = url.parse(base_url);
    var _preRequestCb = null;
    var _preResponseCb = null;

    // ships a simple internal server error (500)
    function ise(res,err) {
        response.writeHead(500,{'content-type':'text/plain'});
        return response.end(typeof(err) === 'string' ? err :
            (err.message?err.message+' ':'') + JSON.stringify(err));
    }

    // error handler that simply logs the error
    function just_log(err) {
        if(err) {
            console.log("Error: ",err);
        }
    }

    // sends a response from the cache
    function respond(request,response,entry) {
        var cache_file = _dir+'/'+entry;
        console.log('cache_file',cache_file);
        fs.readFile(cache_file+'.headers',function(err,data){
            if(err) { return ise(response,err); }
            var headers = JSON.parse(data),
                statusCode = headers.statusCode,
                stream = fs.createReadStream(cache_file);
            delete headers.statusCode;
            if(_preResponseCb) {
                _preResponseCb(request,headers,cache_file);
            }
            response.writeHead(statusCode,headers);
            stream.pipe(response);
        });
    }

    var service = {
        /**
         * Sets or gets the optional request callback function.  With no arguments is a getter, with _ is a setter and
         * returns the caching_proxy.
         *
         * @param  {Object} _ A callback function that takes arguments (request,get_options).
         * @return {Object}   The current value (if no arguments) or this caching_proxy if _ specified.
         */
        preRequest: function(_) {
            if(!arguments.length) {
                return _preRequestCb;
            }
            _preRequestCb = _;
            return service;
        },
        /**
         * Sets or gets the optional response callback function.  With no arguments is a getter, with _ is a setter and
         * returns the caching_proxy.
         *
         * @param  {Object} _ A callback function that takes arguments (request,headers,cache_file).
         * @return {Object}   The current value (if no arguments) or this caching_proxy if _ specified.
         */
        preResponse: function(_) {
            if(!arguments.length) {
                return _preResponseCb;
            }
            _preResponseCb = _;
            return service;
        },
        /**
         * Initializes the proxy cache.
         *
         * @param  {function} then callback to call upon completion of initialization.
         */
        init: function(then) {
            fs.stat(_dir,function(err,stats){
                if(err && err.code === 'ENOENT') {
                    fs.mkdir(_dir,then); // create and done
                } else if(stats && stats.isDirectory()) {
                    if(_opts.noCleanOnInit) {
                        console.log('instructed to not clean cache.');
                        then(null);
                    } else {
                        console.log('cleaning cache.');
                        fs.readdir(_dir,function(err,list){ // exists, clean it out
                            if(err) return then(err);
                            for(var i = 0; i < list.length; i++) {
                                fs.unlinkSync(_dir+'/'+list[i]);
                            }
                            then(null);
                        });
                    }
                } else {
                    then(err||'unknown error');
                }
            });
        },
        /**
         * Express middleware.
         * Proxies a given request, may serve up from the cache if its a repeat request.
         * Request isn't currently used but may be used in the future if the code decides to be
         * more than a simple GET proxy.
         */
        __express: function(req,res,next) {
            var proxy_url = _base_url+req.originalUrl,
                sha1 = crypto.createHash('sha1').update(proxy_url).digest('hex'),
                proxy_file = _dir+'/'+sha1;

            fs.stat(proxy_file,function(err,stats){
                if(stats && stats.isFile()) {
                    console.log('cproxy cache hit: '+proxy_url+' sha1: '+sha1);
                    return respond(req,res,sha1);
                }
                console.log('proxy cache miss: '+proxy_url+' sha1: '+sha1);
                var getOpts = {
                        host: _base_url_parsed.host,
                        port: _base_url_parsed.port,
                        path: req.originalUrl,
                    };
                if(_preRequestCb) {
                    _preRequestCb(req,getOpts);
                }
                var requestStart = Date.now();
                http.get(getOpts, function(proxy_response){
                    //console.log('headers',proxy_response.headers);
                    delete proxy_response.headers['set-cookie'];
                    if(proxy_response.statusCode !== 200) {
                        console.log('proxy error response: ' + proxy_response.statusCode, proxy_response.headers);
                    }
                    proxy_response.headers.statusCode = proxy_response.statusCode;
                    fs.writeFile(proxy_file+'.headers',JSON.stringify(proxy_response.headers),function(err){
                        if(err) { return ise(res,err); }
                        var cache_file = fs.createWriteStream(proxy_file);
                        console.log('caching response until ', new Date(Date.now()+_opts.ttl) );
                        proxy_response.pipe(cache_file);
                        proxy_response.on('end',function(){
                            console.log('proxy response time: ' +(Date.now()-requestStart) + 'ms');
                            // start a timer that will remove the cache entry after it expires (simple).
                            setTimeout(function(){
                                console.log(proxy_file + ' has expired deleting.');
                                fs.unlink(proxy_file,just_log);
                                fs.unlink(proxy_file+'.headers',just_log);
                            },_opts.ttl);
                            return respond(req,res,sha1); // respond with what was just cached
                        });
                    });
                }).on('error',function(err){
                    console.log("error during proxy request: ", err);
                    ise(res,err);
                });
            });
        }
    };
    return service;
};