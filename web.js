var express = require('express')
  , http    = require('http')
  , path    = require('path')
  , fs      = require('fs')
  , async   = require('async')
  , request = require('request')
  , db      = require('./models')
  , passport = require('passport')
  , util = require('util')
  , PersonaStrategy = require('passport-persona').Strategy
  , TwitterStrategy = require('passport-twitter').Strategy
  , FacebookStrategy = require('passport-facebook').Strategy
  , Constants = require('./constants')
  , ROUTES  = require('./routes')
  , Functions = require('./functions');


var build_errfn = function(errmsg, response) {
    return function errfn(err) { 
	console.log(err);
	response.send(errmsg);
    };
};

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the BrowserID verified email address
//   is serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// Use the PersonaStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a BrowserID verified email address), and invoke
//   a callback with a user object.
passport.use(new PersonaStrategy({
    audience: 'ec2-54-213-78-101.us-west-2.compute.amazonaws.com:7080'
  },
  function(email, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      
      // To keep the example simple, the user's email address is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the email address with a user record in your database, and
      // return that user instead.
      return done(null, { email: email })
    });
  }
));

// Use the TwitterStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a token, tokenSecret, and Twitter profile), and
//   invoke a callback with a user object.
passport.use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: "http://ec2-54-213-78-101.us-west-2.compute.amazonaws.com:7080/auth/twitter/callback"
  },
  function(token, tokenSecret, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      // To keep the example simple, the user's Twitter profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the Twitter account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));


// Use the FacebookStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Facebook
//   profile), and invoke a callback with a user object.
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://ec2-54-213-78-101.us-west-2.compute.amazonaws.com:7080/auth/facebook/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      
      // To keep the example simple, the user's Facebook profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the Facebook account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));



/*
  Initialize the Express app, the E in the MEAN stack (from mean.io).

  Templates: First, we configure the directory in which the Express app will
  look for templates, as well as the engine it'll use to interpret them (in
  this case Embedded JS). So we can use the views/orderpage.ejs and
  views/homepage.ejs files in response.render (see routes.js).

  Port: We then set up the port that the app will listen on by parsing the
  variable that's configured in .env (or else using a default).

  Static file serving: Then we set up express for static file serving, by
  making the entire content under '/public' accessible on the WWW. Thus
  every file <file-name> in /public is served at example.com/<file-name>. We
  specifically instruct the app to look for a particular file called the
  favicon.ico; this is what browsers use to represent minified sites in
  tabs, bookmarks, and favorites (hence 'favicon = favorite icon'). By
  default the query would go to example.com/favicon.ico, but we redirect it
  to example.com/public/img/favicon.ico as shown.

  Logging: We set up a convenient dev logger so that you can watch
  network requests to express in realtime. Run foreman start in the home
  directory after following the instructions in README.md and Express
  will begin printing logging information to the command line.

  Routes: We have separated the routing information into a separate
  routes.js file, which we import. This tell the app what function to
  execute when a client accesses a URL like example.com/ or
  example.com/orders. See routes.js for more details.

  Init: Finally, we synchronize the database, start the HTTP server, and
  also start a simple 'daemon' in the background via the setInterval
  command.

  Regarding the daemon: this is a great example of the use of asynchronous
  programming and object-oriented programming.

  First, some background: A daemon is a process that runs in the background
  at specified intervals; for example, you'd use it to keep a search index
  up to date, run an antivirus scan, or periodically defrag a hard
  drive. You also want to use daemons to synchronize with remote services
  and update dashboards. Why? Let's say you have 10000 people visiting your
  website per hour, and on the front page you have some kind of statistic
  that depends on an API call to a remote website (e.g. the number of Tweets
  that mention a particular string). If you do it naively and query the
  remote servers each time, you will repeat work for each new HTTP request
  and issue 10000 API calls in just an hour. This will probably get you
  banned. The underlying problems is that you do not want to have the number
  of API calls scale with the number of viewers. So instead you have a
  'daemon' running asynchronously in the background that refreshes the
  displayed statistic every 10 minutes (say), such that you only make 6 API
  calls per hour rather than N=10000 or more.

  In our app, the statistic we are displaying on the front page is the
  thermometer and the remote service is Coinbase. The idea is that we want
  to hit the remote Coinbase servers at regular intervals to mirror the
  order data locally. Previously, we added the capability to manually force
  mirroring of the Coinbase data to the local server by navigating to
  example.com/refresh_orders, which will trigger the refresh_orderfn in
  routes.js. However, by isolating the refresh code to a single method
  invocation (global.db.Order.refreshFromCoinbase), we can also call it in
  another function. We do so within the scope of a setInterval invocation
  (below), which calls the specified function periodically.  Now we can
  refresh in two places.

  So, to recap: by isolating the refresh code within a method call on the
  Order object, we could call it in two places. And by using the built-in
  asynchronous features of node, we can easily have both the HTTP server and
  the setInterval daemon working at the same time: the server is listening
  for requests while the daemon is working in the background on a periodic
  schedule.
*/
var app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set('port', process.env.PORT || 7080);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.favicon(path.join(__dirname, 'public/img/favicon.ico')));
app.use(express.logger("dev"));
app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: 'keyboard cat' }));
  // Initialize Passport!  Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  app.use(passport.initialize());
  app.use(passport.session());
app.post('/auth/browserid', 
  passport.authenticate('persona', { failureRedirect: '/login' }),
  function(req, res) {
      console.log("Assumed Persona Logged in - Check if user account exists.");
      global.db.PersonaUser.addPersonaUserElseContinue(req.user.email, function(){});
      res.redirect('/');
  });

// api for jQuery posting of stories read
app.post('/api/addstoryread', function(req, res) {
    var build_errfn = function(errmsg, response) {                                                                                                                                                        
    return function errfn(err) {
        console.log(err);                                                                                                                                                                                  
        response.send(errmsg);
    };                                                                                                                                                                                                     
    };

    if(req.user.provider == "twitter"){
	var successcb = function(){
	    res.writeHead(200, {'Content-Type': 'text/plain'});
	    res.end();
	    console.log("Add story api posted to by twitter id: " + req.user.id + " Story viewed: " + req.body.storyViewed)
	};
	var errcb = build_errfn('error posting to stories read', res);
	global.db.TwitterHistory.addToStoriesRead(req.user.id, req.body.storyViewed, successcb, errcb);
    }else if (req.user.provider == "facebook"){
	var successcb = function(){
	    res.writeHead(200, {'Content-Type': 'text/plain'});
	    res.end();
	    console.log("Add story api posted to by facebook id: " + req.user.id + " Story viewed: " + req.body.storyViewed)
	};
	var errcb = build_errfn('error posting to stories read', res);
	global.db.FacebookHistory.addToStoriesRead(req.user.id, req.body.storyViewed, successcb, errcb);
    } else{
	var successcb = function(){
	    res.writeHead(200, {'Content-Type': 'text/plain'});
	    res.end();
	    console.log("Add story api posted to by persona email: " + req.user.email + " Story viewed: " + req.body.storyViewed)
	};
	var errcb = build_errfn('error posting to stories read', res);
	global.db.PersonaHistory.addToStoriesRead(req.user.email, req.body.storyViewed, successcb, errcb);
    }

});




// api for jQuery posting of stories favorited
app.post('/api/addstoryfavorited', function(req, res) {
    var build_errfn = function(errmsg, response) {                                                                                                                                                        
    return function errfn(err) {
        console.log(err);                                                                                                                                                                                  
        response.send(errmsg);
    };                                                                                                                                                                                                     
    };

    if(req.user.provider == "twitter"){
	var successcb = function(){
	    res.writeHead(200, {'Content-Type': 'text/plain'});
	    res.end();
	};
	var errcb = build_errfn('error posting to stories favourited', res);
	global.db.TwitterFavorites.addToStoriesFavorited(req.user.id, req.body.storyFavorited, successcb, errcb);
    }else if (req.user.provider == "facebook"){
	var successcb = function(){
	    res.writeHead(200, {'Content-Type': 'text/plain'});
	    res.end();
	};
	var errcb = build_errfn('error posting to stories favorited', res);
	global.db.FacebookFavorites.addToStoriesFavorited(req.user.id, req.body.storyFavorited, successcb, errcb);
    } else{
	var successcb = function(){
	    res.writeHead(200, {'Content-Type': 'text/plain'});
	    res.end();
	};
	var errcb = build_errfn('error posting to stories read', res);
	global.db.PersonaFavorites.addToStoriesFavorited(req.user.email, req.body.storyFavorited, successcb, errcb);
    }

});


// api for jQuery posting of stories UNfavorited
app.post('/api/removestoryfavorited', function(req, res) {
    var build_errfn = function(errmsg, response) {                                                                                                                                                        
    return function errfn(err) {
        console.log(err);                                                                                                                                                                                  
        response.send(errmsg);
    };                                                                                                                                                                                                     
    };

    if(req.user.provider == "twitter"){
	var successcb = function(){
	    res.writeHead(200, {'Content-Type': 'text/plain'});
	    res.end();
	};
	var errcb = build_errfn('error posting to stories favourited', res);
	global.db.TwitterFavorites.removeFromStoriesFavorited(req.user.id, req.body.storyFavorited, successcb, errcb);
    }else if (req.user.provider == "facebook"){
	var successcb = function(){
	    res.writeHead(200, {'Content-Type': 'text/plain'});
	    res.end();
	};
	var errcb = build_errfn('error posting to stories favorited', res);
	global.db.FacebookFavorites.removeFromStoriesFavorited(req.user.id, req.body.storyFavorited, successcb, errcb);
    } else{
	var successcb = function(){
	    res.writeHead(200, {'Content-Type': 'text/plain'});
	    res.end();
	};
	var errcb = build_errfn('error posting to stories read', res);
	global.db.PersonaFavorites.removeFromStoriesFavorited(req.user.email, req.body.storyFavorited, successcb, errcb);
    }

});
                                               

//add in middleware function here as this is where the app.get construct is made
// Below: add middleware if it exists else don't. Simples.
for(var ii in ROUTES) {
    if(!ROUTES[ii].middleware){
	app.get(ROUTES[ii].path, ROUTES[ii].fn);
    } else {
	app.get(ROUTES[ii].path, ROUTES[ii].middleware, ROUTES[ii].fn);
    }
}



// constructHomepage Function
var constructHomepage = function() {
    console.log("Construct Homepage at " + new Date()); 
    var today = new Date();
    var dateOffset = (24*60*60*1000) * 30; //30 days                                                                    
    var myDate = new Date(today.getTime() - dateOffset);
    var dateSince = myDate.toUTCString(); 
    // Async task
    function async(arg, callback) {
	switch(arg){
	case 'viewed':
	    Functions.get_popular_list_full(dateSince, callback);
	    break;
	}
    }
    // Final task (same in all the examples)
    function final() { 
	var successcb = function(world_bbc_stories_json){
	    app.render("homepage", {
		popular_list: results[0],
		world_bbc_stories: world_bbc_stories_json,
		name: Constants.APP_NAME,
		title:  Constants.APP_NAME,
		test_news_image: Constants.TESTIMAGE,
		product_name: Constants.PRODUCT_NAME,
		twitter_username: Constants.TWITTER_USERNAME,
		twitter_tweet: Constants.TWITTER_TWEET,
		product_short_description: Constants.PRODUCT_SHORT_DESCRIPTION,
		coinbase_preorder_data_code: Constants.COINBASE_PREORDER_DATA_CODE
	    }, function(err,html) {
		// handling of the rendered html output goes here
		fs.writeFile(__dirname + "/views/rhomepage.ejs", html, function(err) {
		    if(err) {
			console.log("Failed to render new homepage html")
			console.log(err);
		    } else {
			console.log("The newly rendered homepage html was saved!");
		    }
		}); 				
	    });
	};
	var errcb = build_errfn('unable to retrieve orders');

	global.db.Order.allToJSON(successcb, errcb); 
    };
    
    // A simple async series:
    var items = ['viewed'];
    var results = [];
    function series(item) {
	if(item) {
	    async( item, function(result) {
		results.push(result);
		return series(items.shift());
	    });
	} else {
	    return final();
	}
    }
    series(items.shift());


};



// construct popular page function constructPopular
var constructPopular = function() { 
    console.log("Construct Popular at " + new Date()); 
    var today = new Date();
    var dateOffset = (24*60*60*1000) * 30; //30 days                                                                    
    var myDate = new Date(today.getTime() - dateOffset);
    var dateSince = myDate.toUTCString(); 
    // Async task
    function async(arg, callback) {
	switch(arg){
	case 'get popular':
	    Functions.get_popular_list(dateSince, 60, callback);
	    break;
	}
    }
    // Async retrieve stories from db
    function retrieveStories() { 
	function async(arg, callback) {
	    global.db.Order.findFromPublished(arg, callback);
	}

	function final() { 
	    console.log('Done', results.length);
	    var resultsArray = [];
	    results.forEach(function(obj){
		try {
		    obj = JSON.parse(obj);
		    obj.viewedCount = popularList[0][obj.published];
		    resultsArray.push(obj);			
		} catch(e){
		    console.error("Parsing error:", e); 
		}
		
	    });
	    function compare(a,b) {
		if (a["viewedCount"] < b["viewedCount"])
		    return -1;
		if (a["viewedCount"] > b["viewedCount"])
		    return 1;
		return 0;
	    }
 	    var sortedArray = resultsArray.sort(compare);
	    
	    //finally write results to popular html
	    app.render("popular", {
		popular_list_stories: resultsArray,
		name: Constants.APP_NAME,
		title:  Constants.APP_NAME,
		test_news_image: Constants.TESTIMAGE,
		product_name: Constants.PRODUCT_NAME,
		twitter_username: Constants.TWITTER_USERNAME,
		twitter_tweet: Constants.TWITTER_TWEET,
		product_short_description: Constants.PRODUCT_SHORT_DESCRIPTION,
		coinbase_preorder_data_code: Constants.COINBASE_PREORDER_DATA_CODE
	    }, function(err,html) {
		// handling of the rendered html output goes here
		fs.writeFile(__dirname + "/views/rpopular.ejs", html, function(err) {
		    if(err) {
			console.log("Failed to render new popular html")
			console.log(err);
		    } else {
			console.log("The newly rendered popular html was saved!");
		    }
		}); 				
	    });	    
	}
	
        //get number of objects
        var objnum = 0; 
        for(key in popularList[0]){objnum++};
        

        // add in null count incase some queries dont return
        var nullcount = 0;
        
        // begin async queries and construct a array of
        for(key in popularList[0]){
            var storyKey = key;
            var storyValue = popularList[0][storyKey];
            async(storyKey, function(result){
                if(result === null){
                    nullcount++;
                 } else { 
                    results.push(result);
                    if(results.length + nullcount == objnum) {
                        console.log("null count of failed popular story queries: " + nullcount + " success count: " + results.length);
                        final();
                    }
                };
            });
        };                    
    }
    
    // A simple async series:
    var items = ['get popular'];
    var popularList = [];
    var results = [];
    function series(item) {
        if(item) {
            async( item, function(result) {
                popularList.push(result);
                return series(items.shift());
            });
        } else {
            return retrieveStories();
        }
    }
    series(items.shift());
    
};



global.db.sequelize.sync().complete(function(err) {
    if (err) {
	throw err;
    } else {
	var DB_REFRESH_INTERVAL_SECONDS = 200; //Change for production to 100 or 200  -  use 50 for dev
	async.series([
	    function(cb) {
		// Mirror the orders before booting up the server
		console.log("Initial pull from BBC News api at " + new Date());
		global.db.Order.refreshFromCoinbase(cb);
		console.log("Initial construct Homepage at " + new Date());
		constructHomepage();
		console.log("Initial construct Popular at " + new Date());
		constructPopular();

	    }, 
	    function(cb) {
		// Begin listening for HTTP requests to Express app
		http.createServer(app).listen(app.get('port'), function() {
		    console.log("Listening on " + app.get('port'));
		});


		// Start a daemon to auto construct the homepage grid to a static file
		setInterval(constructHomepage, DB_REFRESH_INTERVAL_SECONDS*1000); 

		// start a daemon to auto construct most popular page:
		setInterval(constructPopular, (DB_REFRESH_INTERVAL_SECONDS*2)*1000); 


		// Start a simple daemon to refresh Coinbase orders periodically
/*		setInterval(function() {
		    console.log("Refresh news db at " + new Date());
		    global.db.Order.refreshFromCoinbase(cb);
		}, DB_REFRESH_INTERVAL_SECONDS*1000); */
		cb(null);
	    } 
	]);
    }
});

// 404 error handling must go last see: http://expressjs.com/faq.html how do you handle 404s? 
app.use(function(req, res, next){
  res.status(404);
    res.render('404');
});
