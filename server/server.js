var http = require('http'),
    fs = require('fs'),
    url = require('url'),
    nodeStatic = require('node-static'),
    minimist = require('minimist'),
    CachingProxy = require('./caching_proxy'),
    proxy_regex = /\/npn_portal\//,
    cdir = fs.realpathSync('.'),
    proxy_cache_ttl = 3600000,
    argv = require('minimist')(process.argv.slice(2)),
    port = Number(argv.port||8000);

// validate port
if(isNaN(port) || port < 0 || port > 65535) {
    console.log("Invalid value for --port " + port);
    process.exit(1);
}
// if asked to re-direct to a log file
if(argv.log) {
    var lf = './' + (argv.log === true ? 'server.log' : argv.log),
        log = fs.createWriteStream(lf, {flags: 'a'}),
        util = require('util'),
        stdout = process.stdout;
    console.log = function(msg,obj) {
        if(obj) {
            log.write(util.format('%s - %s\n',msg,obj));
        } else {
            log.write(util.format('%s\n',msg));
        }
    };
}

// setup the proxy cache
var cache = new CachingProxy(cdir+'/_cache','http://www-dev.usanpn.org',{
                    ttl: proxy_cache_ttl,
                    noCleanOnInit: argv.dev
                })
    .preResponse(function(request,headers,cache_file){
        // add an x header stating when the cache the resopnse is served from
        // was last modified so clients can understand how "fresh" the data is
        // value is millis since epoch
        headers['X-Last-Modified'] = fs.statSync(cache_file).mtime.getTime();
        // Include CORS headers only in dev mode.
        if(argv.dev) {
            headers['Access-Control-Allow-Origin'] = "*";
            headers['Access-Control-Expose-Headers'] = 'X-Last-Modified';
        }
    });

// use node-static to serve up local static content
var staticFilesOpts = argv.dev ? {headers: {'Access-Control-Allow-Origin':'*'}} : {},
    staticFiles = new nodeStatic.Server('./dist',staticFilesOpts);

cache.init(bootstrap); // init cache and start

function bootstrap(err) {
    if(err) {
        return console.log("Error not starting: ", err);
    }
    console.log('Starting @ ' + cdir + ' on port '+ port);

    http.createServer(function(request,response){
        if(["GET","HEAD"].indexOf(request.method) === -1) {
            response.writeHead(400,{'content-type':'text/plain'});
            return response.end('unsupported HTTP verb '+request.method);
        }
        var u = url.parse(request.url,true),
            local = u.path.search(proxy_regex) != 0;
        if(local) {
            request.addListener('end',function(){ staticFiles.serve(request,response); }).resume();
        } else {
            cache.serve(u.path,request,response);
        }
    }).listen(port);
}
