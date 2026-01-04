import { describe, expect, it, mock } from "bun:test";
import type { ClientSession, Collection, FindCursor, WithId } from "mongodb";
import type { AppContext } from "@/lib/app-context";
import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";
import type { Id } from "@/lib/id";
import type { OutboxEventMongoModel } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model";
import { OutboxEventMongoModelMapper } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model-mapper";
import { OutboxEventMongoRepositoryAdapter } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-repository-adapter";
import { OutboxEvent } from "@/lib/outbox/domain/outbox-event";

describe("OutboxMongoRepositoryAdapter", () => {
  const createMockDomainEvent = (id: string): BaseEvent<BaseProps> =>
    ({
      id: id as Id,
      aggregateId: "aggregate-123" as Id,
      occurredAt: new Date(),
      props: { key: "value" },
    }) as BaseEvent<BaseProps>;

  const createMockMongoModel = (
    id: string,
    overrides: Partial<OutboxEventMongoModel> = {},
  ): OutboxEventMongoModel => ({
    _id: id as Id,
    aggregateId: "aggregate-123" as Id,
    eventType: "TestEvent",
    payload: { key: "value" },
    occurredAt: new Date(),
    publishedAt: null,
    status: "PENDING",
    retryCount: 0,
    lastError: null,
    ...overrides,
  });

  const createMockContext = (session?: ClientSession): AppContext => ({
    config: {} as AppContext["config"],
    logger: {} as AppContext["logger"],
    db: { session },
  });

  describe("insertMany", () => {
    const createMockCollection = (insertManyFn: () => Promise<unknown>) =>
      ({
        insertMany: mock(insertManyFn),
      }) as unknown as Collection<OutboxEventMongoModel>;

    const createMockMapper = (models: OutboxEventMongoModel[]) => {
      const mapper = new OutboxEventMongoModelMapper();
      mapper.fromDomains = mock(() => models);
      return mapper;
    };

    it("should return ok when events are inserted successfully", async () => {
      const domainEvents = [
        createMockDomainEvent("event-1"),
        createMockDomainEvent("event-2"),
      ];
      const mongoModels = [
        createMockMongoModel("event-1"),
        createMockMongoModel("event-2"),
      ];
      const mockCollection = createMockCollection(async () => ({
        acknowledged: true,
        insertedIds: {},
      }));
      const mockMapper = createMockMapper(mongoModels);
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mockMapper,
      );
      const ctx = createMockContext();

      const result = await repository.insertMany(ctx, domainEvents);

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
      const domainEvents = [createMockDomainEvent("event-1")];
      const mongoModels = [createMockMongoModel("event-1")];
      const mockCollection = createMockCollection(async () => ({
        acknowledged: true,
        insertedIds: {},
      }));
      const mockMapper = createMockMapper(mongoModels);
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mockMapper,
      );
      const mockSession = {} as ClientSession;
      const ctx = createMockContext(mockSession);

      await repository.insertMany(ctx, domainEvents);

      expect(mockCollection.insertMany).toHaveBeenCalledWith(mongoModels, {
        session: mockSession,
      });
    });

    it("should pass undefined session when ctx.db.session is not set", async () => {
      const domainEvents = [createMockDomainEvent("event-1")];
      const mongoModels = [createMockMongoModel("event-1")];
      const mockCollection = createMockCollection(async () => ({
        acknowledged: true,
        insertedIds: {},
      }));
      const mockMapper = createMockMapper(mongoModels);
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mockMapper,
      );
      const ctx = createMockContext();

      await repository.insertMany(ctx, domainEvents);

      expect(mockCollection.insertMany).toHaveBeenCalledWith(mongoModels, {
        session: undefined,
      });
    });

    it("should return error when MongoDB fails", async () => {
      const domainEvents = [createMockDomainEvent("event-1")];
      const mongoModels = [createMockMongoModel("event-1")];
      const mockError = new Error("MongoDB connection failed");
      const mockCollection = createMockCollection(async () => {
        throw mockError;
      });
      const mockMapper = createMockMapper(mongoModels);
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mockMapper,
      );
      const ctx = createMockContext();

      const result = await repository.insertMany(ctx, domainEvents);

      expect(result.isErr()).toBe(true);
    });
  });

  describe("findPending", () => {
    const createMockFindCursor = (models: OutboxEventMongoModel[]) => {
      const cursor = {
        sort: mock(() => cursor),
        limit: mock(() => cursor),
        toArray: mock(async () => models),
      };
      return cursor as unknown as FindCursor<WithId<OutboxEventMongoModel>>;
    };

    const createMockCollection = (
      cursor: FindCursor<WithId<OutboxEventMongoModel>>,
    ) =>
      ({
        find: mock(() => cursor),
      }) as unknown as Collection<OutboxEventMongoModel>;

    it("should return pending events ordered by occurredAt", async () => {
      const mongoModels = [
        createMockMongoModel("event-1"),
        createMockMongoModel("event-2"),
      ];
      const cursor = createMockFindCursor(mongoModels);
      const mockCollection = createMockCollection(cursor);
      const mapper = new OutboxEventMongoModelMapper();
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mapper,
      );
      const ctx = createMockContext();

      const result = await repository.findPending(ctx, 10);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(2);
      expect(result._unsafeUnwrap()[0]).toBeInstanceOf(OutboxEvent);
      expect(mockCollection.find).toHaveBeenCalledWith(
        { status: "PENDING" },
        { session: undefined },
      );
      expect(cursor.sort).toHaveBeenCalledWith({ occurredAt: 1 });
    });

    it("should return empty array when no pending events", async () => {
      const cursor = createMockFindCursor([]);
      const mockCollection = createMockCollection(cursor);
      const mapper = new OutboxEventMongoModelMapper();
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mapper,
      );
      const ctx = createMockContext();

      const result = await repository.findPending(ctx, 10);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(0);
    });

    it("should respect limit parameter", async () => {
      const mongoModels = [createMockMongoModel("event-1")];
      const cursor = createMockFindCursor(mongoModels);
      const mockCollection = createMockCollection(cursor);
      const mapper = new OutboxEventMongoModelMapper();
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mapper,
      );
      const ctx = createMockContext();

      await repository.findPending(ctx, 5);

      expect(cursor.limit).toHaveBeenCalledWith(5);
    });

    it("should return error when MongoDB fails", async () => {
      const cursor = {
        sort: mock(() => cursor),
        limit: mock(() => cursor),
        toArray: mock(async () => {
          throw new Error("MongoDB failed");
        }),
      } as unknown as FindCursor<WithId<OutboxEventMongoModel>>;
      const mockCollection = createMockCollection(cursor);
      const mapper = new OutboxEventMongoModelMapper();
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mapper,
      );
      const ctx = createMockContext();

      const result = await repository.findPending(ctx, 10);

      expect(result.isErr()).toBe(true);
    });
  });

  describe("markProcessed", () => {
    const createMockCollection = (updateOneFn: () => Promise<unknown>) =>
      ({
        updateOne: mock(updateOneFn),
      }) as unknown as Collection<OutboxEventMongoModel>;

    it("should update status to PUBLISHED and set publishedAt", async () => {
      const mockCollection = createMockCollection(async () => ({
        acknowledged: true,
        modifiedCount: 1,
      }));
      const mapper = new OutboxEventMongoModelMapper();
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mapper,
      );
      const ctx = createMockContext();
      const eventId = "event-1" as Id;

      const result = await repository.markProcessed(ctx, eventId);

      expect(result.isOk()).toBe(true);
      expect(mockCollection.updateOne).toHaveBeenCalledTimes(1);
      const calls = (mockCollection.updateOne as ReturnType<typeof mock>).mock
        .calls;
      const [filter, update, options] = calls[0] as [
        unknown,
        { $set: { status: string; publishedAt: Date } },
        unknown,
      ];
      expect(filter).toEqual({ _id: eventId });
      expect(update.$set.status).toBe("PUBLISHED");
      expect(update.$set.publishedAt).toBeInstanceOf(Date);
      expect(options).toEqual({ session: undefined });
    });

    it("should return error when MongoDB fails", async () => {
      const mockCollection = createMockCollection(async () => {
        throw new Error("MongoDB failed");
      });
      const mapper = new OutboxEventMongoModelMapper();
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mapper,
      );
      const ctx = createMockContext();
      const eventId = "event-1" as Id;

      const result = await repository.markProcessed(ctx, eventId);

      expect(result.isErr()).toBe(true);
    });
  });

  describe("markFailed", () => {
    const createMockCollection = (
      findOneResult: OutboxEventMongoModel | null,
      updateOneFn?: () => Promise<unknown>,
    ) =>
      ({
        findOne: mock(async () => findOneResult),
        updateOne: mock(
          updateOneFn ??
            (async () => ({
              acknowledged: true,
              modifiedCount: 1,
            })),
        ),
      }) as unknown as Collection<OutboxEventMongoModel>;

    it("should increment retryCount and set lastError", async () => {
      const mongoModel = createMockMongoModel("event-1", { retryCount: 0 });
      const mockCollection = createMockCollection(mongoModel);
      const mapper = new OutboxEventMongoModelMapper();
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mapper,
      );
      const ctx = createMockContext();
      const eventId = "event-1" as Id;

      const result = await repository.markFailed(
        ctx,
        eventId,
        "Handler failed",
        3,
      );

      expect(result.isOk()).toBe(true);
      const calls = (mockCollection.updateOne as ReturnType<typeof mock>).mock
        .calls;
      const [filter, update] = calls[0] as [
        unknown,
        { $set: { retryCount: number; lastError: string; status: string } },
      ];
      expect(filter).toEqual({ _id: eventId });
      expect(update.$set.retryCount).toBe(1);
      expect(update.$set.lastError).toBe("Handler failed");
      expect(update.$set.status).toBe("PENDING");
    });

    it("should set status to FAILED when retryCount reaches maxRetries", async () => {
      const mongoModel = createMockMongoModel("event-1", { retryCount: 2 });
      const mockCollection = createMockCollection(mongoModel);
      const mapper = new OutboxEventMongoModelMapper();
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mapper,
      );
      const ctx = createMockContext();
      const eventId = "event-1" as Id;

      const result = await repository.markFailed(
        ctx,
        eventId,
        "Handler failed",
        3,
      );

      expect(result.isOk()).toBe(true);
      const calls = (mockCollection.updateOne as ReturnType<typeof mock>).mock
        .calls;
      const [, update] = calls[0] as [
        unknown,
        { $set: { retryCount: number; status: string } },
      ];
      expect(update.$set.retryCount).toBe(3);
      expect(update.$set.status).toBe("FAILED");
    });

    it("should return error when event not found", async () => {
      const mockCollection = createMockCollection(null);
      const mapper = new OutboxEventMongoModelMapper();
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mapper,
      );
      const ctx = createMockContext();
      const eventId = "event-1" as Id;

      const result = await repository.markFailed(
        ctx,
        eventId,
        "Handler failed",
        3,
      );

      expect(result.isErr()).toBe(true);
    });

    it("should return error when MongoDB updateOne fails", async () => {
      const mongoModel = createMockMongoModel("event-1");
      const mockCollection = createMockCollection(mongoModel, async () => {
        throw new Error("MongoDB failed");
      });
      const mapper = new OutboxEventMongoModelMapper();
      const repository = new OutboxEventMongoRepositoryAdapter(
        mockCollection,
        mapper,
      );
      const ctx = createMockContext();
      const eventId = "event-1" as Id;

      const result = await repository.markFailed(
        ctx,
        eventId,
        "Handler failed",
        3,
      );

      expect(result.isErr()).toBe(true);
    });
  });
});
