var bencode = require('bencode');
var fs = require('fs');
var crypto = require('crypto');
var url = require('url');
var request = require('request');


var createSHA1 = function(string){
  return (new Buffer(crypto.createHash('sha1').update(string).digest('binary'), 'binary')).toString('binary');
};

var torrent = bencode.decode(new Buffer(fs.readFileSync(__dirname + '/testdata/fedora.torrent')));
var infoHash = createSHA1(bencode.encode(torrent.info));
var clientID = '-CT0000-111111111111';
var escapedInfoHash = escape(infoHash);

var uri = torrent.announce.toString('binary') + '?';
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

var peerCreator = require('./peer')(infoHash, clientID);

//need to add a listener for unprompted connections ... ie a peer wants to connect to me
var peers = [];

request({
  uri: uri,
  encoding: null
}, function(error, response, body){
  if (!error){
    var bodyObj = bencode.decode(body);
    var index = 0;
    while (index < bodyObj.peers.length){
      peers.push(new peerCreator.Peer(bodyObj.peers.slice(index, index + 6)));
      index = index + 6;
    }
    console.log('trying to connect to: ', peers[0]);
    peers[peers.length - 1].connect();
  }
});