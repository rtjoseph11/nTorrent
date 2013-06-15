var messages = require('./messages');

exports.Parser = function(peer, infoHash){
  this.peer = peer;
  this.infoHash = infoHash;
};

exports.Parser.prototype.consume = function(buffer){
  var used;
  if (this.peer.hasHandshake){
    if (this.partialMessage){
      if (buffer.length + this.partialMessage.currentLength < this.partialMessage.data.length){
        buffer.copy(this.partialMessage.data, this.partialMessage.currentLength);
        this.partialMessage.currentLength += buffer.length;
      } else {
        used = this.partialMessage.data.length - this.partialMessage.currentLength;
        buffer.copy(this.partialMessage.data, this.partialMessage.currentLength, 0, used);
        this.partialMessage.currentLength += used;
        messages.consumeMessage(this.partialMessage, this.peer);
        if (used < buffer.length){
          this.consume(buffer.slice(used));
        }
      }
    } else {
      if (this.partialLength){
        if (buffer.length + this.partialLength.currentLength < 4){
          buffer.copy(this.partialLength.data, this.partialLength.currentLength);
          this.partialLength.currentLength += buffer.length;
        } else {
          used = 4 - this.partialLength.currentLength;
          buffer.copy(this.partialLength.data, this.partialLength.currentLength, 0, used);
          this.partialMessage = {
            data: new Buffer(this.partialLength.data.readUInt32BE(0)),
            currentLength: 0
          };
          this.partialLength = undefined;
          if (used < buffer.length){
            this.consume(buffer.slice(used));
          }
        }
      } else {
        if (buffer.length < 4){
          this.partialLength = {
            data: new Buffer(4),
            currentLength: buffer.length
          };
          buffer.copy(this.partialLength.data);
        }
        else if (buffer.length === 4){
          //message lengths are 4 byte Big Endian values
          this.partialMessage = {
            data: new Buffer(buffer.readUInt32BE(0)),
            currentLength: 0
          };
          if (this.partialMessage.data.length === this.partialMessage.currentLength){
            //keep alive message
            messages.consumeMessage(this.partialMessage, this.peer);
            this.partialMessage = undefined;
          }
        }
        else {
          this.partialMessage = {
            data: new Buffer(buffer.readUInt32BE(0)),
            currentLength: 0
          };
          buffer.copy(this.partialMessage.data, this.partialMessage.currentLength, 4, 4 + this.partialMessage.data.length);
          if (buffer.length - 4 > this.partialMessage.data.length){
            used = this.partialMessage.data.length;
            this.partialMessage.currentLength = this.partialMessage.data.length;
            messages.consumeMessage(this.partialMessage, this.peer);
            this.partialMessage = undefined;
            this.consume(buffer.slice(4 + used));
          } else {
            this.partialMessage.currentLength = buffer.length - 4;
          }
        }
      }
    }
  } else {
    if (this.partialMessage){
      //deal with writing into the partial message
      if (this.partialMessage.currentLength + buffer.length === 68){
        buffer.copy(this.partialMessage.data, this.partialMessage.currentLength, 0);
        this.partialMessage.currentLength += buffer.length;
        if (this.partialMessage.currentLength > 68){
          throw new Error('tried to pass too many bytes into the partial message');
        }
        messages.consumeHandshake(this.partialMessage.data, this.infoHash, this.peer);
        this.partialMessage = undefined;
      } else if (this.partialMessage.currentLength + buffer.length > 68){
        used = this.partialMessage.data.length - this.partialMessage.currentLength;
        buffer.copy(this.partialMessage.data, this.partialMessage.currentLength, 0, used);
        this.currentLength += used;
        if (this.partialMessage.currentLength > 68){
          throw new Error('tried to pass too many bytes into the partial message');
        }
        messages.consumeHandshake(this.partialMessage.data, this.infoHash, this.peer);
        this.partialMessage = undefined;
        this.consume(buffer.slice(used));
      } else {
        //buffer + current length < 68
        buffer.copy(this.partialMessage.data, this.partialMessage.currentLength, 0);
        this.partialMessage.currentLength += buffer.length;
      }
    } else {
      //hardcoding to 68 bytes since that matches the handshake I am sending out.. need to generalize
      if (buffer.length === 68){
        messages.consumeHandshake(buffer, this.infoHash, this.peer);
      } else if (buffer.length > 68){
        messages.consumeHandshake(buffer.slice(0,68), this.infoHash, this.peer);
        this.consume(buffer.slice(68));
      } else {
        //buffer has less than 68 bytes
        this.partialMessage = {
          currentLength: 0,
          data: new Buffer(68)
        };
        buffer.copy(this.partialMessage.data, this.partialMessage.currentLength, 0);
        this.partialMessage.currentLength += buffer.length;
      }
    }
  }
};