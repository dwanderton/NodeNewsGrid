/*

  This is the NewsGrid Central Function Repository

*/
var NewsGridFunction = {

    get_popular_list: function(date_since, num_return_values, cb){
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
            popular.forEach(function(element, index, array){
		if(index < num_return_values){
                    jsonReturnSorted[element.value] = element.count;
		};
            });
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


    }


/* examples of how to puoulate:  
   TWITTER_TWEET: "This student crowdfunder looks interesting.",
  days_left: function() {
      return Math.max(Math.ceil((this.FUNDING_END_DATE - new Date()) / (1000*60*60*24)), 0);
  }
*/
};

module.exports = NewsGridFunction;
