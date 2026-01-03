import { describe, expect, it, mock } from "bun:test";
import type { ClientSession, Collection } from "mongodb";
import type { AppContext } from "@/lib/app-context";
import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";
import type { Id } from "@/lib/id";
import type { OutboxModelMapper } from "@/lib/mapper/outbox-model-mapper";
import type { OutboxEventMongoModel } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model";
import { OutboxEventMongoRepositoryAdapter } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-repository-adapter";

describe("OutboxMongoRepositoryAdapter", () => {
  const createMockEvent = (id: string): OutboxEventMongoModel => ({
    _id: id as Id,
    aggregateId: "aggregate-123" as Id,
    eventType: "TestEvent",
    payload: { key: "value" },
    occurredAt: new Date(),
    publishedAt: null,
    status: "PENDING",
    retryCount: 0,
    lastError: null,
  });

  const createMockCollection = (insertManyFn: () => Promise<unknown>) =>
    ({
      insertMany: mock(insertManyFn),
    }) as unknown as Collection<OutboxEventMongoModel>;

  const createMockMapper = (
    models: OutboxEventMongoModel[],
  ): OutboxModelMapper<BaseEvent<BaseProps>, OutboxEventMongoModel> => ({
    fromDomain: mock(() => models[0] as OutboxEventMongoModel),
    fromDomains: mock(() => models),
  });

  const createMockContext = (session?: ClientSession): AppContext => ({
    config: {} as AppContext["config"],
    logger: {} as AppContext["logger"],
    db: { session },
  });

  describe("insertMany", () => {
    it("should return ok when events are inserted successfully", async () => {
      const events = [createMockEvent("event-1"), createMockEvent("event-2")];
      const mockCollection = createMockCollection(async () => ({
        acknowledged: true,
        insertedIds: {},
      }));
      const mockMapper = createMockMapper(events);
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mockMapper,
      );
      const ctx = createMockContext();

      const result = await repository.insertMany(ctx, events);

      expect(result.isOk()).toBe(true);
      expect(mockCollection.insertMany).toHaveBeenCalledTimes(1);
    });

    it("should return ok for empty events array", async () => {
      const mockCollection = createMockCollection(async () => ({
        acknowledged: true,
        insertedIds: {},
      }));
      const mockMapper = createMockMapper([]);
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mockMapper,
      );
      const ctx = createMockContext();

      const result = await repository.insertMany(ctx, []);

      expect(result.isOk()).toBe(true);
      expect(mockCollection.insertMany).toHaveBeenCalledTimes(0);
    });

    it("should pass session from ctx.db.session to MongoDB", async () => {
      const events = [createMockEvent("event-1")];
      const mockCollection = createMockCollection(async () => ({
        acknowledged: true,
        insertedIds: {},
      }));
      const mockMapper = createMockMapper(events);
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mockMapper,
      );
      const mockSession = {} as ClientSession;
      const ctx = createMockContext(mockSession);

      await repository.insertMany(ctx, events);

      expect(mockCollection.insertMany).toHaveBeenCalledWith(events, {
        session: mockSession,
      });
    });

    it("should pass undefined session when ctx.db.session is not set", async () => {
      const events = [createMockEvent("event-1")];
      const mockCollection = createMockCollection(async () => ({
        acknowledged: true,
        insertedIds: {},
      }));
      const mockMapper = createMockMapper(events);
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mockMapper,
      );
      const ctx = createMockContext();

      await repository.insertMany(ctx, events);

      expect(mockCollection.insertMany).toHaveBeenCalledWith(events, {
        session: undefined,
      });
    });

    it("should return error when MongoDB fails", async () => {
      const events = [createMockEvent("event-1")];
      const mockError = new Error("MongoDB connection failed");
      const mockCollection = createMockCollection(async () => {
        throw mockError;
      });
      const mockMapper = createMockMapper(events);
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mockMapper,
      );
      const ctx = createMockContext();

      const result = await repository.insertMany(ctx, events);

      expect(result.isErr()).toBe(true);
    });
  });
});
