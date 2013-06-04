var bencode = require('./bcode');
var fs = require('fs');
var crypto = require('crypto');
var url = require('url');
var request = require('request');
var ip = require('ip');

var createSHA1 = function(string){
  return (new Buffer(crypto.createHash('sha1').update(string).digest('binary'), 'binary')).toString('binary');
};

var torrentFile = new Buffer(fs.readFileSync(__dirname + '/testdata/Ubuntu.torrent'));

var result = bencode.decode(torrentFile.toString('binary'));

var infoHash = createSHA1(bencode.encode(result.info));
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
  console.log('error: ', error);
  console.log('response: ', error);
  if (!error){
    ip = ip;
    var decodedBody = bencode.decode(body, 'binary');
    console.log(decodedBody[0].peers);
    debugger;
    console.log('body: ', bencode.decode(body, 'binary'));
  }
});