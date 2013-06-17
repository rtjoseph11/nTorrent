module.exports = function(sha, position, length){
  this.sha = sha;
  this.position = position;
  this.data = new Buffer(length);
  this.currentLength = 0;
};