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

var bitArrayToNum = function(array){
  var result = 0;
  result += array[0] === 1 ? 128 : 0;
  result += array[1] === 1 ? 64 : 0;
  result += array[2] === 1 ? 32 : 0;
  result += array[3] === 1 ? 16 : 0;
  result += array[4] === 1 ? 8 : 0;
  result += array[5] === 1 ? 4 : 0;
  result += array[6] === 1 ? 2 : 0;
  result += array[7] === 1 ? 1 : 0;
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

var getRequest = function(buffer){
  return {
    index: buffer.readUInt32BE(0),
    begin: buffer.readUInt32BE(4),
    length: buffer.readUInt32BE(8)
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

exports.generateBitField = function(bitMap){
  var bitField = new Buffer(Math.ceil(bitMap.length / 8));
  for (var i = 0; i < bitMap.length; i+=8){
    bitField.writeUInt8(bitArrayToNum(bitMap.slice(i, i + 8)), i / 8);
  }
  var result = new Buffer(5 + bitField.length);
  result.writeUInt32BE(1 + bitField.length, 0);
  result.writeUInt8(5, 4);
  bitField.copy(result, 5, 0, bitField.length);
  return result;
};

exports.generateRequest = function(block){
  //2^14 = 16384
  var result = new Buffer(17);
  result.writeUInt32BE(13 , 0);
  result.writeUInt8(6 , 4);
  result.writeUInt32BE(block.index, 5);
  result.writeUInt32BE(block.begin, 9);
  result.writeUInt32BE(block.length, 13);
  return result;
};

exports.generateCancel = function(block){
  var result = new Buffer(17);
  result.writeUInt32BE(13, 0);
  result.writeUInt8(8, 4);
  result.writeUInt32BE(block.index, 5);
  result.writeUInt32BE(block.begin, 9);
  result.writeUInt32BE(block.length, 13);
  return result;
};

exports.generateBlock = function(block){
  var result = new Buffer(13 + block.data.length);
  result.writeUInt32BE(9 + block.data.length, 0);
  result.writeUInt8(7, 4);
  result.writeUInt32BE(block.index, 5);
  result.writeUInt32BE(block.begin, 9);
  block.data.copy(result, 13, 0, block.data.length);
  return result;
};

exports.generateInterested = function(){
  var result = new Buffer(5);
  result.writeUInt32BE(1, 0);
  result.writeUInt8(2, 4);
  return result;
};

exports.generateHasPiece = function(index){
  var result = new Buffer(9);
  result.writeUInt32BE(5, 0);
  result.writeUInt8(4,4);
  result.writeUInt32BE(index, 5);
  return result;
};

exports.generateUnchoke = function(){
  var result = new Buffer(5);
  result.writeUInt32BE(1,0);
  result.writeUInt8(1, 4);
  return result;
};

exports.consumeHandshake = function(buffer, infoHash, peer){
  if( buffer.toString('utf8', 1, buffer.readUInt8(0) + 1) === "BitTorrent protocol" && buffer.slice(28,48).toString('binary') === infoHash.toString('binary')){
    console.log('handshake with peer ', peer.id, ' successful!!');
    peer.peerID = buffer.slice(48,68).toString();
    peer.receivedHandshake = true;
    peer.emit('receivedHandshake', peer);
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
      peer.isInterested();
      break;
      case 3:
      //not interested
      peer.isUnInterested();
      break;
      case 4:
      //have
      peer.registerPiece(getPieceIndex(message.data.slice(1)));
      break;
      case 5:
      //bitfield
      peer.generateBitField(generateBitString(message.data.slice(1)));
      break;
      case 6:
      //request
      peer.emit('blockRequest', getRequest(message.data.slice(1)), peer);
      break;
      case 7:
      //piece
      peer.writeBlock(getBlock(message.data.slice(1)));
      break;
      case 8:
      //cancel
      peer.cancelRequest(getBlock(message.data.slice(1)));
      break;
    }
  }
};