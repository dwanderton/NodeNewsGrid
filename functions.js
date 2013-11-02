/*

  This is the NewsGrid Central Function Repository

*/

var BufferList = require('bufferlist').BufferList
  , request = require('request');

var NewsGridFunction = {

    base64_from_url:   function(url, cb){
	if(url) {
            var url = unescape(url);
            var bl = new BufferList();
            request({uri:url, responseBodyStream: bl, encoding:null}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
                    console.log("no issues with the request");
                    var resBody2imageBase64  = function(resBody, cb){
			var data_uri_prefix = "data:" + response.headers["content-type"] + ";base64,";
			var image = new Buffer(body).toString('base64');
			image = data_uri_prefix + image;
			cb(image);
                    };
                    resBody2imageBase64(body, function(data){cb(data);});

		}
		else { console.log("error obtaining image from url"); cb()};
	    });
	};
    },






    get_popular_list: function(date_since, num_return_values, cb){
	// returns json list of most popular entries from today to date_since, optional var num_return_values specifys the number of values to return - without num_return_values all will be returned.
	console.log("get pop list called");
	function async(arg, callback) {
            console.log('Retrieve histories from \''+arg+'\', to create most popular page');
            switch(arg){
            case 'fb':
                global.db.FacebookHistory.storiesReadSinceJSON(date_since, callback);
                break;
            case 'tw':
                global.db.TwitterHistory.storiesReadSinceJSON(date_since, callback);
                break;
            case 'ps':
                global.db.PersonaHistory.storiesReadSinceJSON(date_since, callback);
                break;
            }
	}
	function final() {
            // below sort inspired by  http://stackoverflow.com/questions/14299783/javascript-count-duplicate-json-values-and-sort-count-along-with-associative-\
	    
            var countedPopular = {};
            results.forEach(function(element, index, array){
		element.forEach(function(element,index,array){
                    var value = element['bbcpublished'];
                    var count = (countedPopular[value] || 0) + 1;
                    countedPopular[value] = count;
		});
            });
            var sortedPopular = [];

            //loop through all the keys in the sortedPopular object
            for(var key in countedPopular) {
		//here we check that the results object *actually* has
		//the key. because of prototypal inheritance in javascript there's
		//a chance that someone has modified the Object class prototype                                                                                  
		//with some extra properties. We don't want to include them in the                                                                               
		//ranking, so we check the object has it's *own* property.                                                                                       

		sortedPopular.push({value:key, count:countedPopular[key]});

            }
            var popular =   sortedPopular.sort(function(a, b) { return b.count - a.count; });
            var jsonReturnSorted = {};
            if(num_return_values != undefined){
		popular.forEach(function(element, index, array){
		    if(index < num_return_values){
			jsonReturnSorted[element.value] = element.count;
		    } else { return }
		});
	    } else { 
		popular.forEach(function(element, index, array){
                    jsonReturnSorted[element.value] = element.count;
		});
	    };
	    cb(jsonReturnSorted);

      }

	var services = ['fb', 'tw', 'ps'];
	var results = [];

	services.forEach(function(item) {
            async(item, function(result){
		results.push(JSON.parse(result));
		if(results.length == services.length) {
                    final();
		}
            })
	});


    },
    get_popular_list_full: function(dateSince, cb){ 
	// gets popular list with unlimited results
	NewsGridFunction.get_popular_list(dateSince,undefined,cb); 
    }

/* examples of how to puoulate:  
   TWITTER_TWEET: "This student crowdfunder looks interesting.",
  days_left: function() {
      return Math.max(Math.ceil((this.FUNDING_END_DATE - new Date()) / (1000*60*60*24)), 0);
  }
*/
};

module.exports = NewsGridFunction;
