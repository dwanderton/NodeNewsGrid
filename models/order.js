/*
   Object/Relational mapping for instances of the Order class.

    - classes correspond to tables
    - instances correspond to rows
    - fields correspond to columns

   In other words, this code defines how a row in the PostgreSQL "Order"
   table maps to the JS Order object. Note that we've omitted a fair bit of
   error handling from the classMethods and instanceMethods for simplicity.
*/
var async = require('async');
var util = require('util');
var uu = require('underscore');
var coinbase = require('./coinbase');

module.exports = function(sequelize, DataTypes) {
    return sequelize.define("bbcstory", {
	title: {type: DataTypes.STRING},
	thumbnail: {type: DataTypes.STRING(150), allowNull: false},
	link: {type: DataTypes.STRING(150), allowNull: false},
	published: {type: DataTypes.BIGINT, allowNull: false},
	description: {type: DataTypes.STRING(600), allowNull: false}
    }, {
	classMethods: {
	    findFromPublished: function(publishedID, cb){
		this.find({where: {published: publishedID}}).success(function(storyFound) {
                    cb(storyFound); 
		});
	    },
	    numOrders: function() {
		this.count().success(function(c) {
		    console.log("There are %s Orders", c);});
	    },
	    allToJSON: function(successcb, errcb) {
		this.findAll({order: 'updatedAt DESC',limit: '60'})
		    .success(function(orders) {
			successcb(uu.invoke(orders, 'toJSON'));
		    })
		    .error(errcb);
	    },
	    totals: function(successcb, errcb) {
		this.findAll().success(function(orders) {
		    var total_funded = 0.0;
		    orders.forEach(function(order) {
			total_funded += parseFloat(order.amount);
		    });
		    var totals = {total_funded: total_funded,
				  num_orders: orders.length};
		    successcb(totals);
		}).error(errcb);
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
	    addBBCNewsfromJSON: function(bbc_story_obj, cb) {
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

		  NOTE ON CALLBACKS:
		  http://tobyho.com/2011/11/02/callbacks-in-loops/
		  Note that when using a for loop we need to provide a variable in the scope of the loop that does not alter as the loop continues we do this by passing the value of i to an inner function as ii.
		*/
		var stories = bbc_story_obj; // story json from bbc api
		var _Stories = this;
		for (var i = 0, len = stories.length; i < len; i++){
		    !function outer(ii){
		    _Stories.find({where: {title: stories[ii].title}}).success(function(story_instance) {
			if (story_instance) {
			    // story already exists, do nothing
			    console.log("story exists - updating current story!");
			    story_instance.updateAttributes({
				published: stories[ii].published,
				thumbnail: stories[ii].thumbnail,
				link: stories[ii].link,
				description: stories[ii].description
			    }).success(function() {
				cb();
			    }).error(function(err) {
				cb(err);
			    });
			} else {
			    /* check if the image url is already referenced in the database - may overwrite story details */
			     _Stories.find({where: {thumbnail: stories[ii].thumbnail}}).success(function(story_instance2) {
				 if (story_instance) {
				     console.log("thumbnail exists - updating current story!");
				     story_instance2.updateAttributes({
					 published: stories[ii].published,
					 title: stories[ii].title,
					 link: stories[ii].link,
					 description: stories[ii].description
				     }).success(function() {
					 cb();
				     }).error(function(err) {
					 cb(err);
				     });
				 } else {
				     if (stories[ii].link.match(/^.*sport.*$/)){
					 console.log("sport - no thanks");
					 } else {
				     console.log("story doesn't exist - creating...");
				     var new_story_instance = _Stories.build({
					 title: stories[ii].title,
					 published: stories[ii].published,
					 thumbnail: stories[ii].thumbnail,
					 link: stories[ii].link,
					 description: stories[ii].description
				     });
				     new_story_instance.save().success(function() {
					 cb();
				     }).error(function(err) {
					 cb(err);
				     });
				 };
				 };
				 });
			}
			});
			}(i)
			}
										      
			    /*
			       Above Build instance and save.

			       Uses the _Order from the enclosing scope,
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
		coinbase.get_bbc_world_news_json(function(err, bbc_world_stories){
		    if(err){
			console.log("refresh not possible at this time from BBC World stories api");
			cb();
		    } else {
			    console.log("refresh should be successful from BBC World stories api");
			    _Story.addBBCNewsfromJSON(bbc_world_stories, cb);
			    };
		});
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
