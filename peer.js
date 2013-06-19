var net = require('net');
var events = require('events');
var util = require('util');
var MessageParser = require('./messageParser');
var numPieces;
var infoHash;
var clientID;
var messages;
var id = 0;

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

var Peer = function(buffer){
  events.EventEmitter.call(this);
  this.ip = buffer[0] + '.' + buffer[1] + '.' + buffer[2] + '.' + buffer[3];
  this.port = buffer.readUInt16BE(4);
  this.amChoking = true;
  this.amInterested = false;
  this.choking = true;
  this.interested = false;
  this.assignedPiece = null;
  this.id = ++id;
  this.bitField = [];
};

util.inherits(Peer, events.EventEmitter);

Peer.prototype.connect = function(){
  var self = this;
  self.hasHandshake = false;
  self.connection = new net.Socket();
  self.connection.connect(self.port, self.ip);
  var messageParser = new MessageParser(self, infoHash, messages);

  self.connection.on('data', function(chunk){
    messageParser.consume(chunk);
  });

  self.connection.on('connect', function(){
    self.isConnected = true;
    console.log('connected to peer ', self.id ,': ' + self.ip + ':' + self.port);
    self.connection.write(messages.generateHandshake(infoHash, clientID), function(){
      console.log('wrote handshake to peer ', self.id ,'!');
    });
  });

  self.connection.on('timeout', function(){
    console.log('timeout!');
    self.connection.end();
  });

  self.connection.on('close', function(hadError){
    if (hadError){
      self.connectionError = true;
      console.log('peer ', self.id, ' connection closed due to error');
    } else {
      console.log('peer ', self.id, ' connection closed!');
    }
      self.disconnect();
  });

  self.connection.on('error', function(exception){
    self.connectionError = true;
    self.isConnected = false;
    self.hasHandshake = false;
    console.log('peer ', self.id, ' Exception: ', exception);
  });
};

Peer.prototype.disconnect = function(){
  if(this.connection){
    this.isConnected = false;
    this.hasHandshake = false;
    this.connection.end();
  }
};

Peer.prototype.generateBitField = function(bitBuffer){
  var count = 0;
  for (var i = 0; i < bitBuffer.length; i++){
    var bitString = numToBitString(bitBuffer[i]);
    for (var j = 0; j < bitString.length; j++){
      if (count < numPieces){
        this.bitField.push(bitString[j] === "1" ? true : false);
        count++;
      }
    }
  }
  this.emit('bitField', this);
};

Peer.prototype.getPiece = function(){
  if (! this.assignedPiece || this.choking || ! this.isConnected || ! this.hasHandshake){
    throw new Error('peer told to get a piece when it shouldnt have been');
  } else {
    this.connection.write(messages.generateRequest(this.assignedPiece));
  }
};

Peer.prototype.unchoke = function(){
  this.choking = false;
  this.emit('unchoke');
};

Peer.prototype.sendInterested = function(){
  console.log('expressing interested to peer ', this.id);
  this.connection.write(messages.generateInterested());
};

module.exports = function(_infoHash, _clientID, _messages, _numPieces){
  infoHash = _infoHash;
  clientID = _clientID;
  messages = _messages;
  numPieces = _numPieces;
  return Peer;
};