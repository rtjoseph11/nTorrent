var events = require('events');
var util = require('util');
var fs = require('fs');
var pieceLength;
var Piece = require('./piece');
var storage = [];
var peerMap = [];
var bitMap = [];
var files = [];
var totalLength = 0;
module.exports = function(torrentInfo){
  events.EventEmitter.call(this);
  //piece length is the number of bytes
  pieceLength = torrentInfo['piece length'];
  var downloadpath = __dirname + '/downloads/' + torrentInfo.name.toString();
  fs.mkdirSync(downloadpath);
  for (var j = 0; j < torrentInfo.files.length; j++){
    fs.writeFileSynce(downloadpath + '/' + torrentInfo.files[i].path[0].toString(), new Buffer(torrentInfo.files[i].length));
    files.push({
      path: downloadpath + '/' + torrentInfo.files[i].path[0].toString(),
      length: torrentInfo.files[i].length,
      startPosition: totalLength
    });
    totalLength += torrentInfo.files[i].length;
  }
  for (var i = 0; i < torrentInfo.pieces.length; i += 20){
    var pieceFiles = [];
    var startIndex = (i / 20) * pieceLength;
    var endIndex = (((i / 20) + 1) * pieceLength);
    for (var k = 0; k < files.length; k++){
      if (endIndex >= files[j].startPosition && startIndex < files[j].startPosition + files[j].length){
        pieceFiles.push({
          path: files[j].path,
          start: max(files[j].startPosition, startIndex),
          writeLength: min(files[j].length, pieceLength)
        });
      }
    }
    storage.push(new Piece(torrentInfo.pieces.slice(i, i + 20), pieceLength, i / 20, pieceFiles));
    bitMap.push(0);
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
};

module.exports.prototype.checkForPiece = function(){
  for (var i = 0; i < storage.length; i++){
    if (! storage[i].assignedPeer && peerMap[i].length > 0){
      for (var j = 0; j < peerMap[i].length; j++){
        if (! peerMap[i][j].assignedPiece && peerMap[i][j].isConnected && peerMap[i][j].hasHandshake && ! peerMap[i][j].choking){
          peerMap[i][j].assignedPiece = storage[i];
          storage[i].assignedPeer = peerMap[i][j];
          peerMap[i][j].emit('assignedPiece');
          break;
        }
      }
    }
  }
};