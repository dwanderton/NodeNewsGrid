var uu      = require('underscore')
  , db      = require('./models')
  , passport = require('passport')
  , util = require('util')
  , PersonaStrategy = require('passport-persona').Strategy
  , TwitterStrategy = require('passport-twitter').Strategy
  , Constants = require('./constants')
  , Functions = require('./functions');

var build_errfn = function(errmsg, response) {
    return function errfn(err) {
	console.log(err);
	response.send(errmsg);
    };
};

/*
   Define the routes for the app, i.e. the functions
   which are executed once specific URLs are encountered.

    example.com/ -> indexfn
    example.com/orders -> orderfn
    example.com/refresh_orders -> refresh_orderfn
    example.com/api/orders -> api_orderfn

   Specifically, in each case we get an HTTP request as a JS object
   ('request') and use it along with internal server variables to synthesize
   and return an HTTP response ('response'). In our simple example none of
   the features of the request are used aside from the path itself; in a
   more complex example you might want to return different results on the
   basis of the user's IP.

   The responses are generated by accessing the "Order" table in the local
   PostgreSQL database through the Sequelize ORM (specifically through
   model/order.js) and using the resulting Order instances to either
   populate server-side templates (via response.render), to trigger a
   redirect to another URL (via response.redirect), or to directly send data
   (via response.json or response.send).

   Note that to the maximum extent possible, these handler functions do not
   do heavy work on Order instances. We save that for the classMethods and
   instanceMethods defined in model/order.js. Instead, route handlers focus
   on the networking aspects of parsing the request and response, initiating
   the query to the database, and packaging it all up in a request.
*/
var indexfn = function(req, res) {
    var showIndex = function(){ 
	res.render("rhomepage");
	};
    ensureAuthenticated(req, res, showIndex());
};


var dashboardfn = function(request, response) {
    console.log("dashboard accessed");
    var successcb = function() {
	response.render("dashboard", {
	user: request.user,
	name: Constants.APP_NAME,
	title:  Constants.APP_NAME,
	test_news_image: Constants.TESTIMAGE,
	product_name: Constants.PRODUCT_NAME,
	twitter_username: Constants.TWITTER_USERNAME,
	twitter_tweet: Constants.TWITTER_TWEET,
	product_short_description: Constants.PRODUCT_SHORT_DESCRIPTION,
	coinbase_preorder_data_code: Constants.COINBASE_PREORDER_DATA_CODE
	});
    };
    var errcb = build_errfn('error obtaining dashboard stats', response);
    ensureAuthenticated(request, response, global.db.Order.allToJSON(successcb, errcb));
    
};


var popularfn = function(req, res){
    var showMostPop = function(){
	res.render("rpopular");
    };
    ensureAuthenticated(req, res, showMostPop());
};

var favoritefn = function(request, response) { 
    var favoriteInternal = function(){
	console.log("Construct Favorite at " + new Date()); 
	var today = new Date();
	var dateOffset = (24*60*60*1000) * 30; //30 days                                                                    
	var myDate = new Date(today.getTime() - dateOffset);
	var dateSince = myDate.toUTCString(); 
	// Async task
	function async(arg, callback) {
            switch(arg){
            case 'favorite':
		Functions.get_favorite_list(dateSince, 60, request.user.provider, request.user.id, callback);
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
			resultsArray.push(obj);                        
		    } catch(e){
			console.error("Parsing error:", e); 
                    }
                    
		});
		console.log("resultsArray: " + resultsArray);
		response.render("favorite", {
		    list_stories: resultsArray,
                    name: Constants.APP_NAME,
                    title:  Constants.APP_NAME,
                    test_news_image: Constants.TESTIMAGE,
                    product_name: Constants.PRODUCT_NAME,
                    twitter_username: Constants.TWITTER_USERNAME,
                    twitter_tweet: Constants.TWITTER_TWEET,
                    product_short_description: Constants.PRODUCT_SHORT_DESCRIPTION,
                    coinbase_preorder_data_code: Constants.COINBASE_PREORDER_DATA_CODE
		});
            }

            //get number of objects
            var objnum = 0; 
            for(key in favoriteList[0]){objnum++};
            

            // add in null count incase some queries dont return
            var nullcount = 0;
            console.log(favoriteList[0]);
            // begin async queries and construct a array of
            for(key in favoriteList[0]){
		var storyKey = key;
		var storyValue = favoriteList[0][storyKey]['bbcpublished'];
		console.log("storyKey: " + storyKey + "storyValue: " + storyValue);
		async(storyValue, function(result){
                    if(result === null){
			nullcount++;
                    } else { 
			results.push(result);
			if(results.length + nullcount == objnum) {
                            console.log("null count of failed favorite story queries: " + nullcount + " success count: " + results.length);
                            final();
			}
                    };
		});
            };                    
	}
	
	// A simple async series:
	var items = ['favorite'];
	var favoriteList = [];
	var results = [];
	function series(item) {
	    console.log("series");
            if(item) {
		async( item, function(result) {
                    favoriteList.push(result[0]);
		    return series(items.shift());
		});
            } else {
		return retrieveStories();
            }
	}
	series(items.shift());
    }

    ensureAuthenticated(request, response, favoriteInternal);  
};



// POST /auth/browserid
//  in web.js



// GET /auth/twitter
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Twitter authentication will involve redirecting
//   the user to twitter.com.  After authorization, the Twitter will redirect
//   the user back to this application at /auth/twitter/callback
var twitterAuthenticatefn =   
  function(req, res){
    // The request will be redirected to Twitter for authentication, so this
    // function will not be called.
  };


// GET /auth/twitter/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
var twitterCallbackAuthenticatefn =
  function(req, res) {
      global.db.TwitterUser.addTwitterUserElseContinue(req.user.id, function(){});
      res.redirect('/');
  };

// GET /auth/facebook
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Facebook authentication will involve
//   redirecting the user to facebook.com.  After authorization, Facebook will
//   redirect the user back to this application at /auth/facebook/callback
var facebookAuthenticatefn =
  function(req, res){
    // The request will be redirected to Facebook for authentication, so this
    // function will not be called.
  };

// GET /auth/facebook/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
var facebookCallbackAuthenticatefn =
  function(req, res) {
    global.db.FacebookUser.addFacebookUserElseContinue(req.user.id, function(){});
    res.redirect('/');
  };





var loginfn = function(req, res){
    res.render('login', { user: req.user });
};

var logoutfn = 
    function(req, res){
	req.logout();
	res.redirect('/login');
    };


var orderfn = function(request, response) {
    var successcb = function(world_bbc_stories_json) {
	response.render("orderpage", {world_bbc_stories: world_bbc_stories_json});
    };
    var errcb = build_errfn('error retrieving orders', response);
    ensureAuthenticated(request, response, global.db.Order.allToJSON(successcb, errcb));
};

var api_orderfn = function(request, response) {
    var successcb = function() {
	var data = uu.extend(
			     {
			      name: "My name is David"
			     });
	response.json(data);
    };
    var errcb = build_errfn('error retrieving API orders', response);
    ensureAuthenticated(request, response, successcb());
};


var api_storyreadfn = function(req, res) {
    var successcb = function(storiesRead) {
	var data = storiesRead;
	res.json(data);
    };
    var errcb = build_errfn('error posting to stories read', res);
    if(req.user.provider == "twitter"){
	        ensureAuthenticated(req, res, global.db.TwitterHistory.listOfStoriesRead(req.user.id, successcb, errcb)); 
    } else if (req.user.provider == "facebook"){
	ensureAuthenticated(req, res, global.db.FacebookHistory.listOfStoriesRead(req.user.id, successcb, errcb));
        } else{
	    ensureAuthenticated(req, res, global.db.PersonaHistory.listOfStoriesRead(req.user.email, successcb, errcb));
        }
};

var api_storyfavoritedfn = function(req, res) {
    var successcb = function(storiesRead) {
	var data = storiesRead;
	res.json(data);
    };
    var errcb = build_errfn('error posting to stories read', res);
    if(req.user.provider == "twitter"){
	        ensureAuthenticated(req, res, global.db.TwitterFavorites.listOfStoriesFavorited(req.user.id, successcb, errcb)); 
    } else if (req.user.provider == "facebook"){
	ensureAuthenticated(req, res, global.db.FacebookFavorites.listOfStoriesFavorited(req.user.id, successcb, errcb));
        } else{
	    ensureAuthenticated(req, res, global.db.PersonaFavorites.listOfStoriesFavorited(req.user.email, successcb, errcb));
        }
};

var api_popularfn = function(req, res) {
    
    var errcb = build_errfn('error requesting stories viewed count',res);
    var today = new Date();
    var dateOffset = (24*60*60*1000) * 30; //30 days
    var myDate = new Date(today.getTime() - dateOffset);
    var dateSince = myDate.toUTCString();
    var successcb = function(){
	console.log("Success cb called")
	
	var cb = function(data){
	    res.json(data);
	};
	Functions.get_popular_list(dateSince, 60, cb);
    };
    console.log("Api popular called");
    ensureAuthenticated(req, res, successcb());
};

var refresh_orderfn = function(request, response) {
    var cb = function(err) {
	if(err) {
	    console.log("Error in refresh_orderfn");
	    response.send("Error refreshing orders.");
	} else {
	    response.redirect("/orders");
	}
    };
    ensureAuthenticated(request, response, global.db.Order.refreshFromCoinbase(cb));
};


/*
   Helper functions which create a ROUTES array for export and use by web.js

   Each element in the ROUTES array has three fields: path, middleware and fn,
   corresponding to the relative path (the resource asked for by the HTTP
   request) the middleware employed and the function executed when that resource is requested.

   // current version:
     [ { path: '/': [middleware, Function] },
       { path: '/orders', [middleware, Function] },
       { path: '/api/orders', [middleware, Function] },
       { path: '/refresh_orders', [middleware, Function]} ]

   It is certainly possible to implement define_routes with a simple for
   loop, but we use a few underscore methods (object, zip, map, pairs), just
   to familiarize you with the use of functional programming, which
   becomes more necessary when dealing with async programming.
*/
var define_routes = function(dict) {
    var toroute = function(item) {
	return uu.object(uu.zip(['path','middleware', 'fn'], [item[0], item[1][0], item[1][1]]));
    };
    return uu.map(uu.pairs(dict), toroute);
}; 

var ROUTES = define_routes({
    '/': [undefined, indexfn],
    '/login': [undefined, loginfn],
    '/logout': [ undefined, logoutfn],
    '/popular': [ undefined, popularfn],
    '/favorites':[ undefined, favoritefn],
    // Now is in web.js as post not get request (this list is converted to gets )   '/auth/browserid': [passport.authenticate('persona', { failureRedirect: '/login' }), personaAuthenticatefn],
    '/auth/twitter': [passport.authenticate('twitter'), twitterAuthenticatefn],
    '/auth/twitter/callback': [passport.authenticate('twitter', { failureRedirect: '/login' }), twitterCallbackAuthenticatefn],
    '/auth/facebook': [passport.authenticate('facebook'), facebookAuthenticatefn],
    '/auth/facebook/callback':[passport.authenticate('facebook', { failureRedirect: '/login' }), facebookCallbackAuthenticatefn],
    '/dashboard': [undefined, dashboardfn],
    '/orders': [undefined, orderfn],
    '/api/orders': [undefined, api_orderfn],
    '/api/storyread': [undefined, api_storyreadfn],
    '/api/storyfavorited': [undefined, api_storyfavoritedfn],
    '/api/popular': [undefined, api_popularfn],
    '/refresh_orders': [undefined, refresh_orderfn]
});

// Simple route middleware to ensure user is authenticated. 
//   Use this route middleware on any resource that needs to be protected.  If                                  
//   the request is authenticated (typically via a persistent login session),                                   
//   the request will proceed.  Otherwise, the user will be redirected to the                                   //   login page. 
function ensureAuthenticated(req, res, next) { 
  if (req.isAuthenticated()) { if(typeof(next)=="function"){ return next();} else { return next; }; }
    // consider passing the intended journey location to redirect so that the user journey can continue as planned
  res.redirect('/login')
}


module.exports = ROUTES;
