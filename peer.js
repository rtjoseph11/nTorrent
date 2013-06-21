var net = require('net');
var events = require('events');
var util = require('util');
var MessageParser = require('./messageParser');
var numPieces;
var infoHash;
var clientID;
var messages;
var id = 0;

var Peer = function(buffer, connection){
  events.EventEmitter.call(this);
  this.ip = buffer[0] + '.' + buffer[1] + '.' + buffer[2] + '.' + buffer[3];
  this.port = buffer.readUInt16BE(4);
  this.amChoking = true;
  this.amInterested = false;
  this.choking = true;
  this.interested = false;
  this.sentHandshake = false;
  this.receivedHandshake = false;
  this.assignedPiece = null;
  this.id = ++id;
  this.bitField = [];
  if (connection){
    this.connection = connection;
    this.isConnected = true;
    this.eventBindings();
  }
};

util.inherits(Peer, events.EventEmitter);

Peer.prototype.connect = function(){
  var self = this;
  if (! self.connectionError){
    self.connectionError = false;
  }
  if (! self.connection){
    self.connection = new net.Socket();
    self.connection.connect(self.port, self.ip);
  }

  self.connection.removeAllListeners();
  self.eventBindings();

  self.connection.on('connect', function(){
    self.isConnected = true;
    console.log('connected to peer ', self.id ,': ' + self.ip + ':' + self.port);
    self.sendHandshake();
  });
};

Peer.prototype.disconnect = function(){
    this.isConnected = false;
    this.receivedHandshake = false;
    this.sentHandshake = false;
    if (this.assignedPiece){
      this.releasePiece();
    }
    this.emit('disconnect', this);
    this.connection.removeAllListeners();
    this.connection.end();
};

Peer.prototype.generateBitField = function(bitString){
  console.log('peer ', this.id , ' sent a bitfield');
  var count = 0;
  for (var i = 0; i < bitString.length; i++){
    if (count < numPieces){
      this.bitField.push(bitString[i] === "1" ? true : false);
      count++;
    }
  }
  this.emit('bitField', this);
};

Peer.prototype.getPiece = function(){
  var self = this;
  if (! self.assignedPiece || self.choking || ! self.isConnected || ! self.sentHandshake || ! self.receivedHandshake){
    self.releasePiece();
  } else if (!self.pendingRequest){
    self.connection.write(messages.generateRequest(self.assignedPiece), function(){
      self.pendingRequest = true;
      self.requestTimeout = setTimeout(function(){
        console.log('piece ', self.assignedPiece.index, ' timed out!!!!');
        self.emit('pieceTimeout', self);
      }, 60000);
    });
  }
};

Peer.prototype.releasePiece = function(){
  if (this.requestTimeout){
    clearTimeout(this.requestTimeout);
    this.requestTimeout = undefined;
  }
  if (this.assignedPiece){
      this.assignedPiece.currentLength = 0;
      this.assignedPiece.assignedPeer = null;
      this.pendingRequest = false;
  }
  console.log('floating piece');
  this.emit('floatingPiece');
};

Peer.prototype.unchoke = function(){
  console.log('peer ', this.id , ' is no longer choking the client');
  this.choking = false;
  if (this.assignedPiece){
        this.getPiece();
  } else {
    this.emit('available');
  }
};

Peer.prototype.choke = function(){
  console.log('peer ', this.id , ' is now choking');
  this.choking = true;
};

Peer.prototype.isInterested = function(){
  this.interested = true;
  this.amChoking = false;
  console.log('peer ', this.id , ' is now interested');
  this.sendUnchoke();
};

Peer.prototype.isUnInterested = function(){
  this.interested = false;
  console.log('peer ', this.id , ' is now uninterested');
};

Peer.prototype.keepAlive = function(){
  console.log('peer ', this.id , ' sent a keep alive');
  this.emit('keepAlive');
};

Peer.prototype.hasPiece = function(index){
   this.bitField[index] = true;
   this.emit('hasPiece', this, index);
};

Peer.prototype.sendPiece = function(block){
  var self = this;
  self.connection.write(messages.generateBlock(block));
};

Peer.prototype.sendBitField = function(bitField){
  var self = this;
  self.connection.write(messages.generateBitField(bitField), function(){
    console.log('sent bitfield to peer ', self.id);
  });
};

Peer.prototype.sendInterested = function(){
  var self = this;
  self.connection.write(messages.generateInterested(), function(){
    console.log('expressing interested to peer ', self.id);
  });
};

Peer.prototype.sendUnchoke = function(){
  var self = this;
  self.connection.write(messages.generateUnchoke(), function(){
    console.log('unchoking peer ', self.id);
  });
};

Peer.prototype.sendHandshake = function(){
  var self = this;
  self.connection.write(messages.generateHandshake(infoHash, clientID), function(){
    self.sentHandshake = true;
    console.log('wrote handshake to peer ', self.id ,'!');
  });
};

Peer.prototype.writeBlock = function(block){
  if(this.requestTimeout){
    clearTimeout(this.requestTimeout);
    this.requestTimeout = undefined;
  }
  this.pendingRequest = false;
  if (this.assignedPiece){
    this.assignedPiece.writeBlock(block);
  }
};

Peer.prototype.eventBindings = function(){
  var self = this;

  var messageParser = new MessageParser(self, infoHash, messages);

  self.connection.on('data', function(chunk){
    messageParser.consume(chunk);
  });
  self.connection.on('error', function(exception){
    self.connectionError = true;
    console.log('peer ', self.id, ' Exception: ', exception);
  });

  self.connection.on('close', function(hadError){
    if (hadError){
      self.connectionError = true;
    } else {
      console.log('peer ', self.id, ' connection closed!');
    }
    self.disconnect();
  });
};

module.exports = function(_infoHash, _clientID, _messages, _numPieces){
  infoHash = _infoHash;
  clientID = _clientID;
  messages = _messages;
  numPieces = _numPieces;
  return Peer;
};