//use a config file for constants like sha1 piece length and ip address buffers;
//use a config file for console logs
var fs = require('fs'),
    bencode = require('bencode'),
    crypto = require('crypto'),
    net = require('net'),
    config = require('./config');
    port = config.port,
    messages = require('./messages'),
    clientID = '-NT0000-' + Date.now().toString().substring(Date.now().toString().length - 12,Date.now().toString().length);

var torrent,
    infoHash,
    peers,
    pieceField,
    torrentFinished,
    Peer;

//this handles unsolicted peers
var handlePeer = function(connection){
  console.log('unsolicted peer connected!');
  var buf = new Buffer(6);
  var ip = connection.remoteAddress.split('.');
  buf.writeUInt8(Number(ip[0]), 0);
  buf.writeUInt8(Number(ip[1]), 1);
  buf.writeUInt8(Number(ip[2]), 2);
  buf.writeUInt8(Number(ip[3]), 3);
  buf.writeUInt16BE(connection.remotePort, 4);
  var unsolicitedPeer = new Peer(buf, connection);
  peers.add(unsolicitedPeer, buf);
};


var delayedRequest = function(uri, delay){
  setTimeout(function(){
    utils.HTTPTrackerRequest(uris[i], torrentFinished);
  }, delay);
};

rootInit = function(torrentPath){
  if (! fs.existsSync(torrentPath)){
    throw new Error('torrent file ' + torrentPath + " doesn't exist!");
  }

  torrent = bencode.decode(fs.readFileSync(torrentPath)),
  infoHash = crypto.createHash('sha1').update(bencode.encode(torrent.info)).digest(),
  Peers = require('./peers'),
  peers = new Peers(),
  PieceField = require('./pieceField')(peers),
  pieceField = new PieceField(torrent.info),
  torrentFinished = pieceField.isFinished(),
  Peer = require('./peer')(infoHash, clientID, messages, pieceField, peers),
  start = new Date();

  var client = net.createServer(handlePeer);
  client.listen(port, function(){
    console.log('client bound to port ', port);
  });

  pieceField.on('torrentFinished', function(){
    console.log('torrent took ', ((new Date()) - start) / 60000 , ' minutes to download!');
    if(!config.seed){
      process.exit();
    }
  });
};

exports.init = function(torrentPath){
  rootInit(torrentPath);

  var utils = require('./utils')(Peer, bencode, peers),
      uris = utils.getHTTPTrackers(torrent, pieceField, infoHash, port, clientID),
      reconnect = setInterval(peers.connect, 60000);

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
};

exports.testInit = function(torrentPath, ipAddress, port){
  rootInit(torrentPath);
  var buf = new Buffer(6);
  buf.writeUInt8(ipAddress[0], 0);
  buf.writeUInt8(ipAddress[1], 1);
  buf.writeUInt8(ipAddress[2], 2);
  buf.writeUInt8(ipAddress[3], 3);
  buf.writeUInt16BE(port, 4);
  var sandboxPeer = new Peer(buf);
  peers.add(sandboxPeer, buf);
};
