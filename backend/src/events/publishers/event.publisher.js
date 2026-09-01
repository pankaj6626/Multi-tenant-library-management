import { EventEmitter } from 'events';
const eventBus = new EventEmitter();
const publish = (type, payload) => eventBus.emit(type, { type, payload, occurredAt: new Date() });
export { eventBus, publish };
