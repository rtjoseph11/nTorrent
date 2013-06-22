nTorrent
============

goal

basic bitTorrent client written in node.js that you can run from the command line

============

status

able to download as well as seed files.

only able to make requests to http trackers, some of which the client works with and some which don't.
I've been testing using the fedora tracker.

developed using node .10.10
does not work with node .8 because the crypto module does not return buffers after digest()

============

how to use

after cloning the repo run npm install, then
from the command line:
node client.js /path/to/torrentFile [port you want to listen on] [seed/noseed]
example: node client.js ./testdata/linuxmint.torrent 6881 seed

the files will be downloaded to the /downloads directory which is in the same directory as client.js


============

next step

when reading from disk for sending blocks, do so asynchronously

============

long term features

write tests

implement retrieving pieces by scarcity

implement udp tracker requests

log stats at the end
(number of peers downloaded from, number of each type of message sent and received)
