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
  if (! fs.existsSync(downloadpath)){
    fs.mkdirSync(downloadpath);
  }
  for (var j = 0; j < torrentInfo.files.length; j++){
    fs.writeFileSync(downloadpath + '/' + torrentInfo.files[j].path[0].toString(), new Buffer(torrentInfo.files[j].length));
    files.push({
      path: downloadpath + '/' + torrentInfo.files[j].path[0].toString(),
      length: torrentInfo.files[j].length,
      startPosition: totalLength
    });
    totalLength += torrentInfo.files[j].length;
  }
  for (var i = 0; i < torrentInfo.pieces.length; i += 20){
    var pieceFiles = [];
    var startIndex = (i / 20) * pieceLength;
    var endIndex = (((i / 20) + 1) * pieceLength);
    for (var k = 0; k < files.length; k++){
      if (endIndex >= files[k].startPosition && startIndex < files[k].startPosition + files[k].length){
        pieceFiles.push({
          path: files[k].path,
          start: Math.max(files[k].startPosition, startIndex),
          writeLength: Math.min(files[k].length, pieceLength)
        });
      }
    }
    var piece = new Piece(torrentInfo.pieces.slice(i, i + 20), pieceLength, i / 20, pieceFiles);
    piece.on('pieceFinished', function(piece){
      bitMap[piece.index] = 1;
      if (bitMap.reduce(function(memo, item){
        return memo += item;
      }, 0) === bitMap.length){
        console.log('torrent finished!!!');
        this.emit('torrentFinished');
      }
    });
    storage.push(piece);
    bitMap.push(0);
  }
  console.log('bitfield created, storage has length', storage.length);
};

util.inherits(module.exports, events.EventEmitter);

module.exports.prototype.get = function(index){
  return storage[index];
};

module.exports.prototype.left = function(){
  //hardocded to 0
  return '48';
};

module.exports.prototype.downloaded = function(){
  //hardocded to 0
  return '48';
};

module.exports.prototype.uploaded = function(){
  //hardocded to 0
  return '48';
};

module.exports.prototype.registerPeer = function(peer){
  for (var i = 0; i < peer.bitField.length; i++){
    if (peer.bitField[i]){
      peerMap[i] = peerMap[i] || [];
      peerMap[i].push(peer);
    }
  }
};

module.exports.prototype.registerPeerPiece = function(peer, indexBuffer){
  var index = indexBuffer.readUInt32BE(0);
  peer.bitField[index] = true;
  peerMap[index] = peerMap[index] || [];
  peerMap[index].push(peer);
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