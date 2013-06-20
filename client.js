var bencode = require('bencode');
var fs = require('fs');
var crypto = require('crypto');
var url = require('url');
var request = require('request');
var Peers = require('./peers');

if (! fs.existsSync(__dirname + '/' + process.argv[2])){
  throw new Error('torrent file ' + process.argv[2] + " doesn't exist!");
}

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
var torrentFinished = false;
pieceField.on('checkForPiece', pieceField.checkForPiece);
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

var peerBindings = function(peer){
  peer.on('bitField', pieceField.registerPeer);
  peer.on('hasHandshake', peer.sendInterested);
  peer.on('available', pieceField.checkForPiece);
  peer.on('floatingPiece', pieceField.checkForPiece);
  peer.on('assignedPiece', peer.getPiece);
  peer.on('pieceFinished', pieceField.checkForPiece);
  peer.on('hasPiece', pieceField.registerPeerPiece);
  peer.on('disconnect', pieceField.unregisterPeer);
};
//need to add a listener for unprompted connections ... ie a peer wants to connect to me
if (process.argv[3] === 'sandbox'){
  var buf = new Buffer(6);
  buf.writeUInt8(10, 0);
  buf.writeUInt8(0, 1);
  buf.writeUInt8(1, 2);
  buf.writeUInt8(240, 3);
  buf.writeUInt16BE(24874, 4);
  var sandboxPeer = new Peer(buf);
  peerBindings(sandboxPeer);
  peers.add(sandboxPeer, buf);
  peers.connect();
}

if (! process.argv[3]){
  var uri = torrent.announce.toString('binary') + '?';
  if (uri.substring(0,4) !== "http"){
    throw new Error("tracker announce protocol is " + uri.substring(0,4) + " instead of http");
  }
  var query = {
      info_hash: escape(infoHash.toString('binary')),
      peer_id: clientID,
      port: 6881,
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
        if (!torrentFinished){
          console.log('next announce in ', Math.max(bodyObj.minInterval ? bodyObj.minInterval : bodyObj.interval, 60), ' seconds');
          console.log('received ', bodyObj.peers.length / 6, ' peers');
          setTimeout(trackerRequest, 60000);
        }
        for (var i = 0; i < bodyObj.peers.length; i += 6){
          if (! peers.hasPeer(bodyObj.peers.slice(i, i + 6))){
            var peer = new Peer(bodyObj.peers.slice(i, i + 6));
            peerBindings(peer);
            peers.add(peer, bodyObj.peers.slice(i, i + 6));
          }
        }
      }
      else {
        console.log(error);
        console.log(response);
      }
    });
  };
  trackerRequest();
}
