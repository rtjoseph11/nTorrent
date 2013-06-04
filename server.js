var bencode = require('bencode');
var fs = require('fs');
var crypto = require('crypto');
var url = require('url');
var request = require('request');

var createSHA1 = function(string){
  return (new Buffer(crypto.createHash('sha1').update(string).digest('binary'), 'binary')).toString('binary');
};

var torrentFile = new Buffer(fs.readFileSync(__dirname + '/testdata/fedora.torrent'));
debugger;
var torrent = bencode.decode(torrentFile);

var infoHash = createSHA1(bencode.encode(torrent.info));
infoHash = escape(infoHash);

console.log(result['announce-list']);

var uri = result.announce + '?';
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

request({
  uri: uri
}, function(error, response, body){
  if (!error){
    // var bodyObj = bencode.decode(new Buffer(body));
    debugger;
    console.log(body);
    // for (var i = 0; i < bodyObj.peers.length; i++){
      // console.log('peers(' + i + '): ', bodyObj.peers[i]);
    // }
  }
});