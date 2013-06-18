var storage = [];
var maxPeerID = 0;
module.exports = function(){
};

module.exports.prototype.add = function(peer){
  storage[peer.id] = peer;
  maxPeerID = peer.id > maxPeerID ? peer.id : maxPeerID;
};

module.exports.prototype.get = function(id){
  return storage[peer.id];
};

module.exports.prototype.length = function(){
  return storage.length;
};

module.exports.prototype.maxPeer = function(){
  return storage[maxPeerID];
};