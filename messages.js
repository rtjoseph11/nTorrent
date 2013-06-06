exports.generateHandshake = function(self){
  var result = new Buffer(68);
  result.writeUInt8(19, 0);
  result.write('BitTorrent protocol', 1, 19);
  //need to fix this.
  result.fill(null, 20);
  result.write(self.infoHash, 28, 20, 'binary');
  result.write(self.clientID, 48, 20);
  return result;
};

exports.consumeHandshake = function(buffer, peer){
  //figure out if the handshake message is valid;
};