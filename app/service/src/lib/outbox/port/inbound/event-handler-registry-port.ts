import type { EventHandlerPort } from "@/lib/outbox/port/inbound/event-handler-port";

export interface EventHandlerRegistryPort {
  register(eventType: string, handler: EventHandlerPort): void;
  getHandler(eventType: string): EventHandlerPort | undefined;
}
