import { describe, expect, it, mock } from "bun:test";
import { ok } from "neverthrow";
import { EventHandlerRegistryAdapter } from "@/lib/outbox/adapter/inbound/event-handler-registry-adapter";
import type { EventHandlerPort } from "@/lib/outbox/port/inbound/event-handler-port";

describe("EventHandlerRegistryAdapter", () => {
  const createMockHandler = (): EventHandlerPort => ({
    handle: mock(async () => ok(undefined)),
  });

  describe("register", () => {
    it("should store handler for event type", () => {
      const registry = new EventHandlerRegistryAdapter();
      const handler = createMockHandler();

      registry.register("TestEvent", handler);

      expect(registry.getHandler("TestEvent")).toBe(handler);
    });

    it("should overwrite existing handler for same event type", () => {
      const registry = new EventHandlerRegistryAdapter();
      const handler1 = createMockHandler();
      const handler2 = createMockHandler();

      registry.register("TestEvent", handler1);
      registry.register("TestEvent", handler2);

      expect(registry.getHandler("TestEvent")).toBe(handler2);
    });

    it("should store multiple handlers for different event types", () => {
      const registry = new EventHandlerRegistryAdapter();
      const handler1 = createMockHandler();
      const handler2 = createMockHandler();

      registry.register("EventType1", handler1);
      registry.register("EventType2", handler2);

      expect(registry.getHandler("EventType1")).toBe(handler1);
      expect(registry.getHandler("EventType2")).toBe(handler2);
    });
  });

  describe("getHandler", () => {
    it("should return handler for registered event type", () => {
      const registry = new EventHandlerRegistryAdapter();
      const handler = createMockHandler();
      registry.register("TestEvent", handler);

      const result = registry.getHandler("TestEvent");

      expect(result).toBe(handler);
    });

    it("should return undefined for unregistered event type", () => {
      const registry = new EventHandlerRegistryAdapter();

      const result = registry.getHandler("UnknownEvent");

      expect(result).toBeUndefined();
    });
  });
});
