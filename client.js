//use commas when creating variables at the beginning
var bencode = require('bencode'),
    fs = require('fs');
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
//create a utils.js
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
var checkForPiece = function(){
  pieceField.checkForPiece();
};
//pass pieceField into the peer file and do the peer bindings function in there
var Peer = require('./peer')(infoHash, clientID, messages, pieceField.length());
var peers = new Peers();
var reconnect = setInterval(peers.connect, 60000);
pieceField.on('pieceFinished', checkForPiece);
pieceField.on('pieceFinished', peers.broadcastPiece);
pieceField.on('torrentFinished', peers.disconnect);
pieceField.on('torrentFinished', function(){
  torrentFinished = true;
  clearInterval(reconnect);
});
pieceField.on('cancelBlock', peers.cancelBlock);

var torrentFinished = pieceField.isFinished();

var peerBindings = function(peer){
  peer.on('bitField', pieceField.registerPeer);
  peer.on('receivedHandshake', function(p){
    if (!p.sentHandshake){
      p.sendHandshake();
      p.sendBitField(pieceField.bitField());
    }
  });
  peer.on('available', checkForPiece);
  peer.on('blockRelease', pieceField.releaseBlock);
  peer.on('hasPiece', pieceField.registerPeerPiece);
  peer.on('disconnect', pieceField.unregisterPeer);
  peer.on('disconnect', peers.decrementConnected);
  peer.on('connected', peers.incrementConnected);
  peer.on('blockRequest', pieceField.sendBlock);
  peer.on('blockComplete', pieceField.writeBlock);
};

var start = new Date();
//move sandbox mode into the testing file
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
  var uris = [];
  if(torrent.announce.toString('binary').substring(0,4) === 'http'){
    uris.push(torrent.announce.toString('binary') + '?');
  }
  if (torrent['announce-list']){
    for (var x = 0; x < torrent['announce-list'].length; x++){
      if (torrent['announce-list'][x][0].toString('binary').substring(0,4) === 'http'){
        uris.push(torrent['announce-list'][x][0].toString('binary') + '?');
      }
    }
  }
  if (uris.length === 0){
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
  for (var i = 0; i < uris.length; i++){
    for (var key in query){
      uris[i] += key + "=" + query[key] + "&";
    }
  }
  //use a config file for constants like sha1 piece length and ip address buffers;
  //use a config file for console logs
  var trackerRequest = function(uri){
    request({
      uri: uri,
      encoding: null
    }, function(error, response, body){
      if (!error){
        var bodyObj = bencode.decode(body);
        if (!bodyObj['failure reason'] && bodyObj['peers']){
          if (!torrentFinished && peers.numConnected() < 500){
            console.log('requesting peers in 60 seoncds');
            setTimeout(function(){trackerRequest(uri);}, 60000);
          }
          for (var i = 0; i < bodyObj.peers.length; i += 6){
            if (! peers.hasPeer(bodyObj.peers.slice(i, i + 6))){
              var peer = new Peer(bodyObj.peers.slice(i, i + 6));
              peerBindings(peer);
              peers.add(peer, bodyObj.peers.slice(i, i + 6));
            }
          }
        } else if (bodyObj['failure reason']){
          console.log(bodyObj['failure reason'].toString());
        } else {
          console.log('did not get a valid tracker response');
        }
      }
      else {
        console.log(error);
        console.log(response);
      }
    });
  };
  if(!torrentFinished){
    for (var i = 0; i < uris.length; i++){
      console.log('requesting peers from ', uris[i]);
      trackerRequest(uris[i]);
    }
  }
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
if (process.argv[4] !== 'seed'){
  pieceField.on('torrentFinished', function(){
    console.log('torrent took ', ((new Date()) - start) / 60000 , ' minutes to download!');
    process.exit();
  });
} else {
  pieceField.on('torrentFinished', function(){
    console.log('torrent took ', ((new Date()) - start) / 60000 , ' minutes to download!');
  });
}