exports.handshake = function(infoHash, clientID){
  var result = new Buffer(68);
  result.writeUInt8(19, 0);
  result.write('BitTorrent protocol', 1, 19);
  //need to fix this.
  for (var i = 20; i <= 28; i++){
    result.write('', i, 1);
  }
  result.write(infoHash, 29, 20, 'binary');
  result.write(clientID, 49, 20);
  debugger;
  return result;
};