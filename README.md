nTorrent
============

Work in progress

goal

basic bitTorrent client written in node.js that you can run from the command line

============

status

able to download files and construct them correctly on the harddrive

============

next step

construct files from pieces once pieces are downloaded

============

long term features

connection robustness (reconnecting when a connection drops, etc)

once a peer starts choking I need to stop sending piece requests, on unchoke if the peer has an assigned piece I need to resume downloading

need to have a list of completed torrents for seeding

need to be able to read files from the harddrive for seeding

implement retrieving pieces by scarcity

reconnect to peers

multiple tracker pulls

log stats at the end
(number of peers downloaded from, number of each type of message sent and received)
