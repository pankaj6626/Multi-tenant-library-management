const { EventEmitter } = require('events');
const eventBus = new EventEmitter();
const publish = (type, payload) => eventBus.emit(type, { type, payload, occurredAt: new Date() });
module.exports = { eventBus, publish };
