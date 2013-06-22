var storage = {};
var inStorage = {};
var storageLength = 0;
var numConnected = 0;
module.exports = function(){
};

module.exports.prototype.add = function(peer, buffer){
  inStorage[buffer.toString('hex')] = true;
  storage[peer.id] = peer;
  storageLength += 1;
  if (!peer.isConnected){
    peer.connect();
  } else {
    numConnected++;
  }
};

module.exports.prototype.decrementConnected = function(){
  numConnected--;
};

module.exports.prototype.incrementConnected = function(){
  numConnected++;
};

module.exports.prototype.numConnected = function(){
  return numConnected;
};

module.exports.prototype.length = function(){
  return storageLength;
};

module.exports.prototype.connect = function(){
  for (var key in storage){
    if(!storage[key].isConnected && ! storage[key].connectionError){
      storage[key].connect();
    }
  }
};

module.exports.prototype.cancelBlock = function(block){
  for (var key in storage){
    if(storage[key].assignedBlock && storage[key].assignedBlock.index === block.index && storage[key].assignedBlock.begin === block.begin && storage[key].pendingRequest){
      storage[key].sendCancelRequest(block);
    }
  }
};

module.exports.prototype.hasPeer = function(buffer){
  return !! inStorage[buffer.toString('hex')];
};

module.exports.prototype.broadcastPiece = function(index){
  for (var key in storage){
    if(storage[key].isConnected && storage[key].hasHandshake() && !storage[key].hasPiece(index)){
      storage[key].sendHasPiece(index);
    }
  }
};

module.exports.prototype.disconnect = function(){
  for (var key in storage){
    if (storage[key].isConnected){
      storage[key].disconnect();
    }
  }
};