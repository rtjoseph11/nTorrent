var storage = [];
var inStorage = {};

module.exports = function(){
};

module.exports.prototype.add = function(peer, buffer){
  inStorage[buffer.toString('hex')] = true;
  storage[peer.id] = peer;
  peer.connect();
};

module.exports.prototype.get = function(id){
  return storage[peer.id];
};

module.exports.prototype.length = function(){
  return storage.length;
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
  for (var i = 0; i < storage.length; i++){
    if(storage[i]){
      if (storage[i].isConnected){
        storage[i].disconnect();
      }
    }
  }
};