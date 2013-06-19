var storage = [];
var inStorage = {};
//maxPeerID is for testing
var maxPeerID = 0;
module.exports = function(){
};

module.exports.prototype.add = function(peer, buffer){
  inStorage[buffer.toString('hex')] = true;
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
    if(storage[i] && !storage[i].isConnected && ! storage[i].connectionError){
      storage[i].connect();
    }
  }
};

module.exports.prototype.hasPeer = function(buffer){
  return !! inStorage[buffer.toString('hex')];
};

module.exports.prototype.disconnect = function(){
  console.log('disconnecting all peers');
  for (var i = 0; i < storage.length; i++){
    if(storage[i]){
      if (storage[i].isConnected){
        storage[i].disconnect();
      }
    }
  }
};