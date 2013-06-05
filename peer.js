var net = require('net');
var messages = require('./messages');
var MessageParser = require('./messageParser');
var peerObj = {};
var infoHash;
var clientID;
module.exports = function(_infoHash, _clientID){
  infoHash = _infoHash;
  clientID = _clientID;
  return peerObj;
};
peerObj.Peer = function(buffer){
  this.ip = buffer[0] + '.' + buffer[1] + '.' + buffer[2] + '.' + buffer[3];
  this.port = buffer.readUInt16BE(4);
  this.am_choking = true;
  this.peer_choking = true;
};

peerObj.Peer.prototype.connect = function(){
  self = this;
  self.connection = new net.Socket();
  self.connection.connect(this.port, this.ip);
  var messageParser = new MessageParser.Parser();
  self.connection.on('data', function(chunk){
    console.log('data chunk: ', chunk);
    messageParser.consume(chunk);
  });
  self.connection.on('connect', function(){
    self.isConnected = true;
    self.hasHandshake = false;
    console.log('the connection listener works!');
    console.log('connected to: ' + self.ip + ':' + self.port);
    console.log(messages.handshake(infoHash, clientID));
    self.connection.write(messages.handshake(infoHash, clientID), function(){
      console.log('wrote handshake!');
    });
  });
  self.connection.on('timeout', function(){
    console.log('timeout!');
    self.connection.end();
  });
  self.connection.on('close', function(had_error){
    if (had_error){
      self.connectionError = true;
      self.disconnect();
      console.log('connection closed due to error');
    } else {
      console.log('connection closed!');
    }
  });
  self.connection.on('error', function(exception){
    self.connectionError = true;
    self.isConnected = false;
    console.log('Exception: ', exception);
  });
};

peerObj.Peer.prototype.disconnect = function(){
  if(this.connection){
    this.isConnected = false;
    this.connection.end();
  }
};