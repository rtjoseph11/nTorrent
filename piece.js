var crypto = require('crypto');
var events = require('events');
var util = require('util');
var fs = require('fs');
module.exports = function(sha, length, index, files, standardLength){
  events.EventEmitter.call(this);
  this.sha = sha;
  this.data = new Buffer(length);
  this.index = index;
  this.files = files;
  this.standardLength = standardLength;
  this.completed = false;
  this.blockMap = {};
  this.blockPeers = {};
  for (var i = 0; i < length; i+= 16384){
    this.blockMap[i] = 0;
  }
};

util.inherits(module.exports, events.EventEmitter);

module.exports.prototype.writeBlock = function(block, peer){
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

module.exports.prototype.assignBlock = function(peer, isEndGame){
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
};

module.exports.prototype.getBlock = function(begin, length){
  var filepath = "";
  for (var i = 0; i < this.files.length; i++){
    if (this.index * this.standardLength + begin >= this.files[i].start && this.index * this.standardLength + begin < this.files[i].start + this.files[i].writeLength){
      filepath = this.files[i].path;
      break;
    }
  }
  var fd = fs.openSync(filepath, 'r');
  var data = new Buffer(length);
  fs.readSync(fd, data, 0, length, this.index * this.standardLength + begin);
  fs.closeSync(fd);
  return {
    index: this.index,
    begin: begin,
    data: data
  };
};

module.exports.prototype.validate = function(){
  if (crypto.createHash('sha1').update(this.data).digest().toString('hex') === this.sha.toString('hex')){
    console.log('succesfully received piece ', this.index);
    this.writeToDisk();
    this.completed = true;
    delete this.data;
    this.emit('pieceFinished', this);
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

module.exports.prototype.writeToDisk = function(){
  var used = 0;
    for (var i = 0; i < this.files.length; i++){
      var pieceWriter = fs.createWriteStream(this.files[i].path, {start: this.files[i].start, flags: 'r+'});
      pieceWriter.end(this.data.slice(used, used + this.files[i].writeLength));
      used += this.files[i].writeLength;
    }
  delete this.data;
};

module.exports.prototype.readFromDisk = function(){
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