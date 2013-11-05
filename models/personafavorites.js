/*
View history database for persona users 
*/
var async = require('async');
var util = require('util');
var uu = require('underscore');
var coinbase = require('./coinbase');

module.exports = function(sequelize, DataTypes) {
    return sequelize.define("personafavorites", {
	email: {type: DataTypes.STRING(75), allowNull:false},
	bbcpublished: {type: DataTypes.BIGINT, allowNull: false}
    }, {
	classMethods: {
	    numPersonaStoriesFavorited: function() {
		this.count().success(function(c) {
		    console.log("There have been  %s stories read by Persona Users", c);});
	    },
	    listOfStoriesFavorited: function(userEmail, successcb, errcb) {
                this.findAll({where: {email: userEmail}, attributes: ['bbcpublished']}).success(function(storiesRead) {
                    successcb(storiesRead);
                }).error(errcb);
            },
            storiesFavoritedSinceJSON: function(dateSince, cb){
                console.log("Test date since: "+ dateSince + "cb " + cb);
                if(dateSince){
		    this.findAll({ where:['"createdAt"::date > ?', dateSince], attributes: ['bbcpublished']} ).success(function(storiesRead){
			var stringData = JSON.stringify(storiesRead);
			cb(stringData);});
		} else {
                    this.findAll({attributes:['bbcpublished']}).success(function(storiesRead){
                        var stringData = JSON.stringify(storiesRead);
                        cb(stringData);});
                };
            },

	    addToStoriesFavorited: function(userEmail, story_id, successcb, errcb) {
		/* Posted to from /api/addstoryread, as a persona user has viewed the story the request is redirected to 
		 here and the story id and user email will be added to the personahistories db*/
		
		var personaEmail = userEmail;
		var readStoryID = story_id;
		    var _StoryRead = this;
		    _StoryRead.find({where: {email: personaEmail, bbcpublished: story_id}}).success(function(story_instance) {
			if (story_instance) {
			    // story read already exists, do nothing
			    successcb();
			} else {
			    /*
			       Build instance and save.

			       Uses the _StoryRead from the enclosing scope,
			       as 'this' within the callback refers to the current
			       found instance.
			    */
			    var new_storyread_instance = _StoryRead.build({
				email: personaEmail,
				bbcpublished: readStoryID
			    });
			    new_storyread_instance.save().success(function() {
				successcb();
			    }).error(function(err) {
				errcb(err);
			    });
			}
		    });
		
	    },
	    allToJSON: function(successcb, errcb) {
		this.findAll()
		    .success(function(orders) {
			successcb(uu.invoke(orders, 'toJSON'));
		    })
		    .error(errcb);
	    },
	    addAllFromJSON: function(orders, errcb) {
		/*
		  This method is implemented naively and can be slow if
		  you have many orders.

		  The ideal solution would first determine in bulk which of the
		  potentially new orders in order_json is actually new (and not
		  stored in the database). One way to do this is via the NOT IN
		  operator, which calculates a set difference:
		  http://www.postgresql.org/docs/9.1/static/functions-comparisons.html
		  This should work for even a large set of orders in the NOT IN
		  clause (http://stackoverflow.com/a/3407914) but you may need
		  to profile the query further.

		  Once you have the list of new orders (i.e. orders which are
		  in Coinbase but not locally stored in the database), then
		  you'd want to launch several concurrent addFromJSON calls
		  using async.eachLimit
		  (https://github.com/caolan/async#eachLimit). The exact value
		  of the limit is how many concurrent reads and writes your
		  Postgres installation can handle. This is outside the scope
		  of the class and depends on your Postgres database settings,
		  the tuning of your EC2 instance, and other parameters. For a
		  t1.micro, we just set this to 1 to prevent the system from
		  hanging.
		*/
		var MAX_CONCURRENT_POSTGRES_QUERIES = 1;
		async.eachLimit(orders,
				MAX_CONCURRENT_POSTGRES_QUERIES,
				this.addFromJSON.bind(this), errcb);
	    },
	    addFromJSON: function(order_obj, cb) {
		/*
		  Add from JSON only if order has not already been added to
		  our database.

		  Note the tricky use of var _Order. We use this to pass in
		  the Order class to the success callback, as 'this' within
		  the scope of the callback is redefined to not be the Order
		  class but rather an individual Order instance.

		  Put another way: within this classmethod, 'this' is
		  'Order'. But within the callback of Order.find, 'this'
		  corresponds to the individual instance. We could also
		  do something where we accessed the class to which an instance
		  belongs, but this method is a bit more clear.
		*/
		var order = order_obj.order; // order json from coinbase
		if (order.status != "completed") {
		    cb();
		} else {
		    var _Order = this;
		    _Order.find({where: {coinbase_id: order.id}}).success(function(order_instance) {
			if (order_instance) {
			    // order already exists, do nothing
			    cb();
			} else {
			    /*
			       Build instance and save.

			       Uses the _Order from the enclosing scope,
			       as 'this' within the callback refers to the current
			       found instance.

			       Note also that for the amount, we convert
			       satoshis (the smallest Bitcoin denomination,
			       corresponding to 1e-8 BTC, aka 'Bitcents') to
			       BTC.
			    */
			    var new_order_instance = _Order.build({
				coinbase_id: order.id,
				amount: order.total_btc.cents / 100000000,
				time: order.created_at
			    });
			    new_order_instance.save().success(function() {
				cb();
			    }).error(function(err) {
				cb(err);
			    });
			}
		    });
		}
	    },
	    addStoryFavoritedElseContinue: function(personaEmail, bbcPublishedID, cb) {
		/*

		  Attempt to add the story id (bbcPublished) into the database alongside the user id (personaEmail) as a record that they have viewed the story.

		  NOTE ON CALLBACKS:
		  http://tobyho.com/2011/11/02/callbacks-in-loops/
		  Note that when using a for loop we need to provide a variable in the scope of the loop that does not alter as the loop continues we do this by passing the value of i to an inner function as ii.
		*/
		var userEmail  = personaEmail;
		var storyID = bbcPublishedID;
		var _User = this;
		_User.find({where: {email: userEmail, bbcpublished: storyID}}).success(function(dbUserEmail) {
			if (dbUserEmail) {
			    // Story already exists as read, do nothing
			    console.log("%s has already read story: %s", userEmail, storyID);
			    cb();
			} else {
			    console.log("New story %s read by %s - Woop! adding..");
				     if(userEmail.length > 74){
					 console.log("Oops crazy long email addresses not welcome here!");
					 cb();
				     }
			             var new_readstory_instance = _User.build({
					 email: userEmail,
					 bbcpublished: storyID
				     });
				     new_readstory_instance.save().success(function() {
					 cb();
				     }).error(function(err) {
					 cb(err);
				     });
				 };
				 });						      
			    /*
			       Above Build instance and save.

			       xc		       Uses the _User from the enclosing scope,
			       as 'this' within the callback refers to the current
			       found instance.

			       Note also that for the amount, we convert
			       satoshis (the smallest Bitcoin denomination,
			       corresponding to 1e-8 BTC, aka 'Bitcents') to
			       BTC.
			    */ 
		
	    },
	    refreshFromCoinbase: function(cb) {
		/*
		  This function hits Coinbase to download the latest list of
		  orders and then mirrors them to the local database. The
		  callback passed in expects a single error argument,
		  cb(err). Note that one can add much more error handling
		  here; we've removed that for the sake of clarity.
		*/
		var _Story = this;
		cb();
		
		/* Deleted below shortly?
		   coinbase.get_bbc_world_news_json(function(err, bbc_world_stories){
		    if(err){
			console.log("refresh not possible at this time from BBC World stories api");
			cb();
		    } else {
			    console.log("refresh should be successful from BBC World stories api");
			    _Story.addBBCNewsfromJSON(bbc_world_stories, cb);
			    };
		});*/ 
/* now redundant -- prepare for deletion
		coinbase.get_coinbase_json(1, function(err, orders) {
		    _Order.addAllFromJSON(orders, cb);
		});
*/
	    }
	},
	instanceMethods: {
	    repr: function() {
		return util.format(
		    "Order <ID: %s Coinbase_ID:%s Amount:%s Time:%s " +
			"Created: %s Updated:%s", this.id, this.coinbase_id,
		    this.amount, this.time, this.createdAt, this.updatedAt);
	    },
	    amountInUSD: function() {
		/*
		  Illustrative only.

		  For a real app we'd want to periodically pull down and cache
		  the value from http://blockchain.info/ticker.
		*/
		var BTC2USD = 118.86;
		return this.amount * BTC2USD;
	    }
	}
    });
};
