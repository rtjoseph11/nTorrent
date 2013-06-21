var bencode = require('bencode');
var fs = require('fs');
var crypto = require('crypto');
var url = require('url');
var request = require('request');
var Peers = require('./peers');
var net = require('net');

if (! fs.existsSync(__dirname + '/' + process.argv[2])){
  throw new Error('torrent file ' + process.argv[2] + " doesn't exist!");
}

if (! process.argv[3] || isNaN(process.argv[3]) || !process.argv[4]){
  throw new Error('need to provide a port to listen on and indicate seed status');
}
var port = process.argv[3];
var queryStringNumber = function(number){
  var result = [];
  for (var i = 0; i < number.toString().length; i++){
    result.push(number.toString().charCodeAt(i));
  }
  return escape(result.join(' '));
};
var torrent = bencode.decode(new Buffer(fs.readFileSync(__dirname + '/' + process.argv[2])));
var infoHash = crypto.createHash('sha1').update(bencode.encode(torrent.info)).digest();
var PieceField = require('./pieceField');
var pieceField = new PieceField(torrent.info);
var messages = require('./messages');
var clientID = '-NT0000-' + Date.now().toString().substring(1);


var Peer = require('./peer')(infoHash, clientID, messages, pieceField.length());
var peers = new Peers();
var reconnect = setInterval(peers.connect, 60000);
pieceField.on('torrentFinished', peers.disconnect);
pieceField.on('torrentFinished', function(){
  torrentFinished = true;
  clearInterval(reconnect);
});

var torrentFinished = pieceField.isFinished();
var peerBindings = function(peer){
  peer.on('bitField', pieceField.registerPeer);
  peer.on('receivedHandshake', function(p){
    if (p.sentHandshake){
      p.sendInterested();
    } else {
      p.sendHandshake();
      p.sendBitField(pieceField.bitField());
    }
  });
  peer.on('available', pieceField.checkForPiece);
  peer.on('floatingPiece', pieceField.checkForPiece);
  peer.on('assignedPiece', peer.getPiece);
  peer.on('pieceFinished', pieceField.checkForPiece);
  peer.on('hasPiece', pieceField.registerPeerPiece);
  peer.on('disconnect', pieceField.unregisterPeer);
  peer.on('pieceRequest', pieceField.sendPiece);
  peer.on('pieceTimeout', function(p){
    pieceField.banPeer(p);
    p.releasePiece();
  });
};

//sandbox mode is for testing against the local computer
if (process.argv[process.argv.length - 2] === 'sandbox'){
  var buf = new Buffer(6);
  //these 4 numbers are this computers ip address
  buf.writeUInt8(10, 0);
  buf.writeUInt8(0, 1);
  buf.writeUInt8(1, 2);
  buf.writeUInt8(240, 3);
  //this is the port.. make sure to not use a port already in use
  buf.writeUInt16BE(process.argv[process.argv.length - 1], 4);
  var sandboxPeer = new Peer(buf);
  peerBindings(sandboxPeer);
  peers.add(sandboxPeer, buf);
} else {
  //what actually gets used when not in sandbox mode
  var uri;
  if(torrent.announce.toString('binary').substring(0,4) === 'http'){
    uri = torrent.announce.toString('binary') + '?';
  } else if (torrent['announce-list']){
    for (var x = 0; x < torrent['announce-list'].length; x++){
      if (torrent['announce-list'][x][0].toString('binary').substring(0,4) === 'http'){
        uri = torrent['announce-list'][x][0].toString('binary') + '?';
        break;
      }
    }
  }
  if (! uri){
    throw new Error("no http trackers");
  }
  var query = {
      info_hash: escape(infoHash.toString('binary')),
      peer_id: clientID,
      port: port,
      uploaded: pieceField.uploaded(),
      downloaded: pieceField.downloaded(),
      left: pieceField.left(),
      compact: 1,
      numwant: 1000
  };

  for (var key in query){
    uri += key + "=" + query[key] + "&";
  }
  var trackerRequest = function(){
    request({
      uri: uri,
      encoding: null
    }, function(error, response, body){
      console.log('requested peers from ', uri);
      if (!error){
        var bodyObj = bencode.decode(body);
        if (!bodyObj['failure reason']){
          if (!torrentFinished && peers.length() < 500){
            console.log('requesting peers in 60 seoncds');
            setTimeout(trackerRequest, 60000);
          }
          for (var i = 0; i < bodyObj.peers.length; i += 6){
            if (! peers.hasPeer(bodyObj.peers.slice(i, i + 6))){
              var peer = new Peer(bodyObj.peers.slice(i, i + 6));
              peerBindings(peer);
              peers.add(peer, bodyObj.peers.slice(i, i + 6));
            }
          }
        } else {
          console.log(bodyObj['failure reason'].toString());
        }
      }
      else {
        console.log(error);
        console.log(response);
      }
    });
  };
  !torrentFinished && trackerRequest();
}

//this handles unsolicted peers
var client = net.createServer(function(c){
  console.log('unsolicted peer connected!');
  var buf = new Buffer(6);
  var ip = c.remoteAddress.split('.');
  buf.writeUInt8(Number(ip[0]), 0);
  buf.writeUInt8(Number(ip[1]), 1);
  buf.writeUInt8(Number(ip[2]), 2);
  buf.writeUInt8(Number(ip[3]), 3);
  buf.writeUInt16BE(c.remotePort, 4);
  var unsolicitedPeer = new Peer(buf, c);
  peerBindings(unsolicitedPeer);
  peers.add(unsolicitedPeer, buf);
});
client.listen(port, function(){
  console.log('client bound to port ', port);
});
if (process.argv[3] !== 'seed'){
  pieceField.on('torrentFinished', client.unref);
}