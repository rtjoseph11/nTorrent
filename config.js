//must end in a /
exports.downloadpath = __dirname + '/downloads/';
// exports.downloadpath = '~/downloads/';

//port the client will listen on
exports.port = 6881;

//whether or not to see after you finish downloading
exports.seed = true;

//length of the handShake message
exports.handShakeLength = 68;

//default block length is 16kb
exports.blockLength = 16384;