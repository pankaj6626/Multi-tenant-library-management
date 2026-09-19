import { eventBus } from '../publishers/event.publisher.js';
import events from '../event-types/domain-events.js';
Object.values(events).forEach((type) => eventBus.on(type, (event) => console.info(`[event] ${event.type}`, event.payload)));
