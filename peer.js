var net = require('net');
var events = require('events');
var util = require('util');
var MessageParser = require('./messageParser');
var numPieces;
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
  this.bitField = [];
};

util.inherits(Peer, events.EventEmitter);

Peer.prototype.connect = function(){
  var self = this;
  self.hasHandshake = false;
  self.connectionError = false;
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

  self.connection.on('error', function(exception){
    self.connectionError = true;
    self.isConnected = false;
    self.hasHandshake = false;
    if (self.assignedPiece){
      self.assignedPiece.assignedPeer = null;
      self.emit('floatingPiece');
    }
    self.emit('disconnect', self);
    console.log('peer ', self.id, ' Exception: ', exception);
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

  self.connection.on('timeout', function(){
    if (self.assignedPiece){
      self.assignedPiece.assignedPeer = null;
      self.emit('floatingPiece');
    }
    self.emit('disconnect', self);
    self.connection.end();
  });
};

Peer.prototype.disconnect = function(){
    this.isConnected = false;
    this.hasHandshake = false;
    if (this.assignedPiece){
      this.assignedPiece.assignedPeer = null;
      this.emit('floatingPiece');
      console.log('floating piece');
    }
    this.emit('disconnect', this);
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
  if (! self.assignedPiece || self.choking || ! self.isConnected || ! self.hasHandshake){
    throw new Error('peer told to get a piece when it shouldnt have been');
  } else if (!self.pendingRequest){
    self.connection.write(messages.generateRequest(self.assignedPiece), function(){
      self.pendingRequset = true;
    });
  }
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

Peer.prototype.interested = function(){
  this.interested = true;
  console.log('peer ', this.id , ' is now interested');
};

Peer.prototype.unInterested = function(){
  this.interested = false;
  console.log('peer ', this.id , ' is now uninterested');
};

Peer.prototype.keepAlive = function(){
  console.log('peer ', this.id , ' sent a keep alive');
  this.emit('keepAlive');
};

Peer.prototype.hasPiece = function(index){
   console.log('peer ', this.id , ' has piece ', index);
   this.bitField[index] = true;
   this.emit('hasPiece', this, index);
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