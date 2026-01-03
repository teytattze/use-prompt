# Goal

Implement a Change Stream-based Outbox Processor to consume domain events from the outbox table and dispatch them to registered event handlers for processing within the same bounded context.

# Background

The Unit of Work + Outbox pattern (Phase 1 & 2) ensures domain events are persisted atomically with aggregate state. However, persisted events remain unprocessed in the `outbox_events` collection until a background processor consumes them.

Current state after UoW/Outbox implementation:

- Domain events are stored in `outbox_events` collection with `status: "pending"`
- Events have `aggregateId`, `eventType`, `payload`, `occurredAt` fields
- No mechanism exists to read and process these events
- No event handler infrastructure for reacting to domain events

# Problem

1. **Unprocessed Events**: Events accumulate in outbox but are never consumed
2. **No Event Handlers**: No infrastructure to register and invoke handlers per event type
3. **No Delivery Guarantees**: No retry logic or failure tracking for event processing
4. **No Cross-Aggregate Reactions**: Aggregates cannot react to each other's events

# Solution

Implement a Change Stream-based processor that:

1. **Watches** the outbox collection for new inserts using MongoDB Change Streams
2. **Routes** events to registered handlers based on `eventType`
3. **Updates** event status to `published` or `failed` after processing
4. **Resumes** from last position after restarts using resume tokens

# Proposal

## Phase 1: Event Handler Infrastructure

### 1.1 Create Event Handler Port

```typescript
// lib/outbox/port/event-handler-port.ts
interface EventHandlerPort<T extends BaseProps = BaseProps> {
  eventType: string;
  handle(
    ctx: AppContext,
    event: OutboxEventModel<T>,
  ): Promise<Result<void, AppError>>;
}
```

### 1.2 Create Event Handler Registry

```typescript
// lib/outbox/event-handler-registry.ts
class EventHandlerRegistry {
  #handlers: Map<string, EventHandlerPort[]> = new Map();

  register(handler: EventHandlerPort): void {
    const existing = this.#handlers.get(handler.eventType) ?? [];
    this.#handlers.set(handler.eventType, [...existing, handler]);
  }

  getHandlers(eventType: string): EventHandlerPort[] {
    return this.#handlers.get(eventType) ?? [];
  }
}
```

## Phase 2: Change Stream Processor

### 2.1 Create Processor Configuration

```typescript
// lib/outbox/processor/outbox-processor-config.ts
interface OutboxProcessorConfig {
  resumeTokenCollection: string; // Collection to persist resume tokens
  maxRetries: number; // Max retry attempts per event (e.g., 3)
  retryDelayMs: number; // Delay between retries (e.g., 1000)
  batchSize: number; // Concurrent event processing limit (e.g., 10)
}
```

### 2.2 Create Resume Token Repository

```typescript
// lib/outbox/port/resume-token-repository-port.ts
interface ResumeTokenRepositoryPort {
  get(): Promise<Result<ResumeToken | null, AppError>>;
  save(token: ResumeToken): Promise<Result<void, AppError>>;
}

// lib/outbox/adapter/resume-token-mongo-repository-adapter.ts
class ResumeTokenMongoRepositoryAdapter implements ResumeTokenRepositoryPort {
  // Stores resume token in dedicated collection for crash recovery
}
```

### 2.3 Create Change Stream Processor

```typescript
// lib/outbox/processor/outbox-processor.ts
class OutboxProcessor {
  #stream: ChangeStream | null = null;
  #isRunning: boolean = false;

  constructor(
    private readonly config: OutboxProcessorConfig,
    private readonly registry: EventHandlerRegistry,
    private readonly outboxRepository: OutboxRepositoryPort,
    private readonly resumeTokenRepository: ResumeTokenRepositoryPort,
    private readonly logger: AppLogger,
  ) {}

  async start(): Promise<Result<void, AppError>> {
    const tokenResult = await this.resumeTokenRepository.get();
    if (tokenResult.isErr()) return tokenResult;

    const pipeline = [{ $match: { operationType: "insert" } }];
    const options = {
      resumeAfter: tokenResult.value,
      fullDocument: "updateLookup",
    };

    this.#stream = collection.watch(pipeline, options);
    this.#isRunning = true;

    for await (const change of this.#stream) {
      if (!this.#isRunning) break;

      const event = change.fullDocument as OutboxEventModel;
      await this.processEvent(event);
      await this.resumeTokenRepository.save(change._id);
    }

    return ok(undefined);
  }

  async stop(): Promise<void> {
    this.#isRunning = false;
    await this.#stream?.close();
  }

  private async processEvent(event: OutboxEventModel): Promise<void> {
    const handlers = this.registry.getHandlers(event.eventType);

    if (handlers.length === 0) {
      this.logger.warn(
        { eventType: event.eventType },
        "No handlers registered",
      );
      await this.outboxRepository.markAsPublished(event._id);
      return;
    }

    for (const handler of handlers) {
      const result = await this.executeWithRetry(handler, event);
      if (result.isErr()) {
        await this.outboxRepository.markAsFailed(event._id, result.error);
        return;
      }
    }

    await this.outboxRepository.markAsPublished(event._id);
  }

  private async executeWithRetry(
    handler: EventHandlerPort,
    event: OutboxEventModel,
  ): Promise<Result<void, AppError>> {
    let lastError: AppError | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const result = await handler.handle(this.ctx, event);
      if (result.isOk()) return result;

      lastError = result.error;
      this.logger.warn(
        { eventId: event._id, attempt, error: lastError },
        "Handler failed, retrying",
      );

      await sleep(this.config.retryDelayMs * attempt);
    }

    return err(lastError!);
  }
}
```

## Phase 3: Outbox Repository Extensions

### 3.1 Extend Outbox Repository Port

```typescript
// lib/outbox/port/outbox-repository-port.ts
interface OutboxRepositoryPort {
  insertMany(
    events: OutboxEventModel[],
    session?: ClientSession,
  ): Promise<Result<void, AppError>>;

  // New methods for processor
  markAsPublished(eventId: Id): Promise<Result<void, AppError>>;
  markAsFailed(eventId: Id, error: AppError): Promise<Result<void, AppError>>;
  findPendingEvents(
    limit: number,
  ): Promise<Result<OutboxEventModel[], AppError>>;
}
```

### 3.2 Update Outbox Event Model

```typescript
// lib/outbox/outbox-event-model.ts
interface OutboxEventModel extends BaseMongoModel {
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  publishedAt: Date | null;
  status: "pending" | "published" | "failed";
  // New fields for processor
  retryCount: number;
  lastError: string | null;
  processedAt: Date | null;
}
```

## Phase 4: Fallback Polling (Reliability)

### 4.1 Create Fallback Poller

In case change stream misses events (network partition, restart gap), a fallback poller runs periodically:

```typescript
// lib/outbox/processor/outbox-fallback-poller.ts
class OutboxFallbackPoller {
  constructor(
    private readonly config: { pollIntervalMs: number; batchSize: number },
    private readonly processor: OutboxProcessor,
    private readonly outboxRepository: OutboxRepositoryPort,
  ) {}

  async start(): Promise<void> {
    while (this.#isRunning) {
      await this.pollOnce();
      await sleep(this.config.pollIntervalMs);
    }
  }

  private async pollOnce(): Promise<void> {
    const pendingResult = await this.outboxRepository.findPendingEvents(
      this.config.batchSize,
    );
    if (pendingResult.isErr()) return;

    for (const event of pendingResult.value) {
      await this.processor.processEvent(event);
    }
  }
}
```

## Phase 5: Application Integration

### 5.1 Processor Lifecycle Management

```typescript
// index.ts (Elysia app)
const processor = new OutboxProcessor(
  config,
  registry,
  outboxRepo,
  tokenRepo,
  logger,
);
const fallbackPoller = new OutboxFallbackPoller(
  pollConfig,
  processor,
  outboxRepo,
);

// Start on app startup
await processor.start();
await fallbackPoller.start();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await processor.stop();
  await fallbackPoller.stop();
});
```

### 5.2 Example Event Handler

```typescript
// module/prompt/application/event-handler/prompt-created-event-handler.ts
class PromptCreatedEventHandler implements EventHandlerPort<PromptCreatedEventProps> {
  eventType = "PromptCreatedEvent";

  async handle(
    ctx: AppContext,
    event: OutboxEventModel<PromptCreatedEventProps>,
  ): Promise<Result<void, AppError>> {
    ctx.logger.info(
      { promptId: event.aggregateId },
      "Processing PromptCreatedEvent",
    );
    // React to prompt creation (e.g., send notification, update search index)
    return ok(undefined);
  }
}
```

# File Structure

```
app/service/src/lib/
├── outbox/
│   ├── outbox-event-model.ts           # Extended with retry fields
│   ├── outbox-event-mapper.ts
│   ├── event-handler-registry.ts       # Handler registration
│   ├── port/
│   │   ├── outbox-repository-port.ts   # Extended with processor methods
│   │   ├── event-handler-port.ts       # Handler interface
│   │   └── resume-token-repository-port.ts
│   ├── adapter/
│   │   ├── outbox-mongo-repository-adapter.ts
│   │   └── resume-token-mongo-repository-adapter.ts
│   └── processor/
│       ├── outbox-processor-config.ts
│       ├── outbox-processor.ts         # Change stream processor
│       └── outbox-fallback-poller.ts   # Polling fallback

app/service/src/module/prompt/
└── application/
    └── event-handler/
        └── prompt-created-event-handler.ts  # Example handler
```

# Acceptance Criteria

## Phase 1: Event Handler Infrastructure

- [ ] `EventHandlerPort` interface is created with `eventType` and `handle()` method
- [ ] `EventHandlerRegistry` can register and retrieve handlers by event type
- [ ] Multiple handlers can be registered for the same event type
- [ ] Unit tests exist for `EventHandlerRegistry`

## Phase 2: Change Stream Processor

- [ ] `OutboxProcessor` watches outbox collection using MongoDB Change Streams
- [ ] Processor dispatches events to registered handlers based on `eventType`
- [ ] Processor persists resume token after each processed event
- [ ] Processor resumes from last token on restart
- [ ] `start()` and `stop()` methods enable graceful lifecycle management
- [ ] Unit tests exist for `OutboxProcessor` (mocked change stream)

## Phase 3: Outbox Repository Extensions

- [ ] `markAsPublished()` updates event status and sets `publishedAt`
- [ ] `markAsFailed()` updates event status, increments `retryCount`, stores error
- [ ] `findPendingEvents()` returns events with `status: "pending"` ordered by `occurredAt`
- [ ] Unit tests exist for new repository methods

## Phase 4: Fallback Polling

- [ ] `OutboxFallbackPoller` periodically queries for pending events
- [ ] Fallback poller processes events missed by change stream
- [ ] Configurable poll interval and batch size
- [ ] Unit tests exist for `OutboxFallbackPoller`

## Phase 5: Application Integration

- [ ] Processor starts on application startup
- [ ] Processor stops gracefully on SIGTERM/SIGINT
- [ ] At least one example event handler is implemented
- [ ] Integration test verifies end-to-end event processing

## Non-Functional Requirements

- [ ] MongoDB replica set is configured (required for change streams)
- [ ] Resume token collection has TTL index for cleanup
- [ ] Outbox collection has compound index on `(status, occurredAt)` for polling
- [ ] Processor config is loaded from `AppConfig`
- [ ] All processor activity is logged with correlation IDs
