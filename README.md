nTorrent
============

simple version working

goal

basic bitTorrent client written in node.js that you can run from the command line

============

status

able to download files as well as seed files.

only able to make requests to http trackers, some of which the client works with and some which don't.
I've been testing using the fedora tracker.

developed using node .10.10
does not work with node .8 because the crypto module does not return buffers after digest()

============

how to use

after cloning the repo, from the command line

node client.js /path/to/torrentFile [port you want to listen on] [seed/noseed]

the files will be downloaded to the /downloads directory which is in the same directory as client.js


============

next step

generate peerID instead of hardcoding

============

long term features

write tests

time piece requests out after 2 minutes and request from another peer

remove pieces from memory once they are completed, read from fs when requested

requests each piece from multiple peers instead of just one

implement retrieving pieces by scarcity

connect to multiple trackers

implemente udp tracker requests

log stats at the end
(number of peers downloaded from, number of each type of message sent and received)

need to have a list of completed torrents for seeding
