var bencode = require('bencode');
var fs = require('fs');
var crypto = require('crypto');
var url = require('url');
var request = require('request');
var Peers = require('./peers');
//need to change createSHA1 to deal with buffers
var createSHA1 = function(info){
  return crypto.createHash('sha1').update(info).digest();
};

//need to change the readfile to take a CLI argument rather than a harcoded string
var torrent = bencode.decode(new Buffer(fs.readFileSync(__dirname + '/testdata/fedora.torrent')));
var infoHash = createSHA1(bencode.encode(torrent.info));
var PieceField = require('./pieceField');
var pieceField = new PieceField(torrent.info);
pieceField.on('checkForPiece', pieceField.checkForPiece);
var messages = require('./messages');
var clientID = '-CT0000-111111111111';
var escapedInfoHash = escape(infoHash.toString('binary'));
var uri = torrent.announce.toString('binary') + '?';

//need to actually calculate peer_id, uploaded,downloaded, and left
var query = {
    info_hash: escapedInfoHash,
    peer_id: clientID,
    port: 6881,
    uploaded: '48',
    downloaded: '48',
    left: '48',
    compact: 1
};

for (var key in query){
  uri += key + "=" + query[key] + "&";
}

var Peer = require('./peer')(infoHash, clientID, messages);
var peers = new Peers();

var peerBindings = function(peer){
  peer.on('bitField', pieceField.registerPeer);
  peer.on('unchoke', pieceField.checkForPiece);
  peer.on('assignedPiece', peer.getPiece);
  peer.on('pieceFinished', pieceField.checkForPiece);
};
//need to add a listener for unprompted connections ... ie a peer wants to connect to me

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
});