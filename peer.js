var net = require('net');
var events = require('events');
var util = require('util');
var MessageParser = require('./messageParser');
var infoHash;
var clientID;
var messages;
var id = 0;

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
};

util.inherits(Peer, events.EventEmitter);

Peer.prototype.connect = function(){
  self = this;
  self.hasHandshake = false;
  self.connection = new net.Socket();
  self.connection.connect(self.port, self.ip);
  var messageParser = require('./messageParser')(self, infoHash, messages);

  self.connection.on('data', function(chunk){
    console.log('data received from peer ', self.id);
    messageParser.consume(chunk);
  });

  self.connection.on('connect', function(){
    self.isConnected = true;
    console.log('connected to: ' + self.ip + ':' + self.port);
    self.connection.write(messages.generateHandshake(infoHash, clientID), function(){
      console.log('wrote handshake!');
    });
  });

  self.connection.on('timeout', function(){
    console.log('timeout!');
    self.connection.end();
  });

  self.connection.on('close', function(hadError){
    if (hadError){
      self.connectionError = true;
      console.log('connection closed due to error');
    } else {
      console.log('connection closed!');
    }
      self.disconnect();
  });

  self.connection.on('error', function(exception){
    self.connectionError = true;
    self.isConnected = false;
    self.hasHandshake = false;
    console.log('Exception: ', exception);
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
  this.bitField = [];
  for (var i = 0; i < bitBuffer.length; i++){
    for (var j = 0; j < bitBuffer[i].toString(2).length; j++){
      this.bitField.push(bitBuffer[i].toString(2)[j] === "1" ? true : false);
    }
  }
  this.emit('bitField', this);
};

Peer.prototype.getPiece = function(){
  if (! this.assignedPiece){
    throw new Error('peer told to get a piece when no piece is assigned');
  } else {
    this.connection.write(messages.generateRequest(this.assignedPiece));
  }
};

module.exports = function(_infoHash, _clientID, _messages){
  infoHash = _infoHash;
  clientID = _clientID;
  messages = _messages;
  return Peer;
};