module.exports = function(db){
var puser = db.import(__dirname+'/personauser.js');
var phistories = db.import(__dirname+'/personahistories.js');

puser.hasMany(phistories);
phistories.hasOne(puser);
return db;
}
