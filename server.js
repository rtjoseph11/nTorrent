var bencode = require('bencode');
var fs = require('fs');
var crypto = require('crypto');
var url = require('url');
var request = require('request');
var ip = require('ip');
var peer = require('./peer');


var createSHA1 = function(string){
  return (new Buffer(crypto.createHash('sha1').update(string).digest('binary'), 'binary')).toString('binary');
};

var torrent = bencode.decode(new Buffer(fs.readFileSync(__dirname + '/testdata/linuxmint.torrent')));
var infoHash = createSHA1(bencode.encode(torrent.info));

infoHash = escape(infoHash);

console.log(infoHash);
var uri = torrent.announce.toString('binary') + '?';
var query = {
    info_hash: infoHash,
    peer_id: '-CT0000-111111111111' ,
    port: 6881,
    uploaded: '48',
    downloaded: '48',
    left: '48',
    compact: 1
};

for (var key in query){
  uri += key + "=" + query[key] + "&";
}



console.log(uri);

var peers = [];

request({
  uri: uri,
  encoding: null
}, function(error, response, body){
  if (!error){
    var bodyObj = bencode.decode(body);
    var index = 0;
    while (index < bodyObj.peers.length){
      peers.push(new peer.peer(bodyObj.peers.slice(index, index + 6)));
      index = index + 6;
    }
    console.log(peers);
  }
});