import { afterEach, describe, expect, it, mock } from "bun:test";
import { err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type { Id } from "@/lib/id";
import { OutboxProcessorAdapter } from "@/lib/outbox/adapter/inbound/outbox-processor-adapter";
import { OutboxEvent } from "@/lib/outbox/domain/outbox-event";
import type { OutboxConfig } from "@/lib/outbox/outbox-config";
import type { EventHandlerPort } from "@/lib/outbox/port/inbound/event-handler-port";
import type { EventHandlerRegistryPort } from "@/lib/outbox/port/inbound/event-handler-registry-port";
import type { OutboxEventRepositoryPort } from "@/lib/outbox/port/outbound/persistence/outbox-event-repository-port";

describe("OutboxProcessorAdapter", () => {
  const createMockContext = (): AppContext => ({
    config: {} as AppContext["config"],
    logger: {
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      debug: mock(() => {}),
    } as unknown as AppContext["logger"],
    db: {},
  });

  const createMockConfig = (): OutboxConfig => ({
    pollingIntervalMs: 50,
    batchSize: 10,
    maxRetries: 3,
  });

  const createMockEvent = (id: string, eventType: string): OutboxEvent =>
    new OutboxEvent({
      id: id as Id,
      aggregateId: "agg-1" as Id,
      eventType,
      payload: {},
      occurredAt: new Date(),
      publishedAt: null,
      status: "PENDING",
      retryCount: 0,
      lastError: null,
    });

  const createMockRepository = (
    overrides: Partial<OutboxEventRepositoryPort> = {},
  ): OutboxEventRepositoryPort => ({
    insertMany: mock(async () => ok(undefined)),
    findPending: mock(async () => ok([])),
    markProcessed: mock(async () => ok(undefined)),
    markFailed: mock(async () => ok(undefined)),
    ...overrides,
  });

  const createMockRegistry = (
    getHandlerFn?: (eventType: string) => EventHandlerPort | undefined,
  ): EventHandlerRegistryPort => ({
    register: mock(() => {}),
    getHandler: mock(getHandlerFn ?? (() => undefined)),
  });

  describe("start", () => {
    it("should begin polling when started", async () => {
      const ctx = createMockContext();
      const config = createMockConfig();
      const repository = createMockRepository();
      const registry = createMockRegistry();

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      processor.start();

      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(repository.findPending).toHaveBeenCalled();

      await processor.stop();
    });

    it("should be idempotent (calling twice should not duplicate polling)", async () => {
      const ctx = createMockContext();
      const config = createMockConfig();
      const repository = createMockRepository();
      const registry = createMockRegistry();

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      processor.start();
      processor.start();

      expect(ctx.logger.warn).toHaveBeenCalled();

      await processor.stop();
    });

    it("should log info when started", async () => {
      const ctx = createMockContext();
      const config = createMockConfig();
      const repository = createMockRepository();
      const registry = createMockRegistry();

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      processor.start();

      expect(ctx.logger.info).toHaveBeenCalledWith("OutboxProcessor started");

      await processor.stop();
    });
  });

  describe("stop", () => {
    it("should stop polling and log info", async () => {
      const ctx = createMockContext();
      const config = createMockConfig();
      const repository = createMockRepository();
      const registry = createMockRegistry();

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      processor.start();
      await processor.stop();

      expect(ctx.logger.info).toHaveBeenCalledWith("OutboxProcessor stopped");
    });

    it("should not poll after stop", async () => {
      const ctx = createMockContext();
      const config = createMockConfig();
      const repository = createMockRepository();
      const registry = createMockRegistry();

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      processor.start();
      await processor.stop();

      const callCount = (repository.findPending as ReturnType<typeof mock>).mock
        .calls.length;

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(
        (repository.findPending as ReturnType<typeof mock>).mock.calls.length,
      ).toBe(callCount);
    });
  });

  describe("event processing", () => {
    it("should route events to correct handler", async () => {
      const ctx = createMockContext();
      const config = createMockConfig();
      const event = createMockEvent("evt-1", "TestEvent");
      const handler: EventHandlerPort = {
        handle: mock(async () => ok(undefined)),
      };

      let findPendingCallCount = 0;
      const repository = createMockRepository({
        findPending: mock(async () => {
          findPendingCallCount++;
          if (findPendingCallCount === 1) {
            return ok([event]);
          }
          return ok([]);
        }),
      });
      const registry = createMockRegistry((type) =>
        type === "TestEvent" ? handler : undefined,
      );

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      processor.start();
      await new Promise((resolve) => setTimeout(resolve, 80));
      await processor.stop();

      expect(handler.handle).toHaveBeenCalled();
      expect(repository.markProcessed).toHaveBeenCalledWith(ctx, event.id);
    });

    it("should mark event as processed on handler success", async () => {
      const ctx = createMockContext();
      const config = createMockConfig();
      const event = createMockEvent("evt-1", "TestEvent");
      const handler: EventHandlerPort = {
        handle: mock(async () => ok(undefined)),
      };

      let findPendingCallCount = 0;
      const repository = createMockRepository({
        findPending: mock(async () => {
          findPendingCallCount++;
          if (findPendingCallCount === 1) {
            return ok([event]);
          }
          return ok([]);
        }),
      });
      const registry = createMockRegistry(() => handler);

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      processor.start();
      await new Promise((resolve) => setTimeout(resolve, 80));
      await processor.stop();

      expect(repository.markProcessed).toHaveBeenCalledWith(ctx, event.id);
    });

    it("should mark event as failed when handler returns error", async () => {
      const ctx = createMockContext();
      const config = createMockConfig();
      const event = createMockEvent("evt-1", "TestEvent");
      const handler: EventHandlerPort = {
        handle: mock(async () => err(AppError.from("Handler failed"))),
      };

      let findPendingCallCount = 0;
      const repository = createMockRepository({
        findPending: mock(async () => {
          findPendingCallCount++;
          if (findPendingCallCount === 1) {
            return ok([event]);
          }
          return ok([]);
        }),
      });
      const registry = createMockRegistry(() => handler);

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      processor.start();
      await new Promise((resolve) => setTimeout(resolve, 80));
      await processor.stop();

      expect(repository.markFailed).toHaveBeenCalled();
    });

    it("should mark event as failed when no handler registered", async () => {
      const ctx = createMockContext();
      const config = createMockConfig();
      const event = createMockEvent("evt-1", "UnknownEvent");

      let findPendingCallCount = 0;
      const repository = createMockRepository({
        findPending: mock(async () => {
          findPendingCallCount++;
          if (findPendingCallCount === 1) {
            return ok([event]);
          }
          return ok([]);
        }),
      });
      const registry = createMockRegistry(() => undefined);

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      processor.start();
      await new Promise((resolve) => setTimeout(resolve, 80));
      await processor.stop();

      expect(ctx.logger.warn).toHaveBeenCalled();
      expect(repository.markFailed).toHaveBeenCalled();
    });

    it("should handle repository findPending error gracefully", async () => {
      const ctx = createMockContext();
      const config = createMockConfig();
      const repository = createMockRepository({
        findPending: mock(async () => err(AppError.from("DB Error"))),
      });
      const registry = createMockRegistry();

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      processor.start();
      await new Promise((resolve) => setTimeout(resolve, 80));
      await processor.stop();

      expect(ctx.logger.error).toHaveBeenCalled();
    });
  });
});
