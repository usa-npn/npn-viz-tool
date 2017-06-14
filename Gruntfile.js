var path = require('path'),
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
          'coverage'
        ],
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
            },
            thirdParty: {
                src: [
                    'node_modules/jquery/dist/jquery.js',
                    'node_modules/angular/angular.js',
                    'node_modules/angular-animate/angular-animate.js',
                    'node_modules/angular-resource/angular-resource.js',
                    'node_modules/angular-sanitize/angular-sanitize.js',
                    'node_modules/angular-ui-bootstrap/dist/ui-bootstrap-tpls.js',
                    'node_modules/lodash/lodash.js',
                    'node_modules/angular-simple-logger/dist/angular-simple-logger.js',
                    'node_modules/angular-google-maps/dist/angular-google-maps.js',
                    'node_modules/isteven-angular-multiselect/isteven-multi-select.js',
                    'node_modules/angular-md5/angular-md5.js',
                    'node_modules/angularjs-slider/dist/rzslider.js',
                    'node_modules/d3/d3.js',
                    'node_modules/topojson/dist/topojson.js',
                    'node_modules/d3-legend/d3.legend.js',
                    'node_modules/innersvg-polyfill/innersvg.js',
                    'node_modules/angular-google-analytics/dist/angular-google-analytics.js',
                ],
                dest: '<%= dist %>/<%= filename %>-3rdparty.js'
            }
        },
        uglify: {
            options: {
                banner: '<%= meta.banner %>'
            },
            dist:{
                src:['<%= concat.dist.dest %>'],
                dest:'<%= dist %>/<%= filename %>.min.js'
            },
            thirdParty: {
                src:['<%= dist %>/<%= filename %>-3rdparty.js'],
                dest:'<%= dist %>/<%= filename %>-3rdparty.min.js'
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
                }],
            },
            thirdParty: {
                files: [{
                    expand: true,
                    src: '**',
                    cwd: 'node_modules/font-awesome/fonts',
                    dest: '<%= dist %>/fonts'
                },{
                    expand: true,
                    src: '**',
                    cwd: 'node_modules/bootstrap-sass/assets/fonts',
                    dest: '<%= dist %>/fonts'
                },{
                    expand: true,
                    cwd: 'node_modules/isteven-angular-multiselect',
                    src: ['isteven-multi-select.css'],
                    dest: '<%= dist %>/css/'
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
                tasks: ['htmlhint','copy:html']
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
            files: ['node_modules/jquery/dist/jquery.js',
                'node_modules/angular/angular.js',
                'node_modules/angular-resource/angular-resource.js',
                'node_modules/angular-ui-bootstrap/dist/ui-bootstrap-tpls.js',
                'node_modules/angular-mocks/angular-mocks.js',
                'node_modules/jasmine-jquery/lib/jasmine-jquery.js',
                'src/js/**/*.js',
                {pattern: 'src/js/*/*.json', watched: true, served: true, included: false}],
            browsers: ['Chrome'],
            frameworks: ['jasmine'],
            reporters: ['progress'],
            color: true,
            autoWatch: false,
            singleRun: false,
            reportSlowerThan: 1000,
            preprocessors: { // coverage config
              'src/js/*.js': ['coverage'],
              'src/js/*/*.js': ['coverage'],
            },
          },
          watch: {
            reporters: ['dots','coverage'],
            singleRun: false,
            background: true,
            reportSlowerThan: 1000,
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
    grunt.registerTask('after-test',['sass','copy:html','copy:img','build']);
    grunt.registerTask('test',['karma:continuous']);

    grunt.renameTask('watch','delta');
    grunt.registerTask('watch',['before-test', 'after-test', 'karma:watch', 'delta']);

    grunt.registerTask('default', ['before-test', 'test', 'after-test']);
    grunt.registerTask('no-test', ['before-test', 'after-test']);

    grunt.registerTask('thirdParty',['concat:thirdParty','uglify:thirdParty','copy:thirdParty']);

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
        grunt.task.run(['concat','uglify:dist']);
    });

    grunt.registerTask('server',function() {
        if(!server){
            grunt.task.run('watch');
            server = grunt.util.spawn({cmd:'node',args:['server.js','--port=8000','--log=dev.log','--dev'],opts:{cwd:'server'}});
        }
    });
};
