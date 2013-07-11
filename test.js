var fs = require('fs');
if (! fs.existsSync(__dirname + '/testdata/test.torrent')){
  throw new Error("torrent file doesn't exist!");
}

if (! process.argv[2] || isNaN(process.argv[2]) || !process.argv[3]){
  throw new Error('need to provide a port to listen on and indicate seed status');
}

var bencode = require('bencode'),
    crypto = require('crypto'),
    Peers = require('./peers'),
    net = require('net'),
    port = process.argv[2],
    torrent = bencode.decode(fs.readFileSync(__dirname + '/testdata/test.torrent')),
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


var buf = new Buffer(6);
buf.writeUInt8(10, 0);
buf.writeUInt8(0, 1);
buf.writeUInt8(1, 2);
buf.writeUInt8(93, 3);
buf.writeUInt16BE(process.argv[process.argv.length - 1], 4);
var sandboxPeer = new Peer(buf);
peers.add(sandboxPeer, buf);

pieceField.on('torrentFinished', function(){
  torrentFinished = true;
  clearInterval(reconnect);
});

pieceField.on('torrentFinished', function(){
  console.log('torrent took ', ((new Date()) - start) / 60000 , ' minutes to download!');
  if(process.argv[4] !== 'seed'){
    process.exit();
  }
});

