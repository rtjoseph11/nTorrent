var crypto = require('crypto');
var events = require('events');
var util = require('util');
var fs = require('fs');
module.exports = function(sha, length, index, files, standardLength){
  events.EventEmitter.call(this);
  this.sha = sha;
  this.data = new Buffer(length);
  this.currentLength = 0;
  this.assignedPeer = null;
  this.index = index;
  this.files = files;
  this.standardLength = standardLength;
};

util.inherits(module.exports, events.EventEmitter);

//consider doing the piece writing at the pieceField level since I have the index
module.exports.prototype.writeBlock = function(block){
  if (block.begin !== this.currentLength || block.index !== this.index){
    console.log('begin or index did not match up indices: ' + this.index + ", " + block.index + " begins: " + block.begin + ", " + this.currentLength);
    this.currentLength = 0;
    this.assignedPeer = null;
    this.emit('writeFailed');
  } else {
    block.data.copy(this.data, this.currentLength);
    this.currentLength += block.data.length;
    if (this.currentLength === this.data.length){
      this.validate();
    } else {
      this.assignedPeer && this.assignedPeer.getPiece();
    }
  }
};

module.exports.prototype.getBlock = function(begin, length){
  return {
    index: this.index,
    begin: begin,
    data: this.data.slice(begin, begin + length)
  };
};

module.exports.prototype.validate = function(){
  if (crypto.createHash('sha1').update(this.data).digest().toString('hex') === this.sha.toString('hex')){
    console.log('succesfully received piece ', this.index);
    this.writeToDisk();
    this.assignedPeer.assignedPiece = null;
    this.emit('pieceFinished', this);
    this.assignedPeer.emit('pieceFinished');
  } else {
    this.currentLength = 0;
    console.log('peer ', this.assignedPeer.id, ' failed to download piece ', this.index);
    var peer = this.assignedPeer;
    this.assignedPeer = null;
    peer.emit('pieceFailed', this.assignedPeer);
  }
};

module.exports.prototype.writeToDisk = function(){
  var used = 0;
    for (var i = 0; i < this.files.length; i++){
      console.log('peer ', this.assignedPeer.id, ' writing ', this.data.slice(used, used + this.files[i].writeLength).length, ' bytes at position ', this.files[i].start, ' in file ', i);
      var pieceWriter = fs.createWriteStream(this.files[i].path, {start: this.files[i].start, flags: 'r+'});
      pieceWriter.end(this.data.slice(used, used + this.files[i].writeLength));
      used += this.files[i].writeLength;
    }
};

module.exports.prototype.readFromDisk = function(){
  for(var i = 0; i < this.files.length; i++){
    if (fs.existsSync(this.files[i].path)){
      var fd = fs.openSync(this.files[i].path, 'r');
      fs.readSync(fd, this.data, this.currentLength, this.files[i].writeLength, this.files[i].start);
      this.currentLength += this.files[i].writeLength;
      fs.closeSync(fd);
    }
  }
  if(crypto.createHash('sha1').update(this.data).digest().toString('hex') === this.sha.toString('hex')){
    // console.log('have piece ', this.index);
    this.emit('pieceExists', this);
  } else {
    this.currentLength = 0;
    // console.log('missing piece ', this.index);
  }
};