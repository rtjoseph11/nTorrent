var numToBitString = function(number){
  result = '';
  result += number & 128 ? '1' : '0';
  result += number & 64 ? '1' : '0';
  result += number & 32 ? '1' : '0';
  result += number & 16 ? '1' : '0';
  result += number & 8 ? '1' : '0';
  result += number & 4 ? '1' : '0';
  result += number & 2 ? '1' : '0';
  result += number & 1 ? '1' : '0';
  return result;
};

var generateBitString = function(buffer){
  var result = '';
  for (var i = 0; i < buffer.length; i++){
    result += numToBitString(buffer[i]);
  }
  return result;
};

var getPieceIndex = function(buffer){
  return buffer.readUInt32BE(0);
};

var getBlock = function(buffer){
  return {
    index: buffer.readUInt32BE(0),
    begin: buffer.readUInt32BE(4),
    data:  buffer.slice(8)
  };
};
exports.generateHandshake = function(infoHash, clientID){
  var result = new Buffer(68);
  result.writeUInt8(19, 0);
  result.write('BitTorrent protocol', 1, 19);
  result.fill(null, 20);
  infoHash.copy(result, 28);
  result.write(clientID, 48, 20);
  return result;
};

exports.generateRequest = function(piece){
  //2^14 = 16384
  var result = new Buffer(17);
  result.writeUInt32BE(13 , 0);
  result.writeUInt8(6 , 4);
  result.writeUInt32BE(piece.index, 5);
  result.writeUInt32BE(piece.currentLength, 9);
  result.writeUInt32BE(Math.min(16384, piece.data.length - piece.currentLength), 13);
  return result;
};

exports.generateInterested = function(){
  var result = new Buffer(5);
  result.writeUInt32BE(1, 0);
  result.writeUInt8(2, 4);
  return result;
};
exports.consumeHandshake = function(buffer, infoHash, peer){
  if( buffer.toString('utf8', 1, buffer.readUInt8(0) + 1) === "BitTorrent protocol" && buffer.slice(28,48).toString('binary') === infoHash.toString('binary')){
    peer.peerID = buffer.slice(48,68).toString();
    peer.hasHandshake = true;
    peer.emit('hasHandshake');
    console.log('handshake with peer ', peer.id, ' successful!!');
  } else {
    console.log("didn't receive a valid handshake from peer ", peer.id, "!");
    peer.disconnect();
  }
};

exports.consumeMessage = function(message, peer){
  if (message.data.length === 0){
    peer.keepAlive();
  } else {
    switch (message.data.readUInt8(0)){
      case 0:
      //choke
      peer.choke();
      break;
      case 1:
      //unchoke
      peer.unchoke();
      break;
      case 2:
      //interested
      peer.interested();
      break;
      case 3:
      //not interested
      peer.unInterested();
      break;
      case 4:
      //have
      peer.hasPiece(getPieceIndex(message.data.slice(1)));
      break;
      case 5:
      //bitfield
      peer.generateBitField(generateBitString(message.data.slice(1)));
      break;
      case 6:
      //request
      console.log('peer ', peer.id , ' sent a request');
      break;
      case 7:
      //piece
      peer.assignedPiece.writeBlock(getBlock(message.data.slice(1)));
      break;
    }
  }
};