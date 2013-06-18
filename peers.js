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

module.exports.prototype.connect = function(){
  for (var i = 0; i < storage.length; i++){
    if(storage[i]){
      storage[i].connect();
    }
  }
};

module.exports.prototype.disconnect = function(){
  for (var i = 0; i < storage.length; i++){
    if(storage[i]){
      storage[i].disconnect();
    }
  }
};