//use a config file for constants like sha1 piece length and ip address buffers;
//use a config file for console logs
var fs = require('fs');
if (! fs.existsSync(__dirname + '/' + process.argv[2])){
  throw new Error('torrent file ' + process.argv[2] + " doesn't exist!");
}

var bencode = require('bencode'),
    crypto = require('crypto'),
    Peers = require('./peers'),
    net = require('net'),
    config = require('./config');
    port = config.port,
    torrent = bencode.decode(fs.readFileSync(__dirname + '/' + process.argv[2])),
    infoHash = crypto.createHash('sha1').update(bencode.encode(torrent.info)).digest(),
    peers = new Peers(),
    PieceField = require('./pieceField')(peers),
    pieceField = new PieceField(torrent.info),
    torrentFinished = pieceField.isFinished(),
    messages = require('./messages'),
    clientID = '-NT0000-' + Date.now().toString().substring(Date.now().toString().length - 12,Date.now().toString().length),
    Peer = require('./peer')(infoHash, clientID, messages, pieceField, peers),
    reconnect = setInterval(peers.connect, 60000),
    start = new Date(),
    utils = require('./utils')(Peer, bencode, peers),
    uris = utils.getHTTPTrackers(torrent, pieceField, infoHash, port, clientID);

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
  peers.add(unsolicitedPeer, buf);
});
client.listen(port, function(){
  console.log('client bound to port ', port);
});

var delayedRequest = function(uri, delay){
  setTimeout(function(){
    utils.HTTPTrackerRequest(uris[i], torrentFinished);
  }, delay);
};

if(!torrentFinished){
  for (var i = 0; i < uris.length; i++){
    console.log('requesting peers from ', uris[i]);
    utils.HTTPTrackerRequest(uris[i], torrentFinished);
    if (!torrentFinished && peers.numConnected() < 500){
      console.log('requesting peers in 60 seoncds');
      delayedRequest(uris[i], 60000);
    }
  }
}

pieceField.on('torrentFinished', function(){
  torrentFinished = true;
  clearInterval(reconnect);
});

pieceField.on('torrentFinished', function(){
  console.log('torrent took ', ((new Date()) - start) / 60000 , ' minutes to download!');
  if(!config.seed){
    process.exit();
  }
});
