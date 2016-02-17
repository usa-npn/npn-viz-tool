var path = require('path'),
    bower = require('bower'),
    fs = require('fs'),
    wrench = require('wrench'),
    server = null;

module.exports = function(grunt){
    // by default load all dependencies prefixed with grunt-
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    grunt.util.linefeed = '\n';

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        dist: 'server/dist',
        filename: 'npn-viz-tool',
        meta: {
            banner: ['/*',
                     ' * <%= pkg.name %>',
                     ' * Version: <%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %>',
                     ' */\n'].join('\n')
        },
        clean: [
          'coverage',
          'bower_components'
        ],
        bower: {
            dest: '<%= dist %>/lib',
            ignore: ['angular-mocks','jasmine.*']
        },
        htmlhint: {
            build: {
                options: {
                    'tag-pair': true,
                    'tagname-lowercase': true,
                    'attr-lowercase': true,
                    'attr-value-double-quotes': true,
                    'doctype-first': true,
                    'spec-char-escape': true,
                    'id-unique': true,
                    'head-script-disabled': true,
                    'style-disabled': true
                },
                src: ['src/*.html']
            },
            templates: {
                options: {
                    'tag-pair': true,
                    'tagname-lowercase': true,
                    'attr-lowercase': true,
                    'attr-value-double-quotes': true,
                    'doctype-first': false,
                    'spec-char-escape': true,
                    'id-unique': true,
                    'head-script-disabled': true,
                    'style-disabled': true
                },
                src: ['src/partials/**/*.html']
            },
        },
        jshint: {
            files: ['Gruntfile.js','src/js/*.js','src/js/**/*.js','!src/js/partials/*.js'],
            options: {
                jshintrc: '.jshintrc'
            }
        },
        html2js: {
            options: {
                base: 'src',
            },
            npnvis: {
                src: ['src/js/**/*.html'],
                dest: 'src/js/partials/templates.html.js'
            }
        },
        concat: {
            dist: {
                options: {
                    banner: '<%= meta.banner %>\n',
                    srcMap: true
                },
                src: [], // list generated in build.
                dest: '<%= dist %>/<%= filename %>.js'
            }
        },
        uglify: {
            options: {
                banner: '<%= meta.banner %>'
            },
            dist:{
                src:['<%= concat.dist.dest %>'],
                dest:'<%= dist %>/<%= filename %>.min.js'
            }
        },
        copy: {
            html: {
                files:[{
                    expand: true,
                    src: '*.html',
                    cwd: 'src/',
                    dest: '<%= dist %>/'
                },{
                    expand: true,
                    src: '*.ico',
                    cwd: 'src/',
                    dest: '<%= dist %>/'
                }]
            },
            /* just keep one copy in dist, not in src
            geojson: {
                files:[{
                    expand: true,
                    src: ['layers/*'],
                    cwd: 'src/',
                    dest: '<%= dist %>/'
                }]
            },*/
            img: {
                files:[{
                    expand: true,
                    src: ['img/*'],
                    cwd: 'src/',
                    dest: '<%= dist %>/'
                }]
            },
            bower_issues: {
                files:[{
                    expand: true,
                    src:'*',
                    cwd:'bower_components/lodash/dist/',
                    dest: '<%= dist %>/lib/lodash'
                }]
            }
        },
        sass: {
            dist: {
                options: {
                    style: 'expanded'
                },
                files: {
                    '<%= dist %>/css/<%= filename %>.css': 'src/css/<%= filename %>.scss'
                }
            }
        },
        ngdocs: {
            options: {
                dest: '<%= dist %>/docs'
            },
            all: ['src/js/**/*.js','src/js/index.ngdoc']
        },
        delta: {
            index: {
                files: ['src/*.html'],
                tasks: ['htmlhint','after-test']
            },
            html: {
                files: ['src/js/**/*.html'],
                tasks: ['html2js', 'karma:watch:run', 'after-test']
            },
            js: {
                files: ['src/js/**/*.js'],
                tasks: ['jshint','karma:watch:run', 'after-test']
            },
            css: {
                files: ['src/css/*.scss'],
                tasks: ['after-test']
            }
        },
        karma: {
          options: {
            files: ['bower_components/jquery/dist/jquery.js',
                'bower_components/angular/angular.js',
                'bower_components/angular-resource/angular-resource.js',
                'bower_components/angular-bootstrap/ui-bootstrap-tpls.js',
                'bower_components/angular-mocks/angular-mocks.js',
                'bower_components/jasmine-jquery/lib/jasmine-jquery.js',
                'src/js/**/*.js',
                {pattern: 'src/js/*/*.json', watched: true, served: true, included: false}],
            browsers: ['Chrome'],
            frameworks: ['jasmine'],
            reporters: ['progress'],
            color: true,
            autoWatch: false,
            singleRun: false,
            reportSlowerThan: 200,
            preprocessors: { // coverage config
              'src/js/*.js': ['coverage'],
              'src/js/*/*.js': ['coverage'],
            },
          },
          watch: {
            reporters: ['dots','coverage'],
            singleRun: false,
            background: true
          },
          continuous: {
            reporters: ['dots','coverage'],
            singleRun: true
          },
          jenkins: {
            singleRun: true,
            colors: false,
            reporters: ['dots', 'junit'],
            browsers: ['Chrome', 'Firefox']
          },
          coverage: {
            reporters: ['progress', 'coverage'],
            singleRun: true
          }
        }
    });

    grunt.registerTask('before-test',['htmlhint','jshint','html2js']);
    grunt.registerTask('after-test',['sass','copy','build']);
    grunt.registerTask('test',['karma:continuous']);

    grunt.renameTask('watch','delta');
    grunt.registerTask('watch',['before-test', 'after-test', 'karma:watch', 'delta']);

    grunt.registerTask('default', ['before-test', 'test', 'after-test']);

    grunt.registerTask('build',function() {
        var jsSrc = [];
        // there is no semblance of order here so need to be careful about
        // dependencies between .js files
        grunt.file.expand({filter: 'isFile', cwd: '.'}, 'src/js/**')
             .forEach(function(f){
                if(f.search(/\.js$/) > 0 && f.search(/\.spec\.js$/) === -1) {
                    jsSrc.push(f);
                }
             });
        grunt.config('concat.dist.src', grunt.config('concat.dist.src').concat(jsSrc));
        grunt.task.run(['concat','uglify']);
    });

    grunt.registerTask('server',function() {
        if(!server){
            grunt.task.run('watch');
            server = grunt.util.spawn({cmd:'node',args:['server.js','--port=8000','--log=dev.log','--dev'],opts:{cwd:'server'}});
        }
    });

    // per the bower.json spec (https://github.com/bower/bower.json-spec) the .main
    // property lists the files required to use a package but should NOT include minimized
    // files.  all grunt bower related plugins appear to use main as is and not intelligently
    // deliver minified versions of things if they are also included...  so writing my own
    // task to include bower production dependencies including ancillary copies of files
    // like *.min.[js|css][.map]
    // this implementation uses a vendor specific delivery method and retains the organization
    // of files as they were delivered by the vender.  other grunt bower utilities typically
    // re-organize things which could definitely break things (e.g. relative path usage in css).
    grunt.registerTask('bower','local custom handling of bower component installation.',function(){
        var done = this.async(),
            config = grunt.config('bower'),
            verbose = grunt.option('verbose');
        function ancillary(bower_json,source) {
            var ext = source.replace(/^[^\.]*\./,''),
                ancillaryFilter = source.replace('.'+ext,'.*'+ext+'*');
            grunt.file.expand({filter:'isFile',cwd:'.'},ancillaryFilter)
                .forEach(function(f){
                    if(f != source) {
                        f = f.replace(/^bower_components\/[^\/]*\//,'');
                        install(bower_json,f);
                    }
                });
        }
        function install(bower_json,asset) {
            var source = path.join('./bower_components',bower_json.dir,asset).replace(/\/\*/,''),
                sourceDir = fs.statSync(source).isDirectory(),
                destination = path.join(bower_json.dest,asset.replace(/^dist\//,'').replace(/\/\*/,'')),
                installAncillary = (arguments.length === 2 || (arguments.length === 3 && arguments[2]));
            if(sourceDir){
                if(verbose){
                    grunt.log.writeln (['copying directory'.cyan, source.green,'to',destination.cyan].join(' '));
                }
                wrench.copyDirSyncRecursive(source, destination);
            } else {
                if(verbose) {
                    grunt.log.writeln(['copying'.cyan,source,'to',destination].join(' '));
                }
                grunt.file.copy(source,destination);
                if(installAncillary) {
                    ancillary(bower_json,source);
                }
            }
        }
        function postInstall() {
            grunt.log.writeln(['bower.install','complete'.green].join(' '));
            grunt.file.mkdir(config.dest);
            grunt.file.expand({filter:'isFile', cwd: '.'},'bower_components/*/bower.json')
                .forEach(function(f){
                    var bower_json = grunt.file.readJSON(f),
                        ignore = false,i;
                    bower_json.dir = f.replace(/\/bower.json/,'').replace(/^.*\//,'');
                    if(config.ignore) {
                        for(i = 0; i < config.ignore.length; i++) {
                            if((ignore=(bower_json.dir.search(config.ignore[i]) != -1))) {
                                break;
                            }
                        }
                    }
                    if(!ignore) {
                        bower_json.dest = path.join(config.dest,bower_json.dir);
                        if(typeof(bower_json.main) === 'string') {
                            bower_json.main = [bower_json.main];
                        }
                        if(verbose){
                            grunt.log.writeln(bower_json.name.green,bower_json.main);
                        }
                        bower_json.main.forEach(function(asset){install(bower_json,asset);});
                    }
                });
            done();
        }
        bower.commands.install([],{})
            .on('log', function(result){
                if(verbose) {
                    grunt.log.writeln(['bower',result.id.cyan,result.message].join(' '));
                }
            })
            .on('error',grunt.fail.fatal)
            .on('end',postInstall);
    });
};
