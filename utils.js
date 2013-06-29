var request = require('request'),
    bencode,
    Peer,
    peers,
    utils = {};

utils.HTTPTrackerRequest = function(uri, torrentFinished){
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

utils.getHTTPTrackers = function(torrent, pieceField, infoHash, port, clientID){
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
  return uris;
};

module.exports = function(_Peer, _bencode, _peers){
  bencode = _bencode;
  Peer = _Peer;
  peers = _peers;
  return utils;
};