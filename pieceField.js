var events = require('events');
var util = require('util');
var pieceLength;
var Piece = require('./piece');
var storage = [];
var peerMap = [];
module.exports = function(torrentInfo){
  events.EventEmitter.call(this);
  //piece length is the number of bytes
  pieceLength = torrentInfo['piece length'];
  var index = 0;
  while (index < torrentInfo.pieces.length){
    storage.push(new Piece(torrentInfo.pieces.slice(index, index+20), pieceLength));
    index = index + 20;
  }
  console.log('bitfield created, storage has length', storage.length);
};

util.inherits(module.exports, events.EventEmitter);

module.exports.prototype.get = function(index){
  return storage[index];
};

module.exports.prototype.registerPeer = function(peer){
  for (var i = 0; i < peer.bitField.length; i++){
    if (peer.bitField[i]){
      peerMap[i] = peerMap[i] || [];
      peerMap[i].push(peer);
    }
  }
  this.emit('peerRegistered', this);
};

module.exports.prototype.checkForPiece = function(){
  for (var i = 0; i < storage.length; i++){
    if (! storage[i].assignedPeer && peerMap[i].length > 0){
      for (var j = 0; j < peerMap[i].length; j++){
        if (! peerMap[i][j].assignedPiece && peerMap[i][j].isConnected && peerMap[i][j].hasHandshake && ! peerMap[i][j].choking){
          peerMap[i][j].assignedPiece = storage[i];
          storage[i].assignedPeer = peerMap[i][j].id;
          peerMap[i][j].emit('assignedPiece');
          break;
        }
      }
    }
  }
};