var events = require('events');
var util = require('util');
var fs = require('fs');
var pieceLength;
var Piece = require('./piece');
var storage = [];
var peerMap = [];
var banMap = {};
var bitMap = [];
var files = [];
var totalLength = 0;

module.exports = function(torrentInfo){
  var self = this;
  events.EventEmitter.call(self);
  //piece length is the number of bytes
  pieceLength = torrentInfo['piece length'];
  var downloadpath = __dirname + '/downloads/' + torrentInfo.name.toString();
  if (! fs.existsSync(downloadpath)){
    fs.mkdirSync(downloadpath);
  }
  if (torrentInfo.files){
    for (var j = 0; j < torrentInfo.files.length; j++){
      if (! fs.existsSync(downloadpath + '/' + torrentInfo.files[j].path[0].toString())){
        fs.writeFileSync(downloadpath + '/' + torrentInfo.files[j].path[0].toString(), new Buffer(0));
      }
      files.push({
        path: downloadpath + '/' + torrentInfo.files[j].path[0].toString(),
        length: torrentInfo.files[j].length,
        startPosition: totalLength,
        used: 0
      });
      totalLength += torrentInfo.files[j].length;
    }
  } else {
    if (! fs.existsSync(downloadpath + '/' + torrentInfo.name.toString())){
      fs.writeFileSync(downloadpath + '/' + torrentInfo.name.toString(), new Buffer(0));
    }
    files.push({
      path: downloadpath + '/' + torrentInfo.name.toString(),
      length: torrentInfo.length,
      startPosition: totalLength,
      used: 0
    });
    totalLength += torrentInfo.length;
  }
  for (var i = 0; i < torrentInfo.pieces.length; i += 20){
    //ternary is for the last piece which will probably be shorter than the rest of the pieces
    var curPieceLength = i + 20 < torrentInfo.pieces.length ? pieceLength : totalLength % pieceLength === 0 ? pieceLength : totalLength % pieceLength;
    var pieceFiles = [];
    var startIndex = (i / 20) * pieceLength;
    var endIndex = (((i / 20) * pieceLength) + curPieceLength);
    var pieceUsed = 0;
    for (var k = 0; k < files.length; k++){
      if (endIndex > files[k].startPosition && startIndex < files[k].startPosition + files[k].length){
        pieceFiles.push({
          path: files[k].path,
          start: Math.max(files[k].used),
          writeLength: Math.min(files[k].length + files[k].startPosition - startIndex - pieceUsed, curPieceLength - pieceUsed)
        });
        pieceUsed += Math.min(files[k].length + files[k].startPosition - startIndex - pieceUsed, curPieceLength - pieceUsed);
        files[k].used += pieceFiles[pieceFiles.length - 1].writeLength;
      }
    }
    var piece = new Piece(torrentInfo.pieces.slice(i, i + 20),  curPieceLength, i / 20, pieceFiles, pieceLength);

    piece.on('pieceExists', function(piece){
      bitMap[piece.index] = 1;
    });

    piece.on('pieceFinished', function(piece){
      bitMap[piece.index] = 1;
      if (bitMap.reduce(function(memo, item){
        return memo += item;
      }, 0) === bitMap.length){
        console.log('torrent finished!!!');
        self.emit('torrentFinished');
      } else {
        self.emit('pieceFinished', piece.index);
      }
    });

    piece.on('blockWritten', function(p, peer, block){
      if (self.isEndGame()){
        self.emit('cancelBlock', block);
      }
      if (!p.completed && !peer.assignedBlock && p.data){
        p.assignBlock(peer, self.isEndGame());
      }
    });

    piece.on('writeFailed', function(){
      self.checkForPiece();
    });

    storage[i / 20] = piece;
    bitMap[i / 20] = 0;
    peerMap[ i / 20] = {};
    //use a file to indicate what pieces are already downloaded rather than reading from disk
    piece.readFromDisk();
  }
  console.log('bitfield created, storage has length', storage.length);
};

util.inherits(module.exports, events.EventEmitter);

module.exports.prototype.length = function(){
  return storage.length;
};

module.exports.prototype.left = function(){
  //hardcoding to the total length of the torrent
  return totalLength;
};

module.exports.prototype.downloaded = function(){
  //hardocded to 0
  return 0;
};

module.exports.prototype.uploaded = function(){
  //hardocded to 0
  return 0;
};

module.exports.prototype.bitField = function(){
  return bitMap;
};

module.exports.prototype.isEndGame = function(){
  return (storage.length - bitMap.reduce(function(memo, item){return memo += item;}, 0)) / storage.length < 0.01 ? true : false;
};

module.exports.prototype.registerPeer = function(peer){
  for (var i = 0; i < peer.bitField.length; i++){
    if (peer.bitField[i]){
      peerMap[i][peer.id] = peer;
      if (!bitMap[i] && !peer.amInterested){
        peer.sendInterested();
      }
    }
  }
};

module.exports.prototype.unregisterPeer = function(peer){
  for (var i = 0; i < peer.bitField.length; i++){
    if (peer.bitField[i] && peerMap[i]){
      delete peerMap[i][peer.id];
    }
  }
};

module.exports.prototype.registerPeerPiece = function(peer, index){
  peerMap[index][peer.id] = peer;
  if (!bitMap[index] && !peer.amInterested){
    peer.sendInterested();
  }
};

module.exports.prototype.isFinished = function(){
  if (bitMap.reduce(function(memo, item){
        return memo += item;
      }, 0) === bitMap.length){
        console.log('torrent finished!!!');
        return true;
  } else {
    return false;
  }
};

module.exports.prototype.releaseBlock = function(block){
  delete storage[block.index].blockPeers[block.begin];
};

module.exports.prototype.sendBlock = function(request, peer){
  peer.sendBlock(storage[request.index].getBlock(request.begin, request.length));
};

module.exports.prototype.writeBlock = function(block, peer){
  storage[block.index].writeBlock(block, peer);
};

module.exports.prototype.checkForPiece = function(){
  for (var i = 0; i < storage.length; i++){
    if (! bitMap[i]){
      for (var key in peerMap[i]){
        if (!peerMap[i][key].assignedBlock && peerMap[i][key].isConnected && peerMap[i][key].hasHandshake() && !peerMap[i][key].choking){
          storage[i].assignBlock(peerMap[i][key], this.isEndGame());
          break;
        }
      }
    }
  }
};