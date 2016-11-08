var express = require('express'),
    fs = require('fs'),
    minimist = require('minimist'),
    CachingProxy = require('./caching_proxy'),
    proxyMiddleware = require('express-http-proxy'),
    url = require('url'),
    cdir = fs.realpathSync('.'),
    proxy_cache_ttl = 3600000,
    argv = require('minimist')(process.argv.slice(2)),
    port = Number(argv.port||8000),
    npn_host = 'www.usanpn.org';

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
var cache = new CachingProxy(cdir+'/_cache','http://'+npn_host,{
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
            headers['Access-Control-Expose-Headers'] = 'X-Last-Modified';
        }
    });

cache.init(function(err){ // init cache and start
    if(err) {
        return console.log("Error not starting: ", err);
    }
    console.log('Starting @ ' + cdir + ' on port '+ port);

    var app = express();

    if(argv.dev) {
        app.use(function(req,res,next){
            res.setHeader("Access-Control-Allow-Origin", "*");
            return next();
        });
    }

    app.get('/npn_portal/*',cache.__express);
    app.post('/npn_portal/*', proxyMiddleware(npn_host, {
      forwardPath: function(req, res) {
        var path = url.parse(req.url).path;
        console.log('forwarding POST  for' + path);
        return path;
      }
    }));
    app.post('/ddt/observations/setSearchParams',function(req,res,next){
        res.status(200).end();
    });
    app.get('/results/visualization/data',function(req,res,next){
        res.send('Mock Data Download...');
    });
    app.use(express.static('dist'));
    var server = app.listen(port,function(){
        console.log('Listening at http://%s:%s', server.address().address, server.address().port);
    });
});
