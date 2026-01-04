import type { EventHandlerPort } from "@/lib/outbox/port/inbound/event-handler-port";
import type { EventHandlerRegistryPort } from "@/lib/outbox/port/inbound/event-handler-registry-port";

export class EventHandlerRegistryAdapter implements EventHandlerRegistryPort {
  #handlers: Map<string, EventHandlerPort> = new Map();

  register(eventType: string, handler: EventHandlerPort): void {
    this.#handlers.set(eventType, handler);
  }

  getHandler(eventType: string): EventHandlerPort | undefined {
    return this.#handlers.get(eventType);
  }
}
