nTorrent
============

how to use

npm install ntorrent -g

ntorrent config -d pathToYourDownloadsFolder

ntorrent pathToTorrentFile

commands:

ntorrent config -d [your download path (filepath string)] -p [port to listen on (int)] -s [seed (true | false)]
  this will override the download path, port the client listens on, and whether or not to seed

ntorrent torrentfilepath
  start a torrent based on the torrent file specified at torrentfilepath

============
status

developed using node .10.10

does not work with node .8 because the crypto module does not return buffers after digest()

UDP trackers are not supported!  make sure you pick a torrentfile which has an http tracker.
