var net = require('net');
var messages = require('./messages');
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
  self.connection.connect(this.port, this.ip, function(){
     console.log('connected to: ' + self.ip + ':' + self.port);
     self.connection.write(messages.handshake(infoHash, clientID), function(){
      console.log('wrote handshake!');
     });
  });
  self.connection.on('data', function(chunk){
    console.log('data chunk: ', chunk);
  });
  self.connection.on('connect', function(){
    self.isConnected = true;
    console.log('the connection listener works!');
  });
  self.connection.on('timeout', function(){
    console.log('timeout!');
    self.connection.end();
  });
  self.connection.on('close', function(had_error){
    if (had_error){
      console.log('connection closed due to error');
    } else {
      console.log('connection closed!');
    }
  });
  self.connection.on('error', function(exception){
    console.log('Exception: ', exception);
  });
};

peerObj.Peer.prototype.disconnect = function(){
  if(this.connection){
    this.connection.end();
  }
};