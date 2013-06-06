var events = require('events');

var Item = function(value){
  this.next = null;
  this.value = value;
};

module.exports = function(){
  events.EventEmitter.call(this);
  this.head = null;
  this.tail = null;
};

module.exports.prototype.add = function(value){
  var item = new Item(value);
  this.head = item;
  if (!this.tail){
    this.tail = item;
  }
  this.emit('enqueueBuffer');
};

module.exports.prototype.remove = function(){
  var result = this.head.value;
  this.head = this.head.next;
  if (!this.head){
    this.tail = null;
  }
  this.emit('dequeueBuffer');
  return result;
};