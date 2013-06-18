var crypto = require('crypto');
module.exports = function(sha, length, index, files){
  this.sha = sha;
  this.data = new Buffer(length);
  this.currentLength = 0;
  this.assignedPeer = null;
  this.index = index;
  this.files = files;
};

//consider doing the piece writing at the pieceField level since I have the index
module.exports.prototype.writeChunk = function(buffer){
  var index = buffer.readUInt32BE(0);
  var begin = buffer.readUInt32BE(4);
  if (begin !== this.currentLength || index !== this.index){
    throw new Error ('begin or index did not match up indices: ' + this.index + ", " + index + "begins: " + begin + ", " + this.currentLength);
  } else {
    buffer.copy(this.data, this.currentLength, 8);
    this.currentLength += buffer.length - 8;
    if (this.currentLength === this.data.length){
      this.validate();
    } else {
      this.assignedPeer.getPiece();
    }
  }
};

module.exports.prototype.validate = function(){
  console.log('validating piece ', this.index);
  if (crypto.createHash('sha1').update(this.data).digest().toString('binary') === this.sha.toString('binary')){
    console.log('succesfully received pice ', this.index);
    for (var i = 0; i < this.files.length; i++){
      var pieceWriter = fs.createWriteStream(files[i].path, {start: files[i].start});
      pieceWriter.end(this.data.slice(files[i].start - this.index * this.data.length, files[i].writeLength));
    }
    this.assignedPeer.assignedPiece = null;
    this.assignedPeer.emit('pieceFinished');
  } else {
    this.currentLength = 0;
    console.log('peer ', this.assignedPeer.id, ' failed to download piece ', this.index);
    var peer = this.assignedPeer;
    this.assignedPeer = null;
    peer.emit('pieceFailed', this.assignedPeer);
  }
};