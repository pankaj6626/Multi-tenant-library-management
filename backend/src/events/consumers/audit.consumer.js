const { eventBus } = require('../publishers/event.publisher');
const events = require('../event-types/domain-events');
Object.values(events).forEach((type) => eventBus.on(type, (event) => console.info(`[event] ${event.type}`, event.payload)));
