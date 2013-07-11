var crypto = require('crypto');
var events = require('events');
var util = require('util');
var fs = require('fs');
var bitMap;
var pieceExists = function(piece){
  bitMap[piece.index] = 1;
};
var pieceFinished = function(piece){
  bitMap[piece.index] = 1;
  if (bitMap.reduce(function(memo, item){
    return memo += item;
  }, 0) === bitMap.length){
    console.log('torrent finished!!!');
    this.emit('torrentFinished');
  } else {
    this.emit('pieceFinished', piece.index);
  }
};
var blockWritten = function(piece, peer, block){
  if (this.isEndGame()){
    this.emit('cancelBlock', block);
  }
  if (!piece.completed && !peer.assignedBlock && piece.data){
    piece.assignBlock(peer, this.isEndGame());
  }
};

Piece = function(sha, length, index, files, standardLength, pieceField){
  events.EventEmitter.call(this);
  this.sha = sha;
  this.data = new Buffer(length);
  this.index = index;
  this.files = files;
  this.length = length;
  this.standardLength = standardLength;
  this.completed = false;
  this.blockMap = {};
  this.blockPeers = {};
  for (var i = 0; i < length; i+= 16384){
    this.blockMap[i] = 0;
  }
  this.on('pieceExists', pieceExists);
  this.on('pieceFinished',pieceFinished.bind(pieceField));
  this.on('blockWritten', blockWritten.bind(pieceField));
  this.on('writeFailed', pieceField.checkForPiece.bind(pieceField));
};

util.inherits(Piece, events.EventEmitter);

Piece.prototype.writeBlock = function(block, peer){
  if (block.index !== this.index){
    throw new Error('indices did not match up: ' + this.index + ", " + block.index);
  } else if (!this.completed){
    if (!this.blockMap[block.begin]){
      block.data.copy(this.data, block.begin);
      delete this.blockMap[block.begin];
      delete this.blockPeers[block.begin];
    }
    var remBlocks = 0;
    for (var begin in this.blockMap){
      remBlocks += 1;
    }
    if (remBlocks === 0){
        this.validate();
    } else if (!peer.assignedBlock) {
      this.emit('blockWritten', this, peer, {
        index: block.index,
        begin: block.begin,
        length: block.data.length
      });
    }
  }
};

Piece.prototype.assignBlock = function(peer, isEndGame){
  if (!peer.assignedBlock && !this.completed && this.data){
    for (var begin in this.blockMap){
      if (!this.blockPeers[begin] || isEndGame){
        this.blockPeers[begin] = peer.id;
        peer.assignedBlock = {
          index: this.index,
          begin: Number(begin),
          length: Math.min(16384, this.data.length - Number(begin))
        };
        peer.getBlock({
          index: this.index,
          begin: Number(begin),
          length: Math.min(16384, this.data.length - Number(begin))
        });
        break;
      }
    }
  }
};

Piece.prototype.validate = function(){
  if (crypto.createHash('sha1').update(this.data).digest().toString('hex') === this.sha.toString('hex')){
    console.log('succesfully received piece ', this.index);
    this.completed = true;
    this.writeToDisk();
  } else {
    this.blockMap = {};
    this.blockPeers = {};
    for (var i = 0; i < this.data.length; i+= 16384){
      this.blockMap[i] = 0;
    }
    console.log('failed to download piece ', this.index);
    this.emit('writeFailed');
  }
};

Piece.prototype.writeToDisk = function(){
  var used = 0;
  var i;
  var writerSuccess = function(){
    if (i === this.files.length){
      this.emit('pieceFinished', this);
    }
  };
  for (i = 0; i < this.files.length; i++){
    var pieceWriter = fs.createWriteStream(this.files[i].path, {start: this.files[i].start, flags: 'r+'});
    pieceWriter.end(this.data.slice(used, used + this.files[i].writeLength), writerSuccess.bind(this));
    used += this.files[i].writeLength;
  }
  delete this.data;
};

Piece.prototype.readFromDisk = function(){
  var used = 0;
  for(var i = 0; i < this.files.length; i++){
    if (fs.existsSync(this.files[i].path)){
      var fd = fs.openSync(this.files[i].path, 'r');
      fs.readSync(fd, this.data, used, this.files[i].writeLength, this.files[i].start);
      used += this.files[i].writeLength;
      fs.closeSync(fd);
    }
  }
  if(crypto.createHash('sha1').update(this.data).digest().toString('hex') === this.sha.toString('hex')){
    this.completed = true;
    delete this.data;
    this.emit('pieceExists', this);
  } else {
    this.blockMap = {};
    this.blockPeers = {};
    for (var j = 0; j < this.data.length; j+= 16384){
      this.blockMap[j] = 0;
    }
  }
};

Piece.prototype.getBlock = function(begin, length){
  var data = new Buffer(length);
  var used = 0;
  var fd;
  var pieceStart = this.index * this.standardLength;
  for (var i = 0; i < this.files.length; i++){
    if (i === 0 && pieceStart + begin < this.files[i].start + this.files[i].writeLength && pieceStart + begin + length > this.files[i].start){
      fd = fs.openSync(this.files[i].path, 'r');
      fs.readSync(fd, data, 0, Math.min(this.files[i].writeLength - begin, length), this.files[i].start + begin);
      used += Math.min(this.files[i].writeLength - begin, length);
      fs.closeSync(fd);
    } else if (length - used > 0){
      fd = fs.openSync(this.files[i].path, 'r');
      fs.readSync(fd, data, used, Math.min(this.files[i].writeLength, length - used), 0);
      used += Math.min(this.files[i].writeLength, length - used);
      fs.closeSync(fd);
    }
  }
  return {
    index: this.index,
    begin: begin,
    data: data
  };
};

module.exports = function(_bitMap){
  bitMap = _bitMap;
  return Piece;
};
