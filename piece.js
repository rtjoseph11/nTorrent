module.exports = function(sha, length){
  this.sha = sha;
  this.data = new Buffer(length);
  this.currentLength = 0;
  this.assignedPeer = null;
};