# Implementation Plan: setup-outbox-library

## 1. Implementation Summary

This plan creates a poll-based outbox library following hexagonal architecture patterns. The library will poll the outbox collection for pending events, route them to registered handlers based on event type, and update event status to PROCESSED or FAILED after processing. The implementation extends the existing outbox repository with polling methods, introduces an event handler registry for routing, and provides an OutboxProcessor that runs a configurable polling loop. The library is encapsulated with ports/adapters and exposed via OutboxFacade for bounded contexts to integrate.

## 2. Change Manifest

```
CREATE:
- app/service/src/lib/outbox/domain/outbox-event.ts - Domain entity for outbox events
- app/service/src/lib/outbox/port/inbound/event-handler-port.ts - Interface for domain event handlers
- app/service/src/lib/outbox/port/inbound/event-handler-registry-port.ts - Interface for handler registration
- app/service/src/lib/outbox/port/inbound/outbox-processor-port.ts - Interface for the processor
- app/service/src/lib/outbox/adapter/inbound/event-handler-registry-adapter.ts - Handler registry implementation
- app/service/src/lib/outbox/adapter/inbound/outbox-processor-adapter.ts - Polling processor implementation
- app/service/src/lib/outbox/adapter/inbound/outbox-processor-adapter.test.ts - Unit tests for processor
- app/service/src/lib/outbox/adapter/inbound/event-handler-registry-adapter.test.ts - Unit tests for registry
- app/service/src/lib/outbox/outbox-facade.ts - Public facade for bounded contexts
- app/service/src/lib/outbox/outbox-config.ts - Configuration schema for outbox polling

MODIFY:
- app/service/src/lib/outbox/port/outbound/persistence/outbox-event-repository-port.ts - Add findPending, markProcessed, markFailed methods
- app/service/src/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-repository-adapter.ts - Implement new repository methods
- app/service/src/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-repository-adapter.test.ts - Add tests for new methods
- app/service/src/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model-mapper.ts - Add toDomain method
- app/service/src/lib/app-config.ts - Add outbox configuration section
- app/service/src/module/prompt/adapter/inbound/http/api.ts - Wire OutboxProcessor and register handlers
- app/service/src/index.ts - Start OutboxProcessor alongside HTTP server
```

## 3. Step-by-Step Plan

### Step 1: Create Outbox Domain Entity

**File:** `app/service/src/lib/outbox/domain/outbox-event.ts`

**Action:** CREATE

**Rationale:** Provides a domain representation of outbox events for processing, separating persistence model from domain logic.

**Pseudocode:**

```typescript
import type { Id } from "@/lib/id";

// Define the status type for outbox events
type OutboxEventStatus = "PENDING" | "PUBLISHED" | "FAILED";

// Define props type for the outbox event
type OutboxEventProps = {
  id: Id;
  aggregateId: Id;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  publishedAt: Date | null;
  status: OutboxEventStatus;
  retryCount: number;
  lastError: string | null;
};

// OutboxEvent class
//   - Immutable value object representing an event from the outbox
//   - Properties match the MongoDB model for easy mapping
export class OutboxEvent {
  readonly id: Id;
  readonly aggregateId: Id;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly occurredAt: Date;
  readonly publishedAt: Date | null;
  readonly status: OutboxEventStatus;
  readonly retryCount: number;
  readonly lastError: string | null;

  constructor(props: OutboxEventProps) {
    // 1. Assign all properties from props
    this.id = props.id;
    this.aggregateId = props.aggregateId;
    this.eventType = props.eventType;
    this.payload = props.payload;
    this.occurredAt = props.occurredAt;
    this.publishedAt = props.publishedAt;
    this.status = props.status;
    this.retryCount = props.retryCount;
    this.lastError = props.lastError;
  }
}

export type { OutboxEventStatus, OutboxEventProps };
```

**Dependencies:** `@/lib/id`

**Tests Required:**

- None (simple value object)

---

### Step 2: Create Event Handler Port

**File:** `app/service/src/lib/outbox/port/inbound/event-handler-port.ts`

**Action:** CREATE

**Rationale:** Defines the contract for domain event handlers that bounded contexts will implement.

**Pseudocode:**

```typescript
import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { OutboxEvent } from "@/lib/outbox/domain/outbox-event";

// EventHandlerPort interface
//   - Single method 'handle' that processes an outbox event
//   - Returns Result to indicate success or failure
//   - Takes AppContext for logging and config access
export interface EventHandlerPort {
  handle(ctx: AppContext, event: OutboxEvent): Promise<Result<void, AppError>>;
}
```

**Dependencies:** `neverthrow`, `@/lib/app-context`, `@/lib/app-error`, `@/lib/outbox/domain/outbox-event`

**Tests Required:**

- None (interface only)

---

### Step 3: Create Event Handler Registry Port

**File:** `app/service/src/lib/outbox/port/inbound/event-handler-registry-port.ts`

**Action:** CREATE

**Rationale:** Defines the contract for registering and retrieving event handlers by event type.

**Pseudocode:**

```typescript
import type { EventHandlerPort } from "@/lib/outbox/port/inbound/event-handler-port";

// EventHandlerRegistryPort interface
//   - 'register': Associates an event type string with a handler
//   - 'getHandler': Retrieves the handler for a given event type (or undefined if none)
export interface EventHandlerRegistryPort {
  register(eventType: string, handler: EventHandlerPort): void;
  getHandler(eventType: string): EventHandlerPort | undefined;
}
```

**Dependencies:** `@/lib/outbox/port/inbound/event-handler-port`

**Tests Required:**

- None (interface only)

---

### Step 4: Create Outbox Processor Port

**File:** `app/service/src/lib/outbox/port/inbound/outbox-processor-port.ts`

**Action:** CREATE

**Rationale:** Defines the contract for the outbox processor lifecycle (start/stop).

**Pseudocode:**

```typescript
// OutboxProcessorPort interface
//   - 'start': Begins the polling loop
//   - 'stop': Gracefully stops polling and waits for in-flight processing
export interface OutboxProcessorPort {
  start(): void;
  stop(): Promise<void>;
}
```

**Dependencies:** None

**Tests Required:**

- None (interface only)

---

### Step 5: Create Outbox Configuration Schema

**File:** `app/service/src/lib/outbox/outbox-config.ts`

**Action:** CREATE

**Rationale:** Provides typed configuration for the outbox processor with sensible defaults.

**Pseudocode:**

```typescript
import { z } from "zod/v4";

// Define schema for outbox configuration
//   - pollingIntervalMs: How often to poll (default 1000ms)
//   - batchSize: Max events per poll (default 10)
//   - maxRetries: Retry limit before marking FAILED (default 3)
export const outboxConfigSchema = z.object({
  pollingIntervalMs: z.number().min(100).max(60000).default(1000),
  batchSize: z.number().min(1).max(100).default(10),
  maxRetries: z.number().min(0).max(10).default(3),
});

export type OutboxConfig = z.output<typeof outboxConfigSchema>;
```

**Dependencies:** `zod/v4`

**Tests Required:**

- Test default values are applied correctly
- Test validation rejects invalid values

---

### Step 6: Extend Outbox Event Repository Port

**File:** `app/service/src/lib/outbox/port/outbound/persistence/outbox-event-repository-port.ts`

**Action:** MODIFY

**Rationale:** Adds methods required for polling (findPending) and status updates (markProcessed, markFailed).

**Pseudocode:**

```typescript
import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";
import type { Id } from "@/lib/id";
import type { OutboxEvent } from "@/lib/outbox/domain/outbox-event";

export interface OutboxEventRepositoryPort {
  // Existing method
  insertMany(
    ctx: AppContext,
    events: BaseEvent<BaseProps>[],
  ): Promise<Result<void, AppError>>;

  // NEW: Find pending events for processing
  //   - limit: Max number of events to fetch (respects batchSize)
  //   - Returns events ordered by occurredAt ASC
  //   - Only returns events with status = "PENDING"
  //   - Should use atomic findOneAndUpdate to claim events (prevent duplicate processing)
  findPending(
    ctx: AppContext,
    limit: number,
  ): Promise<Result<OutboxEvent[], AppError>>;

  // NEW: Mark event as processed
  //   - Sets status to "PUBLISHED"
  //   - Sets publishedAt to current timestamp
  markProcessed(ctx: AppContext, eventId: Id): Promise<Result<void, AppError>>;

  // NEW: Mark event as failed
  //   - Increments retryCount
  //   - Sets lastError to the provided error message
  //   - If retryCount >= maxRetries, sets status to "FAILED"
  //   - Otherwise keeps status as "PENDING" for retry
  markFailed(
    ctx: AppContext,
    eventId: Id,
    error: string,
    maxRetries: number,
  ): Promise<Result<void, AppError>>;
}
```

**Dependencies:** `@/lib/outbox/domain/outbox-event`, `@/lib/id`

**Tests Required:**

- Tested in repository adapter tests

---

### Step 7: Extend Outbox Model Mapper

**File:** `app/service/src/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model-mapper.ts`

**Action:** MODIFY

**Rationale:** Adds toDomain method to convert MongoDB models back to domain entities for processing.

**Pseudocode:**

```typescript
import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";
import type { Id } from "@/lib/id";
import type { OutboxModelMapper } from "@/lib/mapper/outbox-model-mapper";
import type { OutboxEventMongoModel } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model";
import { OutboxEvent } from "@/lib/outbox/domain/outbox-event";

export class OutboxEventMongoModelMapper implements OutboxModelMapper<
  BaseEvent<BaseProps>,
  OutboxEventMongoModel
> {
  // Existing fromDomain method (unchanged)
  fromDomain(event: BaseEvent<BaseProps>): OutboxEventMongoModel {
    return {
      _id: event.id,
      aggregateId: event.aggregateId,
      eventType: event.constructor.name,
      payload: event.props as Record<string, unknown>,
      occurredAt: event.occurredAt,
      publishedAt: null,
      status: "PENDING",
      retryCount: 0,
      lastError: null,
    };
  }

  // Existing fromDomains method (unchanged)
  fromDomains(events: BaseEvent<BaseProps>[]): OutboxEventMongoModel[] {
    return events.map((event) => this.fromDomain(event));
  }

  // NEW: Convert MongoDB model to OutboxEvent domain entity
  //   - Maps all fields from model to domain props
  //   - Casts _id to Id type
  toDomain(model: OutboxEventMongoModel): OutboxEvent {
    return new OutboxEvent({
      id: model._id as Id,
      aggregateId: model.aggregateId as Id,
      eventType: model.eventType,
      payload: model.payload,
      occurredAt: model.occurredAt,
      publishedAt: model.publishedAt,
      status: model.status,
      retryCount: model.retryCount,
      lastError: model.lastError,
    });
  }

  // NEW: Convert multiple MongoDB models to domain entities
  toDomains(models: OutboxEventMongoModel[]): OutboxEvent[] {
    return models.map((model) => this.toDomain(model));
  }
}
```

**Dependencies:** `@/lib/outbox/domain/outbox-event`, `@/lib/id`

**Tests Required:**

- Test toDomain correctly maps all fields
- Test toDomains handles empty array
- Test toDomains handles multiple models

---

### Step 8: Implement Extended Repository Adapter

**File:** `app/service/src/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-repository-adapter.ts`

**Action:** MODIFY

**Rationale:** Implements the new repository methods for polling and status updates with atomic operations.

**Pseudocode:**

```typescript
import { attemptAsync, isNil } from "es-toolkit";
import type { Collection } from "mongodb";
import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";
import type { Id } from "@/lib/id";
import type { OutboxEventMongoModel } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model";
import { OutboxEventMongoModelMapper } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model-mapper";
import { OutboxEvent } from "@/lib/outbox/domain/outbox-event";
import type { OutboxEventRepositoryPort } from "@/lib/outbox/port/outbound/persistence/outbox-event-repository-port";

export class OutboxEventMongoRepositoryAdapter implements OutboxEventRepositoryPort {
  #collection: Collection<OutboxEventMongoModel>;
  #mapper: OutboxEventMongoModelMapper;

  constructor(
    collection: Collection<OutboxEventMongoModel>,
    mapper: OutboxEventMongoModelMapper,
  ) {
    this.#collection = collection;
    this.#mapper = mapper;
  }

  // Existing insertMany (unchanged)
  async insertMany(
    ctx: AppContext,
    events: BaseEvent<BaseProps>[],
  ): Promise<Result<void, AppError>> {
    if (events.length === 0) {
      return ok();
    }

    const models = this.#mapper.fromDomains(events);
    const [error] = await attemptAsync(async () => {
      await this.#collection.insertMany(models, { session: ctx.db.session });
    });

    if (!isNil(error)) {
      return err(AppError.from(error));
    }

    return ok();
  }

  // NEW: Find pending events for processing
  async findPending(
    ctx: AppContext,
    limit: number,
  ): Promise<Result<OutboxEvent[], AppError>> {
    // 1. Query for PENDING events, ordered by occurredAt ASC
    // 2. Limit results to batch size
    // 3. Map models to domain entities
    // 4. Handle errors with attemptAsync pattern

    const [error, models] = await attemptAsync(async () => {
      const cursor = this.#collection
        .find({ status: "PENDING" }, { session: ctx.db.session })
        .sort({ occurredAt: 1 })
        .limit(limit);

      return cursor.toArray();
    });

    if (!isNil(error)) {
      return err(AppError.from(error));
    }

    return ok(this.#mapper.toDomains(models ?? []));
  }

  // NEW: Mark event as processed
  async markProcessed(
    ctx: AppContext,
    eventId: Id,
  ): Promise<Result<void, AppError>> {
    // 1. Use updateOne to set status = "PUBLISHED" and publishedAt = now
    // 2. Handle errors

    const [error] = await attemptAsync(async () => {
      await this.#collection.updateOne(
        { _id: eventId },
        {
          $set: {
            status: "PUBLISHED",
            publishedAt: new Date(),
          },
        },
        { session: ctx.db.session },
      );
    });

    if (!isNil(error)) {
      return err(AppError.from(error));
    }

    return ok();
  }

  // NEW: Mark event as failed
  async markFailed(
    ctx: AppContext,
    eventId: Id,
    errorMessage: string,
    maxRetries: number,
  ): Promise<Result<void, AppError>> {
    // 1. First, fetch current retryCount
    // 2. Determine new status:
    //    - If current retryCount + 1 >= maxRetries: status = "FAILED"
    //    - Otherwise: status stays "PENDING" (for retry)
    // 3. Update document with incremented retryCount, lastError, and potentially new status

    const [error] = await attemptAsync(async () => {
      // Fetch current document to check retry count
      const doc = await this.#collection.findOne(
        { _id: eventId },
        { session: ctx.db.session },
      );

      if (isNil(doc)) {
        throw new Error(`Outbox event not found: ${eventId}`);
      }

      const newRetryCount = doc.retryCount + 1;
      const newStatus = newRetryCount >= maxRetries ? "FAILED" : "PENDING";

      await this.#collection.updateOne(
        { _id: eventId },
        {
          $set: {
            status: newStatus,
            retryCount: newRetryCount,
            lastError: errorMessage,
          },
        },
        { session: ctx.db.session },
      );
    });

    if (!isNil(error)) {
      return err(AppError.from(error));
    }

    return ok();
  }
}
```

**Dependencies:** `es-toolkit`, `mongodb`, `neverthrow`, `@/lib/outbox/domain/outbox-event`

**Tests Required:**

- Test findPending returns pending events ordered by occurredAt
- Test findPending respects limit
- Test findPending returns empty array when no pending events
- Test markProcessed updates status and publishedAt
- Test markFailed increments retryCount and sets lastError
- Test markFailed sets status to FAILED when retryCount reaches maxRetries
- Test markFailed keeps status PENDING when retryCount below maxRetries
- Test all methods handle MongoDB errors correctly

---

### Step 9: Create Event Handler Registry Adapter

**File:** `app/service/src/lib/outbox/adapter/inbound/event-handler-registry-adapter.ts`

**Action:** CREATE

**Rationale:** Implements the registry for storing and retrieving event handlers by type.

**Pseudocode:**

```typescript
import type { EventHandlerPort } from "@/lib/outbox/port/inbound/event-handler-port";
import type { EventHandlerRegistryPort } from "@/lib/outbox/port/inbound/event-handler-registry-port";

export class EventHandlerRegistryAdapter implements EventHandlerRegistryPort {
  // Private map to store handlers keyed by event type
  #handlers: Map<string, EventHandlerPort> = new Map();

  // Register a handler for an event type
  //   - Overwrites if handler already exists for this type
  //   - Could log a warning on overwrite (optional enhancement)
  register(eventType: string, handler: EventHandlerPort): void {
    this.#handlers.set(eventType, handler);
  }

  // Get handler for event type
  //   - Returns undefined if no handler registered
  getHandler(eventType: string): EventHandlerPort | undefined {
    return this.#handlers.get(eventType);
  }
}
```

**Dependencies:** `@/lib/outbox/port/inbound/event-handler-port`, `@/lib/outbox/port/inbound/event-handler-registry-port`

**Tests Required:**

- Test register stores handler correctly
- Test getHandler retrieves registered handler
- Test getHandler returns undefined for unregistered type
- Test register overwrites existing handler for same type

---

### Step 10: Create Outbox Processor Adapter

**File:** `app/service/src/lib/outbox/adapter/inbound/outbox-processor-adapter.ts`

**Action:** CREATE

**Rationale:** Implements the polling loop that processes outbox events and routes them to handlers.

**Pseudocode:**

```typescript
import { isNil } from "es-toolkit";
import type { AppContext } from "@/lib/app-context";
import type { OutboxEvent } from "@/lib/outbox/domain/outbox-event";
import type { OutboxConfig } from "@/lib/outbox/outbox-config";
import type { EventHandlerRegistryPort } from "@/lib/outbox/port/inbound/event-handler-registry-port";
import type { OutboxProcessorPort } from "@/lib/outbox/port/inbound/outbox-processor-port";
import type { OutboxEventRepositoryPort } from "@/lib/outbox/port/outbound/persistence/outbox-event-repository-port";

export class OutboxProcessorAdapter implements OutboxProcessorPort {
  #ctx: AppContext;
  #config: OutboxConfig;
  #repository: OutboxEventRepositoryPort;
  #registry: EventHandlerRegistryPort;
  #isRunning: boolean = false;
  #timeoutId: ReturnType<typeof setTimeout> | null = null;
  #processingPromise: Promise<void> | null = null;

  constructor(
    ctx: AppContext,
    config: OutboxConfig,
    repository: OutboxEventRepositoryPort,
    registry: EventHandlerRegistryPort,
  ) {
    this.#ctx = ctx;
    this.#config = config;
    this.#repository = repository;
    this.#registry = registry;
  }

  // Start the polling loop
  start(): void {
    // 1. Check if already running, return early if so
    if (this.#isRunning) {
      this.#ctx.logger.warn("OutboxProcessor is already running");
      return;
    }

    // 2. Set running flag
    this.#isRunning = true;

    // 3. Log start
    this.#ctx.logger.info("OutboxProcessor started");

    // 4. Schedule first poll
    this.#schedulePoll();
  }

  // Stop the polling loop gracefully
  async stop(): Promise<void> {
    // 1. Set running flag to false
    this.#isRunning = false;

    // 2. Clear any pending timeout
    if (!isNil(this.#timeoutId)) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }

    // 3. Wait for any in-flight processing to complete
    if (!isNil(this.#processingPromise)) {
      await this.#processingPromise;
    }

    // 4. Log stop
    this.#ctx.logger.info("OutboxProcessor stopped");
  }

  // Schedule the next poll after interval
  #schedulePoll(): void {
    if (!this.#isRunning) {
      return;
    }

    this.#timeoutId = setTimeout(async () => {
      // Wrap processing in a promise we can await on stop
      this.#processingPromise = this.#poll();
      await this.#processingPromise;
      this.#processingPromise = null;

      // Schedule next poll
      this.#schedulePoll();
    }, this.#config.pollingIntervalMs);
  }

  // Poll and process events
  async #poll(): Promise<void> {
    // 1. Fetch pending events
    const findResult = await this.#repository.findPending(
      this.#ctx,
      this.#config.batchSize,
    );

    // 2. Handle fetch error
    if (findResult.isErr()) {
      this.#ctx.logger.error(
        { error: findResult.error },
        "Failed to fetch pending outbox events",
      );
      return;
    }

    const events = findResult.value;

    // 3. If no events, return early
    if (events.length === 0) {
      return;
    }

    // 4. Log batch info
    this.#ctx.logger.debug(
      { count: events.length },
      "Processing outbox events",
    );

    // 5. Process each event sequentially (maintains order)
    for (const event of events) {
      await this.#processEvent(event);

      // Check if we should stop
      if (!this.#isRunning) {
        break;
      }
    }
  }

  // Process a single event
  async #processEvent(event: OutboxEvent): Promise<void> {
    // 1. Get handler for event type
    const handler = this.#registry.getHandler(event.eventType);

    // 2. If no handler, log warning and mark as failed
    if (isNil(handler)) {
      this.#ctx.logger.warn(
        { eventType: event.eventType, eventId: event.id },
        "No handler registered for event type",
      );

      await this.#repository.markFailed(
        this.#ctx,
        event.id,
        `No handler registered for event type: ${event.eventType}`,
        this.#config.maxRetries,
      );
      return;
    }

    // 3. Execute handler
    const handleResult = await handler.handle(this.#ctx, event);

    // 4. Handle result
    if (handleResult.isOk()) {
      // Mark as processed
      const markResult = await this.#repository.markProcessed(
        this.#ctx,
        event.id,
      );

      if (markResult.isErr()) {
        this.#ctx.logger.error(
          { eventId: event.id, error: markResult.error },
          "Failed to mark event as processed",
        );
      } else {
        this.#ctx.logger.debug(
          { eventId: event.id, eventType: event.eventType },
          "Event processed successfully",
        );
      }
    } else {
      // Mark as failed with error message
      const errorMessage = handleResult.error.message ?? "Unknown error";

      const markResult = await this.#repository.markFailed(
        this.#ctx,
        event.id,
        errorMessage,
        this.#config.maxRetries,
      );

      if (markResult.isErr()) {
        this.#ctx.logger.error(
          { eventId: event.id, error: markResult.error },
          "Failed to mark event as failed",
        );
      } else {
        this.#ctx.logger.warn(
          {
            eventId: event.id,
            eventType: event.eventType,
            error: errorMessage,
          },
          "Event processing failed",
        );
      }
    }
  }
}
```

**Dependencies:** `es-toolkit`, `@/lib/app-context`, `@/lib/outbox/outbox-config`, all outbox ports

**Tests Required:**

- Test start begins polling
- Test start is idempotent (calling twice does not duplicate)
- Test stop clears timeout and waits for processing
- Test poll fetches pending events and processes them
- Test processEvent routes to correct handler
- Test processEvent marks as processed on success
- Test processEvent marks as failed on handler error
- Test processEvent handles missing handler

---

### Step 11: Create Outbox Facade

**File:** `app/service/src/lib/outbox/outbox-facade.ts`

**Action:** CREATE

**Rationale:** Provides a clean public API for bounded contexts to interact with the outbox library.

**Pseudocode:**

```typescript
import type { AppContext } from "@/lib/app-context";
import { EventHandlerRegistryAdapter } from "@/lib/outbox/adapter/inbound/event-handler-registry-adapter";
import { OutboxProcessorAdapter } from "@/lib/outbox/adapter/inbound/outbox-processor-adapter";
import type { OutboxConfig } from "@/lib/outbox/outbox-config";
import type { EventHandlerPort } from "@/lib/outbox/port/inbound/event-handler-port";
import type { EventHandlerRegistryPort } from "@/lib/outbox/port/inbound/event-handler-registry-port";
import type { OutboxProcessorPort } from "@/lib/outbox/port/inbound/outbox-processor-port";
import type { OutboxEventRepositoryPort } from "@/lib/outbox/port/outbound/persistence/outbox-event-repository-port";

// Options for creating the facade
export type OutboxFacadeOptions = {
  ctx: AppContext;
  config: OutboxConfig;
  repository: OutboxEventRepositoryPort;
};

// OutboxFacade class
//   - Encapsulates outbox library internals
//   - Provides simple API for:
//     - Registering event handlers
//     - Starting/stopping the processor
export class OutboxFacade {
  #registry: EventHandlerRegistryPort;
  #processor: OutboxProcessorPort;

  constructor(options: OutboxFacadeOptions) {
    // 1. Create registry
    this.#registry = new EventHandlerRegistryAdapter();

    // 2. Create processor with dependencies
    this.#processor = new OutboxProcessorAdapter(
      options.ctx,
      options.config,
      options.repository,
      this.#registry,
    );
  }

  // Register a handler for an event type
  registerHandler(eventType: string, handler: EventHandlerPort): void {
    this.#registry.register(eventType, handler);
  }

  // Start the processor
  start(): void {
    this.#processor.start();
  }

  // Stop the processor
  async stop(): Promise<void> {
    await this.#processor.stop();
  }
}
```

**Dependencies:** All outbox adapters and ports

**Tests Required:**

- Test registerHandler delegates to registry
- Test start delegates to processor
- Test stop delegates to processor

---

### Step 12: Update App Configuration

**File:** `app/service/src/lib/app-config.ts`

**Action:** MODIFY

**Rationale:** Adds outbox configuration section to the application config.

**Pseudocode:**

```typescript
import { z } from "zod/v4";
import { outboxConfigSchema } from "@/lib/outbox/outbox-config";

export const appConfigSchema = z.object({
  app: z.object({
    env: z.string(),
    version: z.string(),
  }),

  mongo: z.object({
    uri: z.string(),
    transactionTimeoutMs: z.number().min(1000).max(60000).default(30000),
  }),

  // NEW: Outbox configuration
  outbox: outboxConfigSchema,
});

export type AppConfig = z.output<typeof appConfigSchema>;

export const appConfig = appConfigSchema.parse({
  app: {
    env: process.env.APP_ENV ?? "local",
    version: process.env.APP_VERSION ?? "0.0.0",
  },

  mongo: {
    uri: process.env.MONGO_URI,
    transactionTimeoutMs: process.env.MONGO_TRANSACTION_TIMEOUT_MS ?? 30000,
  },

  // NEW: Parse outbox config from env or use defaults
  outbox: {
    pollingIntervalMs: process.env.OUTBOX_POLLING_INTERVAL_MS
      ? parseInt(process.env.OUTBOX_POLLING_INTERVAL_MS, 10)
      : undefined,
    batchSize: process.env.OUTBOX_BATCH_SIZE
      ? parseInt(process.env.OUTBOX_BATCH_SIZE, 10)
      : undefined,
    maxRetries: process.env.OUTBOX_MAX_RETRIES
      ? parseInt(process.env.OUTBOX_MAX_RETRIES, 10)
      : undefined,
  },
});
```

**Dependencies:** `@/lib/outbox/outbox-config`

**Tests Required:**

- Test default values are applied
- Test env vars override defaults

---

### Step 13: Wire OutboxFacade in Prompt Module

**File:** `app/service/src/module/prompt/adapter/inbound/http/api.ts`

**Action:** MODIFY

**Rationale:** Wires the OutboxFacade, registers handlers, and exports the facade for the main entry point.

**Pseudocode:**

```typescript
import { appConfig } from "@/lib/app-config";
import { createAppContext } from "@/lib/app-context";
import { appLogger } from "@/lib/app-logger";
import { mongoClient } from "@/lib/mongo/mongo-client";
import {
  getOutboxEventMongoCollection,
  withOutboxEventMongoCollectionIndexes,
} from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-details";
import type { OutboxEventMongoModel } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model";
import { OutboxEventMongoModelMapper } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model-mapper";
import { OutboxEventMongoRepositoryAdapter } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-repository-adapter";
import { OutboxFacade } from "@/lib/outbox/outbox-facade";
import { MongoUnitOfWorkAdapter } from "@/lib/unit-of-work/adapter/mongo-unit-of-work-adapter";
import { PromptRouterFactory } from "@/module/prompt/adapter/inbound/http/router/prompt-router-factory";
import {
  getMongoPromptCollection,
  getMongoPromptDatabase,
} from "@/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-details";
import type { PromptMongoModel } from "@/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model";
import { PromptMongoModelMapper } from "@/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model-mapper";
import { PromptMongoRepository } from "@/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-repository-adapter";
import { PromptUseCaseDtoMapper } from "@/module/prompt/application/mapper/prompt-use-case-dto-mapper";
import { CreatePromptUseCaseAdapter } from "@/module/prompt/application/use-case/create-prompt-use-case-adapter";
import { ListPromptsUseCaseAdapter } from "@/module/prompt/application/use-case/list-prompts-use-case-adapter";

// ... existing setup code ...

const promptDatabase = mongoClient.db(getMongoPromptDatabase());

const promptCollection = promptDatabase.collection<PromptMongoModel>(
  getMongoPromptCollection(),
);
const outboxEventCollection = await withOutboxEventMongoCollectionIndexes(
  promptDatabase.collection<OutboxEventMongoModel>(
    getOutboxEventMongoCollection(),
  ),
);

const promptMongoModelMapper = new PromptMongoModelMapper();
const promptUseCaseDtoMapper = new PromptUseCaseDtoMapper();

const promptMongoRepository = new PromptMongoRepository(
  promptCollection,
  promptMongoModelMapper,
);

const outboxEventModelMapper = new OutboxEventMongoModelMapper();
const outboxRepository = new OutboxEventMongoRepositoryAdapter(
  outboxEventCollection,
  outboxEventModelMapper,
);

const unitOfWork = new MongoUnitOfWorkAdapter(mongoClient, {
  transactionTimeoutMs: appConfig.mongo.transactionTimeoutMs,
});

const createPromptUseCase = new CreatePromptUseCaseAdapter(
  promptUseCaseDtoMapper,
  promptMongoRepository,
  unitOfWork,
  outboxRepository,
);
const listPromptsUseCase = new ListPromptsUseCaseAdapter(
  promptUseCaseDtoMapper,
  promptMongoRepository,
);

const promptHttpRouterV1Factory = new PromptRouterFactory(
  createPromptUseCase,
  listPromptsUseCase,
);
export const promptHttpRouterV1 = promptHttpRouterV1Factory.make();

// NEW: Create AppContext for outbox
const outboxAppContext = createAppContext({
  config: appConfig,
  logger: appLogger,
});

// NEW: Create OutboxFacade
export const outboxFacade = new OutboxFacade({
  ctx: outboxAppContext,
  config: appConfig.outbox,
  repository: outboxRepository,
});

// NEW: Register event handlers
// Example: Register handler for PromptCreatedEvent
// outboxFacade.registerHandler("PromptCreatedEvent", new PromptCreatedEventHandler());
// NOTE: Handlers will be implemented by bounded contexts as needed
```

**Dependencies:** `@/lib/outbox/outbox-facade`, `@/lib/app-context`, `@/lib/app-logger`

**Tests Required:**

- Integration test verifying facade is properly wired

---

### Step 14: Update Main Entry Point

**File:** `app/service/src/index.ts`

**Action:** MODIFY

**Rationale:** Starts the OutboxProcessor alongside the HTTP server and handles graceful shutdown.

**Pseudocode:**

```typescript
import openapi, { fromTypes } from "@elysiajs/openapi";
import Elysia from "elysia";
import {
  outboxFacade,
  promptHttpRouterV1,
} from "@/module/prompt/adapter/inbound/http/api";

const app = new Elysia();

app
  .use(openapi({ references: fromTypes() }))
  .use(promptHttpRouterV1)
  .listen(3000);

// NEW: Start OutboxProcessor
outboxFacade.start();

// NEW: Handle graceful shutdown
const shutdown = async () => {
  console.log("Shutting down...");
  await outboxFacade.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

**Dependencies:** `@/module/prompt/adapter/inbound/http/api` (for outboxFacade export)

**Tests Required:**

- Manual verification: Start app and observe outbox polling in logs
- Manual verification: Stop app (Ctrl+C) and observe graceful shutdown

---

### Step 15: Add Unit Tests for Repository Extensions

**File:** `app/service/src/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-repository-adapter.test.ts`

**Action:** MODIFY

**Rationale:** Adds tests for the new findPending, markProcessed, and markFailed methods.

**Pseudocode:**

```typescript
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

// ... existing tests ...

describe("OutboxMongoRepositoryAdapter", () => {
  // ... existing helper functions and insertMany tests ...

  describe("findPending", () => {
    it("should return pending events ordered by occurredAt", async () => {
      // Setup:
      //   - Create mock collection with find() returning cursor
      //   - Cursor has sort(), limit(), toArray()
      //   - Return array of pending models
      // Act: Call findPending with limit
      // Assert: Result is ok with mapped OutboxEvent array
    });

    it("should return empty array when no pending events", async () => {
      // Setup: find() returns empty array
      // Act: Call findPending
      // Assert: Result is ok with empty array
    });

    it("should respect limit parameter", async () => {
      // Setup: Create mock with limit tracking
      // Act: Call findPending with limit=5
      // Assert: limit(5) was called
    });

    it("should return error when MongoDB fails", async () => {
      // Setup: find() throws error
      // Act: Call findPending
      // Assert: Result is err
    });
  });

  describe("markProcessed", () => {
    it("should update status to PUBLISHED and set publishedAt", async () => {
      // Setup: Create mock collection with updateOne
      // Act: Call markProcessed with eventId
      // Assert:
      //   - updateOne called with correct filter { _id: eventId }
      //   - updateOne called with $set { status: "PUBLISHED", publishedAt: Date }
    });

    it("should return error when MongoDB fails", async () => {
      // Setup: updateOne throws error
      // Act: Call markProcessed
      // Assert: Result is err
    });
  });

  describe("markFailed", () => {
    it("should increment retryCount and set lastError", async () => {
      // Setup:
      //   - findOne returns doc with retryCount: 0
      //   - updateOne succeeds
      // Act: Call markFailed with maxRetries=3
      // Assert:
      //   - updateOne called with retryCount: 1
      //   - updateOne called with lastError: provided error
      //   - status remains PENDING (since 1 < 3)
    });

    it("should set status to FAILED when retryCount reaches maxRetries", async () => {
      // Setup:
      //   - findOne returns doc with retryCount: 2
      //   - maxRetries: 3
      // Act: Call markFailed
      // Assert: updateOne called with status: "FAILED"
    });

    it("should return error when event not found", async () => {
      // Setup: findOne returns null
      // Act: Call markFailed
      // Assert: Result is err with "not found" message
    });
  });
});
```

**Dependencies:** All mocking utilities from bun:test

**Tests Required:** As outlined in pseudocode above

---

### Step 16: Add Unit Tests for Event Handler Registry

**File:** `app/service/src/lib/outbox/adapter/inbound/event-handler-registry-adapter.test.ts`

**Action:** CREATE

**Rationale:** Ensures registry correctly stores and retrieves handlers.

**Pseudocode:**

```typescript
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
      // Arrange
      const registry = new EventHandlerRegistryAdapter();
      const handler = createMockHandler();

      // Act
      registry.register("TestEvent", handler);

      // Assert
      expect(registry.getHandler("TestEvent")).toBe(handler);
    });

    it("should overwrite existing handler for same event type", () => {
      // Arrange
      const registry = new EventHandlerRegistryAdapter();
      const handler1 = createMockHandler();
      const handler2 = createMockHandler();

      // Act
      registry.register("TestEvent", handler1);
      registry.register("TestEvent", handler2);

      // Assert
      expect(registry.getHandler("TestEvent")).toBe(handler2);
    });
  });

  describe("getHandler", () => {
    it("should return handler for registered event type", () => {
      // Arrange
      const registry = new EventHandlerRegistryAdapter();
      const handler = createMockHandler();
      registry.register("TestEvent", handler);

      // Act
      const result = registry.getHandler("TestEvent");

      // Assert
      expect(result).toBe(handler);
    });

    it("should return undefined for unregistered event type", () => {
      // Arrange
      const registry = new EventHandlerRegistryAdapter();

      // Act
      const result = registry.getHandler("UnknownEvent");

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
```

**Dependencies:** `bun:test`, `neverthrow`

**Tests Required:** As outlined above

---

### Step 17: Add Unit Tests for Outbox Processor

**File:** `app/service/src/lib/outbox/adapter/inbound/outbox-processor-adapter.test.ts`

**Action:** CREATE

**Rationale:** Ensures processor correctly polls, routes, and handles events.

**Pseudocode:**

```typescript
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
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
  // Helper to create mock context with logger
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
    pollingIntervalMs: 100, // Short for tests
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

  describe("start", () => {
    it("should begin polling when started", async () => {
      // Arrange
      const ctx = createMockContext();
      const config = createMockConfig();
      const repository: OutboxEventRepositoryPort = {
        insertMany: mock(async () => ok(undefined)),
        findPending: mock(async () => ok([])),
        markProcessed: mock(async () => ok(undefined)),
        markFailed: mock(async () => ok(undefined)),
      };
      const registry: EventHandlerRegistryPort = {
        register: mock(() => {}),
        getHandler: mock(() => undefined),
      };

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      // Act
      processor.start();

      // Wait for first poll
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Assert
      expect(repository.findPending).toHaveBeenCalled();

      // Cleanup
      await processor.stop();
    });

    it("should be idempotent (calling twice should not duplicate polling)", async () => {
      // Arrange
      const ctx = createMockContext();
      const config = createMockConfig();
      const repository: OutboxEventRepositoryPort = {
        insertMany: mock(async () => ok(undefined)),
        findPending: mock(async () => ok([])),
        markProcessed: mock(async () => ok(undefined)),
        markFailed: mock(async () => ok(undefined)),
      };
      const registry: EventHandlerRegistryPort = {
        register: mock(() => {}),
        getHandler: mock(() => undefined),
      };

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      // Act
      processor.start();
      processor.start(); // Second call

      // Assert: logger.warn should be called for second start attempt
      expect(ctx.logger.warn).toHaveBeenCalled();

      // Cleanup
      await processor.stop();
    });
  });

  describe("stop", () => {
    it("should stop polling and wait for in-flight processing", async () => {
      // Arrange
      const ctx = createMockContext();
      const config = createMockConfig();
      const repository: OutboxEventRepositoryPort = {
        insertMany: mock(async () => ok(undefined)),
        findPending: mock(async () => ok([])),
        markProcessed: mock(async () => ok(undefined)),
        markFailed: mock(async () => ok(undefined)),
      };
      const registry: EventHandlerRegistryPort = {
        register: mock(() => {}),
        getHandler: mock(() => undefined),
      };

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      // Act
      processor.start();
      await processor.stop();

      // Wait to ensure no more polls happen
      const callCount = (repository.findPending as ReturnType<typeof mock>).mock
        .calls.length;
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Assert: No additional polls after stop
      expect(
        (repository.findPending as ReturnType<typeof mock>).mock.calls.length,
      ).toBe(callCount);
    });
  });

  describe("event processing", () => {
    it("should route events to correct handler", async () => {
      // Arrange
      const ctx = createMockContext();
      const config = createMockConfig();
      const event = createMockEvent("evt-1", "TestEvent");
      const handler: EventHandlerPort = {
        handle: mock(async () => ok(undefined)),
      };

      const repository: OutboxEventRepositoryPort = {
        insertMany: mock(async () => ok(undefined)),
        findPending: mock(async () => ok([event])),
        markProcessed: mock(async () => ok(undefined)),
        markFailed: mock(async () => ok(undefined)),
      };
      const registry: EventHandlerRegistryPort = {
        register: mock(() => {}),
        getHandler: mock((type) =>
          type === "TestEvent" ? handler : undefined,
        ),
      };

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      // Act
      processor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await processor.stop();

      // Assert
      expect(handler.handle).toHaveBeenCalledWith(ctx, event);
      expect(repository.markProcessed).toHaveBeenCalledWith(ctx, event.id);
    });

    it("should mark event as failed when handler returns error", async () => {
      // Arrange
      const ctx = createMockContext();
      const config = createMockConfig();
      const event = createMockEvent("evt-1", "TestEvent");
      const handler: EventHandlerPort = {
        handle: mock(async () => err(AppError.from("Handler failed"))),
      };

      const repository: OutboxEventRepositoryPort = {
        insertMany: mock(async () => ok(undefined)),
        findPending: mock(async () => ok([event])),
        markProcessed: mock(async () => ok(undefined)),
        markFailed: mock(async () => ok(undefined)),
      };
      const registry: EventHandlerRegistryPort = {
        register: mock(() => {}),
        getHandler: mock(() => handler),
      };

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      // Act
      processor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await processor.stop();

      // Assert
      expect(repository.markFailed).toHaveBeenCalled();
    });

    it("should mark event as failed when no handler registered", async () => {
      // Arrange
      const ctx = createMockContext();
      const config = createMockConfig();
      const event = createMockEvent("evt-1", "UnknownEvent");

      const repository: OutboxEventRepositoryPort = {
        insertMany: mock(async () => ok(undefined)),
        findPending: mock(async () => ok([event])),
        markProcessed: mock(async () => ok(undefined)),
        markFailed: mock(async () => ok(undefined)),
      };
      const registry: EventHandlerRegistryPort = {
        register: mock(() => {}),
        getHandler: mock(() => undefined),
      };

      const processor = new OutboxProcessorAdapter(
        ctx,
        config,
        repository,
        registry,
      );

      // Act
      processor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await processor.stop();

      // Assert
      expect(ctx.logger.warn).toHaveBeenCalled();
      expect(repository.markFailed).toHaveBeenCalled();
    });
  });
});
```

**Dependencies:** `bun:test`, `neverthrow`, all outbox types

**Tests Required:** As outlined above

---

## 4. Data Changes

**Schema/Model Updates:**

No schema changes required. The existing `OutboxEventMongoModel` already contains all necessary fields:

- `status: "PENDING" | "PUBLISHED" | "FAILED"`
- `retryCount: number`
- `lastError: string | null`
- `publishedAt: Date | null`

**Migration Notes:**

- No migration needed
- Existing PENDING events will be picked up by the processor automatically
- Index on `{ status: 1, occurredAt: 1 }` already exists for efficient polling

---

## 5. Integration Points

| Service          | Interaction                                  | Error Handling                                        |
| ---------------- | -------------------------------------------- | ----------------------------------------------------- |
| MongoDB          | Poll for pending events, update event status | Retry on transient errors, log on persistent failures |
| Event Handlers   | Route events to registered handlers          | Mark event as failed, respect maxRetries              |
| Bounded Contexts | Register handlers via OutboxFacade           | N/A - registration happens at startup                 |

---

## 6. Edge Cases & Error Handling

| Scenario                              | Handling                                                          |
| ------------------------------------- | ----------------------------------------------------------------- |
| No pending events                     | Poll returns empty array, skip processing, wait for next interval |
| Handler not registered                | Log warning, mark event as failed with descriptive error          |
| Handler throws exception              | Catch error, mark event as failed with error message              |
| Handler returns Result.err            | Mark event as failed with error message from Result               |
| MongoDB connection fails on poll      | Log error, wait for next interval to retry                        |
| MongoDB fails on status update        | Log error, event may be reprocessed (idempotency assumed)         |
| Retry count exceeds maxRetries        | Set status to FAILED, stop retrying                               |
| Processor shutdown during processing  | Wait for current event to complete, then stop                     |
| Multiple processor instances (future) | Use findOneAndUpdate with status transition for atomic claim      |

---

## 7. Testing Strategy

**Unit Tests:**

- EventHandlerRegistryAdapter: register, getHandler, overwrite behavior
- OutboxProcessorAdapter: start, stop, poll, event routing, error handling
- OutboxEventMongoRepositoryAdapter: findPending, markProcessed, markFailed
- OutboxEventMongoModelMapper: toDomain, toDomains

**Integration Tests:**

- Full flow: Create prompt -> event in outbox -> processor picks up -> handler invoked -> status updated
- MongoDB atomic operations work correctly
- Graceful shutdown completes in-flight processing

**Manual Verification:**

1. Start the application with `bun run dev`
2. Create a prompt via API
3. Observe logs showing event processing (if handler registered) or warning (if no handler)
4. Check MongoDB: event status should be PUBLISHED or FAILED
5. Stop application (Ctrl+C) and observe graceful shutdown message

---

## 8. Implementation Order

Recommended sequence for implementation:

1. **Step 1: OutboxEvent domain entity** - Foundation for other components
2. **Step 5: OutboxConfig schema** - Needed for processor configuration
3. **Step 2-4: Port interfaces** - Define contracts before implementations
4. **Step 7: Model mapper extension** - Needed for repository
5. **Step 6 & 8: Repository port & adapter extension** - Data access layer
6. **Step 9: EventHandlerRegistryAdapter** - Simple implementation, needed for processor
7. **Step 10: OutboxProcessorAdapter** - Core polling logic
8. **Step 11: OutboxFacade** - Public API wrapping internals
9. **Step 12: AppConfig update** - Enable configuration via environment
10. **Step 13: Wire in api.ts** - Integration with prompt module
11. **Step 14: Update index.ts** - Start processor with server
12. **Steps 15-17: Unit tests** - Verify all components work correctly

This order ensures:

- Dependencies are created before dependents
- Core logic is implemented before integration
- Tests validate each component before moving on
