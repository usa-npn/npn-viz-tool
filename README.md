# NPN Visualization Tool

This repository contains a [Node.Js](http://nodejs.org/) caching proxy server to the [USA National Phenology Network](https://usanpn.org/) [NPN Portal Web Services (dev)](http://www-dev.usanpn.org/npn_portal).  In addition to being a proxy server it serves up static content consisting of an [AngularJS](https://angularjs.org/) application implementing the NPN Visualization Tool.

## Development Environment

There are several moving parts to actually developing with this module but everything is managed by [Node.Js](http://nodejs.org/) and npm.  [Node.Js](http://nodejs.org/) - This is both a dependency of the build environment as well as necessary to actually run the proxy server (install on MacOSX with [homebrew](http://brew.sh/) like `brew install node`).

Some of the more interesting ancillary dependencies (which again npm will deal with for you) are:

- [Node.Js](http://nodejs.org/) - Again supports both the build environment and runtime environment.  See `package.json` for a list of dependencies in use.
- [Grunt](http://gruntjs.com/) - A JavaScript task runner used for the build environment.  The included `Gruntfile.js` is the main input to the grunt build tool.  The build process does a lot of stuff like; running htmlhint/jshint against source files to ensure code quality, runs sass compilation against `.scss` files, downloads JavaScript/CSS dependencies and packages them up, runs unit tests (in Chrome), concatenates a distributed set of JavaScript files into a single document for use by applications and minification of JavaScript.
- [bower](http://bower.io/) - Used (via grunt) for JavaScript/CSS dependency management.
- [Chrome](http://www.google.com/chrome/) - Karma/Jasmine tests are run in a Chrome browser that you'll see start/stop during the build.  If running in `watch` mode (as is done via `grunt server`) then the browser will start and remain running during development until you kill the server via `Ctrl-C`.

## Getting Started

If you don't have the [grunt command-line tool](http://gruntjs.com/getting-started) you'll need to install it like:

~~~~
npm install -g grunt-cli
~~~~

**Note:** If you have to run this command via `sudo` to get it to work then there's likely something wrong with your environment, probably how you've been running homebrew.

After cloning this module you'll need to install the node dependencies like:

~~~~
npm install
~~~~

And then the individual dependencies for the proxy server (also a Node.Js application) like:

~~~~
cd server
npm install
~~~~

This only needs to be run once but may need to be re-run if `package.json` changes.  The first run will probably take a minute or so.  When complete there will be a new directory, `node_modules` (ignored via `.gitignore`), containing a bunch of node dependencies.

## Building

To build the project simply run `grunt`.  This will validate and compile the contents of `src` into `server/dist`.  The contents of `server/dist` (the latest compiled version) are committed to the source repository. 

After the build is complete you'll have a few new directories like `bower_components` which contains JavaScript/CSS dependencies and `coverage` which contains auto generated code coverage reports which indicates what lines of JavaScript are, and are not, covered by existing unit tests.

## Developing

The `Gruntfile.js` contains a special target to fire up the proxy server and start a watch on all the source such that as code changes the build re-runs (tests, etc.) and keeps the static content of the server up to date.  Simply run `grunt server`.  This will start the proxy server on port `8000`.  To stop the server simply type `Ctrl-C` in the command window.

Once the server is running you can modify the code found in the `src` directory and changes will be re-built and applied to your server.  The first change tends to take a bit of time to complete but subsequent changes are fairly quick.  Watching the output of the `grunt server` console window will show what's happening.  If you write code that doesn't comply with code quality standards you'll receive an error (and your changes won't be applied).  If you make changes that result in unit test failures you'll receive errors (and your changes won't be applied).

## Directory Structure

- `bower_components` - After an initial build contains JavaScript/CSS dependencies that are used at test time and some of which are delivered up to the static proxy server via `server/dist/lib` (this distribution is handled via the custom `bower` task in `Gruntfile.js`).
- `coverage` - After running `grunt` or `grunt test` will contain a code coverage report for unit tests.
- `node_modules` - After `npm install` will contain Node.Js dependencies.
- `server` - Contains the compiled distributable portion of this repository.
  - `_cache` - After starting a server will contain cached responses from the commenting api.  `grunt server` will run the proxy server in "dev" mode.  In this mode the contents of `_cache` will not be cleaned out on start (and so will be retained indefinitely).  In addition in `dev` mode the server will respond with [CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing) HTTP headers necessary for Cross-origin functionality to work between two separate locally running HTTP servers.
  - `dist` - Contains the compiled AngularJS module/s at the root level and other dependencies in the `css` and `lib` sub-directories.  This is where the contents of `src` will get compiled to.
  - `node_modules` - Node dependencies specific to the proxy server.  These dependencies are managed separately because the contents of `server` are re-distributable and so a `package.json` file is necessary to instruct `npm install` elsewhere what dependencies are necessary at runtime.
  - `caching_proxy.js` - The source of the proxy portion of the server.
  - `server.js` - The base Node.JS server logic that sets up the proxy and serves static content from the `dist` directory.
  - `package.json` - The node dependencies of `server.js` and `caching_proxy.js`
  - `server_control.sh` - A shell script useful for controlling a background instance of the proxy server.
- `src` - Contains the source code for the AngularJS application.
