module.exports = function(grunt) {

    // files to be minified and combined
    var cssFiles = [
	'public/css/jquery-ui.css',
	'public/css/bootstrap.min.css',
	'public/css/grid.css'
    ];
    var jsFiles = [
    ];
    
    // this is where all the grunt configs will go
    grunt.initConfig({
	// read the package.json
	// pkg will contain a reference to out pakage.json file use of which we will see later
	pkg: grunt.file.readJSON('package.json'),

	// configuration for the cssmin task
	// note that this syntax and options can found on npm page of any grunt plugin/task
	cssmin: {
	    // options for css min task
	    options:{
		// banner to be put on the top of the minified file using package name and todays date
		// note that we are reading our project name using pkg.name i.e name of our project
		banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
	    },
	    combine: {
		// options for combining files
		// we have defined cssFiles variable to hold our file names at the top
		files: {
		    // here key part is output file which will our <package name>.min.css
		    // value part is set of input files which will be combined/minified
		    'public/css/<%= pkg.name %>.min.css': cssFiles
		}
	    }
	},

	htmlmin: {
	    dist: {                                      // Target
		options: {                                 // Target options
		    removeComments: true,
		    collapseWhitespace: true,
		},
		files: {                                   // Dictionary of files
//		    'views/index.html': 'views/index.html',     // 'destination': 'source' cant handle ejs

		}
	    }

	},

	uglify: {
	    options: {
	    banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
	    },
	    my_target: {
		files: {
		    'public/js/<%= pkg.name %>.min.js': jsFiles
		}
	    }
	}
	 

    }); // end of configuring the grunt task

    // Load the plugin that provides the "cssmin" and "htmlmin" task.
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-htmlmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    
    // Default task(s).
    grunt.registerTask('default', ['cssmin', 'uglify', 'htmlmin']);

    // cssmin task
    grunt.registerTask('buildcss', ['cssmin']);
    // htmlmin task
    grunt.registerTask('buildhtml', ['htmlmin']);
    // uglify task
    grunt.registerTask('buildhtml', ['uglify']);

};
