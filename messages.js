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
    peer.emit('hasHandshake');
    console.log('handshake successful!!');
    console.log('peerID is ', peer.peerID);
  } else {
    console.log("didn't receive a valid handshake!");
    peer.disconnect();
  }
};

exports.consumeMessage = function(message, peer){
  if (message.data.length === 0){
    console.log('peer ', peer.id , ' sent a keep alive');
    peer.emit('keepAlive');
  } else {
    switch (message.data.readUInt8(0)){
      case 0:
      //choke
      peer.choking = true;
      console.log('peer ', peer.id , ' is now choking');
      break;
      case 1:
      //unchoke
      peer.choking = false;
      console.log('peer ', peer.id , ' is now unchoked');
      break;
      case 2:
      //interested
      peer.interested = true;
      console.log('peer ', peer.id , ' is now interested');
      break;
      case 3:
      //not interested
      peer.interested = false;
      console.log('peer ', peer.id , ' is now uninterested');
      break;
      case 4:
      //have
      console.log('peer ', peer.id , ' has a piece');
      break;
      case 5:
      //bitfield
      console.log('peer ', peer.id , ' sent a bitfield');
      break;
      case 6:
      //request
      console.log('peer ', peer.id , ' sent a request');
      break;
      case 7:
      //piece
      console.log('peer ', peer.id , ' sent a piece');
      break;
    }
  }
};