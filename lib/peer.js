var net = require('net'),
    events = require('events'),
    util = require('util'),
    constants = require('./constants'),
    numPieces,
    infoHash,
    clientID,
    messages,
    peers,
    id = 0;

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
  this.assignedBlock = null;
  this.id = ++id;
  this.bitField = [];
  this.requestCancels = {};
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
  }

  self.connection.removeAllListeners();
  self.eventBindings();
  self.connection.connect(self.port, self.ip);
};

Peer.prototype.disconnect = function(){
    this.isConnected = false;
    this.receivedHandshake = false;
    this.sentHandshake = false;
    this.connection.removeAllListeners();
    this.connection.end();
    if (this.assignedBlock){
      this.releaseBlock();
    }
    this.emit('disconnect', this);
};

Peer.prototype.generateBitField = function(bitString){
  var count = 0;
  for (var i = 0; i < bitString.length; i++){
    if (count < numPieces){
      this.bitField.push(bitString[i] === "1" ? true : false);
      count++;
    }
  }
  this.emit('bitField', this);
};

Peer.prototype.getBlock = function(block){
  var self = this;
  if (self.choking || ! self.isConnected || ! self.sentHandshake || ! self.receivedHandshake){
    self.releaseBlock();
  } else if (!self.pendingRequest){
    self.connection.write(messages.generateRequest(block), function(){
      self.pendingRequest = true;
      self.requestTimeout = setTimeout(function(){
        console.log('piece ', block.index, ' had a block timed out!!!!');
        if (self.assignedBlock){
          self.releaseBlock();
        }
        self.emit('blockTimeout', self);
      }, 20000);
    });
  }
};

Peer.prototype.releaseBlock = function(){
  if (this.requestTimeout){
    clearTimeout(this.requestTimeout);
    this.requestTimeout = undefined;
  }
  if (this.assignedBlock){
    this.emit('blockRelease', this.assignedBlock);
    this.assignedBlock = null;
  }
  this.emit('available');
};

Peer.prototype.unchoke = function(){
  this.choking = false;
  this.emit('available');
};

Peer.prototype.choke = function(){
  this.choking = true;
};

Peer.prototype.isInterested = function(){
  this.interested = true;
  this.amChoking = false;
  this.sendUnchoke();
};

Peer.prototype.isUnInterested = function(){
  this.interested = false;
};

Peer.prototype.cancelRequest = function(block){
  this.requestCancels[block.index] = this.requestCancels[block.index] || {};
  this.requestCancels[block.index][block.begin] = true;
};

Peer.prototype.keepAlive = function(){
  this.emit('keepAlive');
};

Peer.prototype.registerPiece = function(index){
  this.bitField[index] = true;
  this.emit('hasPiece', this, index);
};

Peer.prototype.hasPiece = function(index){
  return this.bitField[index];
};

Peer.prototype.sendHasPiece = function(index){
  this.connection.write(messages.generateHasPiece(index));
};

Peer.prototype.sendCancelRequest = function(block){
  var self = this;
  self.connection.write(messages.generateCancel(block), function(){
    self.assignedBlock = null;
    self.pendingRequest = false;
    self.emit('available');
  });
};

Peer.prototype.hasHandshake = function(){
  return this.sentHandshake && this.receivedHandshake;
};

Peer.prototype.sendBlock = function(block){
  if (this.requestCancels[block.index] && this.requestCancels[block.index][block.begin]){
    delete this.requestCancels[block.index][block.begin];
  } else {
    this.connection.write(messages.generateBlock(block));
  }
};

Peer.prototype.sendBitField = function(bitField){
  this.connection.write(messages.generateBitField(bitField));
};

Peer.prototype.sendInterested = function(){
  this.amInterested = true;
  this.connection.write(messages.generateInterested());
};

Peer.prototype.sendUnchoke = function(){
  this.connection.write(messages.generateUnchoke());
};

Peer.prototype.sendHandshake = function(){
  var self = this;
  self.connection.write(messages.generateHandshake(infoHash, clientID), function(){
    self.sentHandshake = true;
  });
};

Peer.prototype.writeBlock = function(block){
  if(this.requestTimeout){
    clearTimeout(this.requestTimeout);
    this.requestTimeout = undefined;
  }
  if(this.assignedBlock){
    this.assignedBlock = null;
  }
  this.pendingRequest = false;
  this.emit('blockComplete', block, this);
};

var handleReadable = function(){
  if (!this.receivedHandshake){
    this.readHandshake();
  } else {
    if (!this.messageLengthBuffer){
      this.messageLengthBuffer = this.connection.read(4);
    }
    this.consumeReadable();
  }
};

var handleConnection = function(){
  this.isConnected = true;
  this.sendHandshake();
  this.emit('connected');
};

var handleClose = function(hadError){
  if (hadError){
    this.connectionError = true;
  } else {
    console.log('peer ', this.id, ' connection closed!');
  }
  this.disconnect();
};

var handleError = function(exception){
  this.connectionError = true;
  console.log('peer ', this.id, ' Exception: ', exception);
};

var handleHandshake = function(){
  if (!this.sentHandshake){
    this.sendHandshake();
    this.sendBitField(pieceField.bitField());
  }
};

Peer.prototype.eventBindings = function(){
  this.on('available', pieceField.checkForPiece.bind(pieceField));
  this.on('blockRelease', pieceField.releaseBlock);
  this.on('hasPiece', pieceField.registerPeerPiece);
  this.on('disconnect', pieceField.unregisterPeer);
  this.on('disconnect', peers.decrementConnected);
  this.on('connected', peers.incrementConnected);
  this.on('blockRequest', pieceField.sendBlock);
  this.on('blockComplete', pieceField.writeBlock);
  this.on('bitField', pieceField.registerPeer);
  this.on('receivedHandshake', handleHandshake.bind(this));
  this.connection.on('readable', handleReadable.bind(this));
  this.connection.on('error', handleError.bind(this));
  this.connection.on('close', handleClose.bind(this));
  this.connection.on('connect', handleConnection.bind(this));
};

Peer.prototype.consumeReadable = function(){
  var message;
  var messageLength;
  while (this.messageLengthBuffer){
    messageLength = this.messageLengthBuffer.readUInt32BE(0);
    message = messageLength !== 0 ? this.connection.read(messageLength) : new Buffer(0);
    if(message){
      messages.consumeMessage({data: message}, this);
      message = undefined;
      this.messageLengthBuffer = this.connection.read(4);
    } else {
      break;
    }
  }
};

Peer.prototype.readHandshake = function(){
  var message = this.connection.read(constants.handShakeLength);
  if (message){
    messages.consumeHandshake(message, infoHash, this);
    this.messageLengthBuffer = this.connection.read(4);
    this.consumeReadable();
  }
};

module.exports = function(_infoHash, _clientID, _messages, _pieceField, _peers){
  infoHash = _infoHash;
  clientID = _clientID;
  messages = _messages;
  numPieces = _pieceField.length();
  pieceField = _pieceField;
  peers = _peers;
  return Peer;
};