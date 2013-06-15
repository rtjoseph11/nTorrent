exports.generateHandshake = function(infoHash, clientID){
  var result = new Buffer(68);
  result.writeUInt8(19, 0);
  result.write('BitTorrent protocol', 1, 19);
  result.fill(null, 20);
  infoHash.copy(result, 28);
  result.write(clientID, 48, 20);
  return result;
};

exports.consumeHandshake = function(buffer, infoHash, peer){
  if( buffer.toString('utf8', 1, buffer.readUInt8(0) + 1) === "BitTorrent protocol" && buffer.slice(28,48).toString('binary') === infoHash.toString('binary')){
    peer.peerID = buffer.slice(48,68).toString();
    peer.hasHandshake = true;
    peer.trigger('hasHandshake');
    console.log('handshake successful!!');
    console.log('peerID is ', peer.peerID);
  } else {
    console.log("didn't receive a valid handshake!");
    peer.disconnect();
  }
};

exports.consumeMessage = function(message, peer){

};