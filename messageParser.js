//move queue and events into its own file;
var messages = require('./messages');

var Queue = require('./queue');

exports.Parser = function(connection){
  var self = this;
  self.connection = connection;
  // self.queue = new Queue();
  // self.queue.on('enqueueBuffer', function(){
  //   self.consume();
  // });
};

exports.Parser.prototype.enqueue = function(buffer){
  // this.queue.add(buffer);
  this.consume(buffer);
};

exports.Parser.prototype.consume = function(buffer){
  if (this.connection.hasHandshake){
    //deal with non handshake messages
  } else {
    if (this.partialMessage){
      //deal with writing into the partial message
      if (this.partialMessage.currentLength + buffer.length === 68){
        buffer.copy(this.partialMessage.data, this.partialMessage.currentLength, 0);
        this.partialMessage.currentLength += buffer.length;
        if (this.partialMessage.currentLength > 68){
          throw new Error('tried to pass too many bytes into the partial message');
        }
        messages.consumeHandshake(this.partialMessage.data, this.connection);
        this.partialMessage = undefined;
      } else if (this.partialMessage.currentLength + buffer.length > 68){
        var used = this.partialMessage.data.length - this.partialMessage.currentLength;
        buffer.copy(this.partialMessage.data, this.partialMessage.currentLength, 0, used);
        this.currentLength += used;
        if (this.partialMessage.currentLength > 68){
          throw new Error('tried to pass too many bytes into the partial message');
        }
        messages.consumeHandshake(this.partialMessage.data.length, this.connection);
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
        messages.consumeHandshake(buffer, connection);
      } else if (buffer.length > 68){
        messages.consumeHandshake(buffer.slice(0,68), this.connection);
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