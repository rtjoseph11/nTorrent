exports.handshake = function(infoHash, clientID){
  var result = new Buffer(68);
  result.writeUInt8(19, 0);
  result.write('BitTorrent protocol', 1, 19);
  //need to fix this.
  result.fill(null, 20);
  result.write(infoHash, 28, 20, 'binary');
  result.write(clientID, 48, 20);
  return result;
};