var bencode = require('bencode');
var fs = require('fs');
var crypto = require('crypto');
var url = require('url');
var request = require('request');
var Peers = require('./peers');
var createSHA1 = function(info){
  return crypto.createHash('sha1').update(info).digest();
};

if (! fs.existsSync(__dirname + '/' + process.argv[2])){throw new Error('torrent file ' + process.argv[2] + " doesn't exist!");}
var torrent = bencode.decode(new Buffer(fs.readFileSync(__dirname + '/' + process.argv[2])));
var infoHash = createSHA1(bencode.encode(torrent.info));
var PieceField = require('./pieceField');
var pieceField = new PieceField(torrent.info);
pieceField.on('checkForPiece', pieceField.checkForPiece);
var messages = require('./messages');
var clientID = '-NT0000-111111111111';


var Peer = require('./peer')(infoHash, clientID, messages);
var peers = new Peers();
pieceField.on('torrentFinished', peers.disconnect);
var peerBindings = function(peer){
  peer.on('bitField', pieceField.registerPeer);
  peer.on('unchoke', pieceField.checkForPiece);
  peer.on('assignedPiece', peer.getPiece);
  peer.on('pieceFinished', pieceField.checkForPiece);
  peer.on('hasPiece', pieceField.registerPeerPiece);
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
  peers.add(sandboxPeer);
  peers.connect();
}

if (! process.argv[3]){
  var escapedInfoHash = escape(infoHash.toString('binary'));
  var uri = torrent.announce.toString('binary') + '?';
  if (uri.substring(0,4) !== "http"){
    throw new Error("tracker announce protocol is " + uri.substring(0,4) + " instead of http");
  }
  var query = {
      info_hash: escapedInfoHash,
      peer_id: clientID,
      port: 6881,
      uploaded: pieceField.uploaded(),
      downloaded: pieceField.downloaded(),
      left: pieceField.left(),
      compact: 1
  };

  for (var key in query){
    uri += key + "=" + query[key] + "&";
  }
  console.log('requesting peers from ', uri);
  request({
    uri: uri,
    encoding: null
  }, function(error, response, body){
    if (!error){
      var bodyObj = bencode.decode(body);
      for (var i = 0; i < bodyObj.peers.length; i += 6){
        var peer = new Peer(bodyObj.peers.slice(index, index + 6));
        peerBindings(peer);
        peers.add(peer);
      }
      peers.connect();
    }
    else {
      console.log(error);
      console.log(response);
    }
  });
}
