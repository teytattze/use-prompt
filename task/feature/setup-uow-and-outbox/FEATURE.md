# Goal

Implement the Unit of Work (UoW) and Outbox patterns to enable reliable domain event persistence and communication between aggregates within the same bounded context.

# Background

The current architecture follows hexagonal (ports & adapters) design with:

- Domain aggregates that generate events (e.g., `PromptAggregate` creates `PromptCreatedEvent`)
- Events stored in-memory via `BaseAggregate.addEvent()` but never persisted
- No transaction coordination across aggregate + event persistence
- No mechanism to publish events to other parts of the system

This creates a reliability gap: if the application crashes after saving an aggregate but before publishing its events, those events are lost forever.

# Problem

1. **Lost Events**: Domain events are generated but never persisted or published
2. **No Atomicity**: Aggregate persistence and event storage are not atomic
3. **No Event Retrieval**: `BaseAggregate.#events` is private with no accessor method
4. **No Cross-Aggregate Communication**: No infrastructure for aggregates to react to each other's events

# Solution

Implement Unit of Work + Outbox pattern:

1. **Unit of Work**: Coordinates persistence of aggregates and their events in a single MongoDB transaction
2. **Outbox Table**: Stores domain events as documents in MongoDB for reliable delivery
3. **Event Publisher**: Background process that reads from outbox and publishes events (future scope)

# Proposal

## Phase 1: Core Infrastructure

### 1.1 Extend `BaseAggregate` to expose events

Add a method to retrieve and clear events from aggregates:

```typescript
// lib/domain/base-aggregate.ts
pullEvents(): BaseEvent<BaseProps>[] {
  const events = [...this.#events];
  this.#events = [];
  return events;
}
```

### 1.2 Create Outbox Event Model

```typescript
// lib/outbox/outbox-event-model.ts
interface OutboxEventModel extends BaseMongoModel {
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  publishedAt: Date | null;
  status: "pending" | "published" | "failed";
}
```

### 1.3 Create Outbox Repository Port & Adapter

```typescript
// lib/outbox/port/outbox-repository-port.ts
interface OutboxRepositoryPort {
  insertMany(events: OutboxEventModel[]): Promise<Result<void, AppError>>;
}

// lib/outbox/adapter/outbox-mongo-repository-adapter.ts
class OutboxMongoRepositoryAdapter implements OutboxRepositoryPort { ... }
```

### 1.4 Create Unit of Work Port & Adapter

```typescript
// lib/unit-of-work/port/unit-of-work-port.ts
interface UnitOfWorkPort {
  execute<T>(
    work: (session: ClientSession) => Promise<Result<T, AppError>>,
  ): Promise<Result<T, AppError>>;
}

// lib/unit-of-work/adapter/mongo-unit-of-work-adapter.ts
class MongoUnitOfWorkAdapter implements UnitOfWorkPort {
  async execute<T>(work): Promise<Result<T, AppError>> {
    const session = client.startSession();
    try {
      session.startTransaction();
      const result = await work(session);
      if (result.isOk()) {
        await session.commitTransaction();
      } else {
        await session.abortTransaction();
      }
      return result;
    } finally {
      await session.endSession();
    }
  }
}
```

### 1.5 Create Domain Event Mapper

```typescript
// lib/outbox/mapper/outbox-event-mapper.ts
class OutboxEventMapper {
  static toModel(event: BaseEvent<BaseProps>): OutboxEventModel { ... }
}
```

## Phase 2: Integration with Use Cases

### 2.1 Update Repository Ports to Accept Session

```typescript
// module/prompt/port/outbound/persistence/prompt-repository-port.ts
interface PromptRepositoryPort {
  insertOne(
    aggregate: PromptAggregate,
    session?: ClientSession,
  ): Promise<Result<void, AppError>>;
}
```

### 2.2 Create Transactional Use Case Pattern

Update use cases to:

1. Inject `UnitOfWorkPort` and `OutboxRepositoryPort`
2. Wrap operations in `unitOfWork.execute()`
3. Pull events from aggregate and persist to outbox within same transaction

Example for `CreatePromptUseCaseAdapter`:

```typescript
async execute(ctx, input): Promise<Result<Output, AppError>> {
  return this.unitOfWork.execute(async (session) => {
    const aggregate = PromptAggregate.new(input.title, input.body);

    // Save aggregate
    const saveResult = await this.repository.insertOne(aggregate, session);
    if (saveResult.isErr()) return saveResult;

    // Pull and persist events to outbox
    const events = aggregate.pullEvents();
    const outboxModels = events.map(OutboxEventMapper.toModel);
    const eventResult = await this.outboxRepository.insertMany(outboxModels, session);
    if (eventResult.isErr()) return eventResult;

    return ok(PromptUseCaseDtoMapper.toDto(aggregate));
  });
}
```

## Phase 3: Event Publishing (Future Scope)

- Background worker to poll outbox table
- Mark events as published after successful delivery
- Retry logic for failed events
- Dead letter queue for permanently failed events

# File Structure

```
app/service/src/lib/
├── domain/
│   └── base-aggregate.ts          # Add pullEvents() method
├── outbox/
│   ├── outbox-event-model.ts
│   ├── outbox-event-mapper.ts
│   ├── port/
│   │   └── outbox-repository-port.ts
│   └── adapter/
│       └── outbox-mongo-repository-adapter.ts
└── unit-of-work/
    ├── port/
    │   └── unit-of-work-port.ts
    └── adapter/
        └── mongo-unit-of-work-adapter.ts
```

# Acceptance Criteria

## Phase 1: Core Infrastructure

- [ ] `BaseAggregate.pullEvents()` returns all events and clears internal array
- [ ] `OutboxEventModel` schema is defined with required fields
- [ ] `OutboxRepositoryPort` interface is created
- [ ] `OutboxMongoRepositoryAdapter` can insert events to `outbox_events` collection
- [ ] `UnitOfWorkPort` interface is created
- [ ] `MongoUnitOfWorkAdapter` wraps operations in MongoDB transactions
- [ ] Unit tests exist for `OutboxMongoRepositoryAdapter`
- [ ] Unit tests exist for `MongoUnitOfWorkAdapter`

## Phase 2: Integration

- [ ] `PromptRepositoryPort.insertOne()` accepts optional `ClientSession`
- [ ] `CreatePromptUseCaseAdapter` uses Unit of Work to persist aggregate + events atomically
- [ ] Integration test verifies aggregate and events are saved in same transaction
- [ ] Integration test verifies rollback on failure (neither aggregate nor events saved)

## Non-Functional Requirements

- [ ] MongoDB replica set is configured (required for transactions)
- [ ] Transaction timeout is configurable via `AppConfig`
- [ ] Outbox collection has index on `status` and `occurredAt` for efficient polling
