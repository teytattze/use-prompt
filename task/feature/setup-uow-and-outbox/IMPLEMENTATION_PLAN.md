# Implementation Plan: Unit of Work and Transactional Outbox

## 1. Implementation Summary

This plan implements the Unit of Work (UoW) and Transactional Outbox patterns to enable reliable domain event persistence. The UoW pattern coordinates MongoDB transactions across aggregate and event persistence, while the Outbox pattern stores domain events in a dedicated collection for eventual publishing. This ensures atomicity: either both the aggregate and its events are persisted, or neither is.

Key decisions:
- Use MongoDB sessions and transactions (requires replica set configuration)
- Follow existing hexagonal architecture with port/adapter separation
- Extend `BaseEvent` with `occurredAt` timestamp for outbox ordering
- Add `pullEvents()` to `BaseAggregate` for event extraction
- **Store session in `AppContext.db.session`** for centralized transaction access across all repositories

## 2. Change Manifest

```
CREATE:
- app/service/src/lib/outbox/outbox-event-model.ts                      - Outbox event MongoDB model type
- app/service/src/lib/outbox/outbox-event-mapper.ts                     - Maps BaseEvent to OutboxEventModel
- app/service/src/lib/outbox/port/outbox-repository-port.ts             - Outbox repository interface
- app/service/src/lib/outbox/adapter/outbox-mongo-repository-adapter.ts - MongoDB outbox implementation
- app/service/src/lib/outbox/adapter/outbox-mongo-repository-adapter.test.ts - Unit tests
- app/service/src/lib/unit-of-work/port/unit-of-work-port.ts            - UoW interface
- app/service/src/lib/unit-of-work/adapter/mongo-unit-of-work-adapter.ts - MongoDB UoW implementation
- app/service/src/lib/unit-of-work/adapter/mongo-unit-of-work-adapter.test.ts - Unit tests
- scripts/mongo-init.js                                                  - Replica set init script

MODIFY:
- app/service/src/lib/domain/base-event.ts                              - Add occurredAt field
- app/service/src/lib/domain/base-aggregate.ts                          - Add pullEvents() method
- app/service/src/lib/app-config.ts                                     - Add transaction timeout config
- app/service/src/lib/app-context.ts                                    - Add db.session to context
- app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-repository-adapter.ts - Access session via ctx.db.session
- app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.ts - Integrate UoW
- app/service/src/module/prompt/adapter/inbound/http/api.ts             - Wire new dependencies
- compose.yml                                                            - Enable replica set
```

## 3. Step-by-Step Plan

---

### Step 1: Configure MongoDB Replica Set

**File:** `compose.yml`

**Action:** MODIFY

**Rationale:** MongoDB transactions require a replica set; standalone mode does not support multi-document transactions.

**Pseudocode:**

```yaml
# compose.yml

name: use-open-prompt

services:
  mongo:
    image: mongo:8.2.3-noble
    container_name: use-open-prompt-mongo
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: password
    # 1. Add replica set command
    command: ["--replSet", "rs0", "--bind_ip_all"]
    volumes:
      - mongo-data:/data/db
    # 2. Add healthcheck for replica set initialization
    healthcheck:
      test: |
        mongosh --username root --password password --eval "
          try {
            rs.status().ok
          } catch(e) {
            rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})
          }
        " --quiet
      interval: 5s
      timeout: 30s
      retries: 10
      start_period: 10s

volumes:
  mongo-data:
```

**Dependencies:** None

**Tests Required:**
- Manual verification: `docker compose down -v && docker compose up -d`
- Verify replica set: `mongosh --username root --password password --eval "rs.status()"`

---

### Step 2: Add Transaction Timeout to AppConfig

**File:** `app/service/src/lib/app-config.ts`

**Action:** MODIFY

**Rationale:** Transaction timeout should be configurable to handle different deployment environments and operation complexities.

**Pseudocode:**

```typescript
// app/service/src/lib/app-config.ts

import { z } from "zod/v4";

export const appConfigSchema = z.object({
  app: z.object({
    env: z.string(),
    version: z.string(),
  }),

  mongo: z.object({
    uri: z.string(),
    // 1. Add transaction timeout in milliseconds
    // Default 30000ms (30 seconds), max 60000ms (1 minute)
    transactionTimeoutMs: z.number().min(1000).max(60000).default(30000),
  }),
});

export type AppConfig = z.output<typeof appConfigSchema>;

export const appConfig = appConfigSchema.decode({
  app: {
    env: "local",
    version: "0.0.0",
  },

  mongo: {
    uri: "mongodb://root:password@localhost:27017/?replicaSet=rs0&directConnection=true",
    transactionTimeoutMs: 30000,
  },
});
```

**Dependencies:** `zod/v4`

**Tests Required:**
- Verify default value is applied
- Verify min/max bounds validation

---

### Step 3: Extend AppContext with Database Session

**File:** `app/service/src/lib/app-context.ts`

**Action:** MODIFY

**Rationale:** Store the MongoDB session in `AppContext` so all repositories can access it via `ctx.db.session`. This keeps the repository interfaces clean and follows the existing pattern of passing context to all operations.

**Pseudocode:**

```typescript
// app/service/src/lib/app-context.ts

import type { ClientSession } from "mongodb";
import type { AppConfig } from "@/lib/app-config";
import type { AppLogger } from "@/lib/app-logger";

// 1. Define database context type
export type AppContextDb = {
  // Optional MongoDB session for transactional operations
  // When present, repositories should use this session for all operations
  session?: ClientSession;
};

// 2. Extend AppContext with db property
export type AppContext = {
  config: AppConfig;
  logger: AppLogger;
  // 3. Add db property for database-related context
  db: AppContextDb;
};

// 4. Helper to create context with session
export function withSession(ctx: AppContext, session: ClientSession): AppContext {
  return {
    ...ctx,
    db: {
      ...ctx.db,
      session,
    },
  };
}

// 5. Helper to create default context (no session)
export function createAppContext(
  config: AppConfig,
  logger: AppLogger,
): AppContext {
  return {
    config,
    logger,
    db: {},
  };
}
```

**Dependencies:**
- `mongodb` (ClientSession type)
- `@/lib/app-config`
- `@/lib/app-logger`

**Tests Required:**
- Test `withSession` creates new context with session
- Test `withSession` preserves existing context properties
- Test `createAppContext` creates context with empty db

---

### Step 4: Extend BaseEvent with occurredAt

**File:** `app/service/src/lib/domain/base-event.ts`

**Action:** MODIFY

**Rationale:** The outbox needs a timestamp to order events for sequential publishing and to track when events occurred.

> **Note:** Step numbers 4-17 were renumbered from the original 3-16 due to the addition of Step 3 (AppContext modification).

**Pseudocode:**

```typescript
// app/service/src/lib/domain/base-event.ts

import type { BaseProps } from "@/lib/domain/base-props";
import { type Id, newId } from "@/lib/id";

export class BaseEvent<T extends BaseProps> {
  id: Id;
  aggregateId: Id;
  // 1. Add occurredAt timestamp
  occurredAt: Date;
  props: T;

  constructor(aggregateId: Id, props: T) {
    this.id = newId();
    this.aggregateId = aggregateId;
    // 2. Capture timestamp at event creation
    this.occurredAt = new Date();
    this.props = props;
  }
}
```

**Dependencies:** None

**Tests Required:**
- Verify `occurredAt` is set to current time on construction
- Verify `occurredAt` is a Date instance

---

### Step 5: Add pullEvents() to BaseAggregate

**File:** `app/service/src/lib/domain/base-aggregate.ts`

**Action:** MODIFY

**Rationale:** Events need to be extracted from aggregates for persistence to the outbox, and cleared to prevent duplicate handling.

**Pseudocode:**

```typescript
// app/service/src/lib/domain/base-aggregate.ts

import { BaseEntity } from "@/lib/domain/base-entity";
import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";

export class BaseAggregate<T extends BaseProps> extends BaseEntity<T> {
  #events: BaseEvent<BaseProps>[] = [];

  addEvent(event: BaseEvent<BaseProps>) {
    this.#events.push(event);
  }

  // 1. Add pullEvents method
  // Returns all accumulated events and clears the internal array
  // This ensures events are only processed once
  pullEvents(): BaseEvent<BaseProps>[] {
    // 2. Copy events to return
    const events = [...this.#events];
    // 3. Clear internal events array
    this.#events = [];
    // 4. Return the copy
    return events;
  }

  // 5. Optional: getter for checking if there are pending events (useful for testing)
  get hasEvents(): boolean {
    return this.#events.length > 0;
  }
}
```

**Dependencies:** None

**Tests Required:**
- Test `pullEvents()` returns all added events
- Test `pullEvents()` clears internal events array
- Test subsequent `pullEvents()` returns empty array
- Test `hasEvents` returns correct boolean

---

### Step 6: Create Outbox Event Model

**File:** `app/service/src/lib/outbox/outbox-event-model.ts`

**Action:** CREATE

**Rationale:** Define the schema for outbox events stored in MongoDB, including status tracking for the publisher.

**Pseudocode:**

```typescript
// app/service/src/lib/outbox/outbox-event-model.ts

import type { BaseMongoModel } from "@/lib/mongo/base-mongo-model";

// 1. Define outbox event status
// - "pending": Event created, waiting to be published
// - "published": Event successfully published
// - "failed": Event publishing failed (after retries)
export type OutboxEventStatus = "pending" | "published" | "failed";

// 2. Define outbox event model
export type OutboxEventModel = BaseMongoModel & {
  // Aggregate that produced this event
  aggregateId: string;

  // Event type name (e.g., "PromptCreatedEvent")
  eventType: string;

  // Serialized event payload (the props)
  payload: Record<string, unknown>;

  // When the event occurred in the domain
  occurredAt: Date;

  // When the event was published (null if not yet published)
  publishedAt: Date | null;

  // Current status
  status: OutboxEventStatus;

  // Number of publish attempts (for retry tracking)
  retryCount: number;

  // Last error message if failed
  lastError: string | null;
};
```

**Dependencies:** `@/lib/mongo/base-mongo-model`

**Tests Required:**
- Type checking via TypeScript (no runtime tests needed for types)

---

### Step 7: Create Outbox Event Mapper

**File:** `app/service/src/lib/outbox/outbox-event-mapper.ts`

**Action:** CREATE

**Rationale:** Transform domain events (BaseEvent) to persistence models (OutboxEventModel) with proper serialization.

**Pseudocode:**

```typescript
// app/service/src/lib/outbox/outbox-event-mapper.ts

import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";
import type { OutboxEventModel } from "@/lib/outbox/outbox-event-model";

export class OutboxEventMapper {
  // 1. Static method to convert domain event to outbox model
  static toModel(event: BaseEvent<BaseProps>): OutboxEventModel {
    return {
      // 2. Use event's ID as document ID
      _id: event.id,

      // 3. Copy aggregate reference
      aggregateId: event.aggregateId,

      // 4. Derive event type from constructor name
      // This gives us "PromptCreatedEvent", "PromptUpdatedEvent", etc.
      eventType: event.constructor.name,

      // 5. Serialize props to plain object
      // Cast to Record<string, unknown> for MongoDB storage
      payload: event.props as Record<string, unknown>,

      // 6. Use event's occurredAt timestamp
      occurredAt: event.occurredAt,

      // 7. Initialize publish tracking fields
      publishedAt: null,
      status: "pending",
      retryCount: 0,
      lastError: null,
    };
  }

  // 8. Batch conversion helper
  static toModels(events: BaseEvent<BaseProps>[]): OutboxEventModel[] {
    return events.map((event) => OutboxEventMapper.toModel(event));
  }
}
```

**Dependencies:**
- `@/lib/domain/base-event`
- `@/lib/domain/base-props`
- `@/lib/outbox/outbox-event-model`

**Tests Required:**
- Test `toModel` creates correct model from event
- Test `eventType` is derived from constructor name
- Test `status` defaults to "pending"
- Test `publishedAt` defaults to null
- Test `toModels` batch conversion

---

### Step 8: Create Outbox Repository Port

**File:** `app/service/src/lib/outbox/port/outbox-repository-port.ts`

**Action:** CREATE

**Rationale:** Define the interface for outbox persistence operations following hexagonal architecture. Uses `AppContext` to access session via `ctx.db.session`.

**Pseudocode:**

```typescript
// app/service/src/lib/outbox/port/outbox-repository-port.ts

import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { OutboxEventModel } from "@/lib/outbox/outbox-event-model";

// 1. Define outbox repository interface
export interface OutboxRepositoryPort {
  // 2. Insert multiple events in a single operation
  // ctx: AppContext containing optional db.session for transactional writes
  // Returns: Result with void on success, AppError on failure
  insertMany(
    ctx: AppContext,
    events: OutboxEventModel[],
  ): Promise<Result<void, AppError>>;

  // 3. Future methods for event publisher (not implemented in this phase)
  // findPendingEvents(ctx: AppContext, limit: number): Promise<Result<OutboxEventModel[], AppError>>;
  // markAsPublished(ctx: AppContext, eventId: Id): Promise<Result<void, AppError>>;
  // markAsFailed(ctx: AppContext, eventId: Id, error: string): Promise<Result<void, AppError>>;
}
```

**Dependencies:**
- `neverthrow` (Result type)
- `@/lib/app-context`
- `@/lib/app-error`
- `@/lib/outbox/outbox-event-model`

**Tests Required:**
- Interface tests via implementation tests

---

### Step 9: Create Outbox MongoDB Repository Adapter

**File:** `app/service/src/lib/outbox/adapter/outbox-mongo-repository-adapter.ts`

**Action:** CREATE

**Rationale:** Implement the outbox repository port for MongoDB storage. Accesses session via `ctx.db.session` for transaction support.

**Pseudocode:**

```typescript
// app/service/src/lib/outbox/adapter/outbox-mongo-repository-adapter.ts

import { attemptAsync, isNil } from "es-toolkit";
import type { Collection } from "mongodb";
import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type { OutboxEventModel } from "@/lib/outbox/outbox-event-model";
import type { OutboxRepositoryPort } from "@/lib/outbox/port/outbox-repository-port";

export class OutboxMongoRepositoryAdapter implements OutboxRepositoryPort {
  // 1. Private collection reference
  #collection: Collection<OutboxEventModel>;

  // 2. Constructor accepts typed collection
  constructor(collection: Collection<OutboxEventModel>) {
    this.#collection = collection;
  }

  // 3. Insert multiple events
  async insertMany(
    ctx: AppContext,
    events: OutboxEventModel[],
  ): Promise<Result<void, AppError>> {
    // 4. Early return if no events to insert
    if (events.length === 0) {
      return ok(undefined);
    }

    // 5. Attempt MongoDB insertMany with session from context
    const [error] = await attemptAsync(async () => {
      // 6. Access session from ctx.db.session (may be undefined for non-transactional ops)
      await this.#collection.insertMany(events, { session: ctx.db.session });
    });

    // 7. Return error result if operation failed
    if (!isNil(error)) {
      return err(AppError.from(error));
    }

    // 8. Return success result
    return ok(undefined);
  }
}
```

**Dependencies:**
- `es-toolkit` (attemptAsync, isNil)
- `mongodb` (Collection)
- `neverthrow` (Result, ok, err)
- `@/lib/app-context`
- `@/lib/app-error`
- `@/lib/outbox/outbox-event-model`
- `@/lib/outbox/port/outbox-repository-port`

**Tests Required:**
- Test successful insertion of single event
- Test successful insertion of multiple events
- Test empty events array returns ok
- Test error handling when MongoDB fails
- Test session from ctx.db.session is passed to MongoDB operation

---

### Step 10: Create Unit of Work Port

**File:** `app/service/src/lib/unit-of-work/port/unit-of-work-port.ts`

**Action:** CREATE

**Rationale:** Define the Unit of Work interface that coordinates transactional operations across repositories. Uses `AppContext` with session embedded in `ctx.db.session`.

**Pseudocode:**

```typescript
// app/service/src/lib/unit-of-work/port/unit-of-work-port.ts

import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";

// 1. Define the work function type
// Receives an AppContext with db.session populated and returns a Result
export type UnitOfWorkFn<T> = (
  ctx: AppContext,
) => Promise<Result<T, AppError>>;

// 2. Define Unit of Work interface
export interface UnitOfWorkPort {
  // 3. Execute work within a transaction
  // - Creates a session
  // - Starts a transaction
  // - Creates new AppContext with session via withSession()
  // - Executes the work function with the new context
  // - Commits on success (Result.isOk())
  // - Aborts on failure (Result.isErr())
  // - Always ends the session
  execute<T>(ctx: AppContext, work: UnitOfWorkFn<T>): Promise<Result<T, AppError>>;
}
```

**Dependencies:**
- `neverthrow` (Result type)
- `@/lib/app-context`
- `@/lib/app-error`

**Tests Required:**
- Interface tests via implementation tests

---

### Step 11: Create MongoDB Unit of Work Adapter

**File:** `app/service/src/lib/unit-of-work/adapter/mongo-unit-of-work-adapter.ts`

**Action:** CREATE

**Rationale:** Implement the UoW pattern using MongoDB sessions and transactions with proper error handling and cleanup. Uses `withSession()` to create a new context with the session.

**Pseudocode:**

```typescript
// app/service/src/lib/unit-of-work/adapter/mongo-unit-of-work-adapter.ts

import { attemptAsync, isNil } from "es-toolkit";
import type { MongoClient } from "mongodb";
import { type Result, err } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { withSession } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type {
  UnitOfWorkFn,
  UnitOfWorkPort,
} from "@/lib/unit-of-work/port/unit-of-work-port";

// 1. Configuration options for UoW
export type MongoUnitOfWorkOptions = {
  // Transaction timeout in milliseconds
  transactionTimeoutMs: number;
};

export class MongoUnitOfWorkAdapter implements UnitOfWorkPort {
  // 2. Private MongoDB client reference
  #client: MongoClient;
  // 3. Private options
  #options: MongoUnitOfWorkOptions;

  // 4. Constructor accepts MongoClient and options
  constructor(client: MongoClient, options: MongoUnitOfWorkOptions) {
    this.#client = client;
    this.#options = options;
  }

  // 5. Execute work within a transaction
  async execute<T>(
    ctx: AppContext,
    work: UnitOfWorkFn<T>,
  ): Promise<Result<T, AppError>> {
    // 6. Start a new session
    const session = this.#client.startSession();

    try {
      // 7. Start transaction with timeout
      session.startTransaction({
        maxCommitTimeMS: this.#options.transactionTimeoutMs,
      });

      // 8. Create new context with session using withSession helper
      const txCtx = withSession(ctx, session);

      // 9. Execute the work function with the transactional context
      const result = await work(txCtx);

      // 10. Check result and commit or abort
      if (result.isOk()) {
        // 11. Commit transaction on success
        const [commitError] = await attemptAsync(async () => {
          await session.commitTransaction();
        });

        // 12. If commit fails, return error
        if (!isNil(commitError)) {
          return err(AppError.from(commitError));
        }
      } else {
        // 13. Abort transaction on business error
        const [abortError] = await attemptAsync(async () => {
          await session.abortTransaction();
        });

        // 14. Log abort error but return original error
        if (!isNil(abortError)) {
          console.error("Failed to abort transaction:", abortError);
        }
      }

      // 15. Return the work function's result
      return result;
    } catch (error) {
      // 16. Handle unexpected errors during execution
      // Attempt to abort the transaction
      const [abortError] = await attemptAsync(async () => {
        await session.abortTransaction();
      });

      if (!isNil(abortError)) {
        console.error("Failed to abort transaction after error:", abortError);
      }

      // 17. Return wrapped error
      return err(AppError.from(error));
    } finally {
      // 18. Always end the session
      await session.endSession();
    }
  }
}
```

**Dependencies:**
- `es-toolkit` (attemptAsync, isNil)
- `mongodb` (MongoClient)
- `neverthrow` (Result, err)
- `@/lib/app-context` (withSession)
- `@/lib/app-error`
- `@/lib/unit-of-work/port/unit-of-work-port`

**Tests Required:**
- Test successful transaction commit when work returns ok
- Test transaction abort when work returns err
- Test session is always ended (even on error)
- Test commit error is returned
- Test unexpected exception handling
- Test timeout configuration is passed
- Test context passed to work function has db.session populated

---

### Step 12: Prompt Repository Port (No Changes Needed)

**File:** `app/service/src/module/prompt/port/outbound/persistence/prompt-repository-port.ts`

**Action:** NO CHANGE

**Rationale:** The port interface does not need modification. Since session is now accessed via `ctx.db.session`, the existing interface with `AppContext` parameter already supports transactional operations. Repositories will access `ctx.db.session` internally.

**Existing Interface (unchanged):**

```typescript
// app/service/src/module/prompt/port/outbound/persistence/prompt-repository-port.ts

import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";

export interface PromptRepositoryPort {
  // ctx now contains db.session when running in a transaction
  insertOne(
    ctx: AppContext,
    data: PromptAggregate,
  ): Promise<Result<PromptAggregate, AppError>>;

  findMany(
    ctx: AppContext,
  ): Promise<Result<PromptAggregate[], AppError>>;
}
```

**Dependencies:** None (no changes)

**Tests Required:** None (no changes to interface)

---

### Step 13: Update Prompt MongoDB Repository Adapter

**File:** `app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-repository-adapter.ts`

**Action:** MODIFY

**Rationale:** Access session from `ctx.db.session` to enable transactional writes. The method signatures remain unchanged.

**Pseudocode:**

```typescript
// app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-repository-adapter.ts

import { attemptAsync, isNil } from "es-toolkit";
import type { Collection } from "mongodb";
import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type { PersistenceModelMapper } from "@/lib/mapper/persistence-model-mapper";
import type { PromptMongoModel } from "@/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type { PromptRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-repository-port";

export class PromptMongoRepository implements PromptRepositoryPort {
  #collection: Collection<PromptMongoModel>;
  #mapper: PersistenceModelMapper<PromptAggregate, PromptMongoModel>;

  constructor(
    collection: Collection<PromptMongoModel>,
    mapper: PersistenceModelMapper<PromptAggregate, PromptMongoModel>,
  ) {
    this.#collection = collection;
    this.#mapper = mapper;
  }

  // 1. Access session from ctx.db.session
  async insertOne(
    ctx: AppContext,
    data: PromptAggregate,
  ): Promise<Result<PromptAggregate, AppError>> {
    const model = this.#mapper.fromDomain(data);
    const [error] = await attemptAsync(
      // 2. Pass session from context (may be undefined for non-transactional ops)
      async () => await this.#collection.insertOne(model, { session: ctx.db.session }),
    );
    return !isNil(error) ? err(AppError.from(error)) : ok(data);
  }

  // 3. Access session from ctx.db.session for findMany
  async findMany(
    ctx: AppContext,
  ): Promise<Result<PromptAggregate[], AppError>> {
    const [error, documents] = await attemptAsync(
      // 4. Pass session from context to find operation
      async () => await this.#collection.find({}, { session: ctx.db.session }).toArray(),
    );
    if (!isNil(error) || isNil(documents)) {
      return err(AppError.from(error));
    }
    const aggregates = documents.map((doc) => this.#mapper.toDomain(doc));
    return ok(aggregates);
  }
}
```

**Dependencies:**
- `mongodb` (Collection)

**Tests Required:**
- Test insertOne with ctx.db.session populated
- Test insertOne with ctx.db.session undefined (backward compatible)
- Test findMany with ctx.db.session populated
- Test findMany with ctx.db.session undefined (backward compatible)

---

### Step 14: Update Create Prompt Use Case

**File:** `app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.ts`

**Action:** MODIFY

**Rationale:** Integrate Unit of Work and Outbox to persist aggregate and events atomically within a transaction. The UoW passes a transactional context with `db.session` populated.

**Pseudocode:**

```typescript
// app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.ts

import { type Result, err } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { UseCaseDtoMapper } from "@/lib/mapper/use-case-dto-mapper";
import { OutboxEventMapper } from "@/lib/outbox/outbox-event-mapper";
import type { OutboxRepositoryPort } from "@/lib/outbox/port/outbox-repository-port";
import type { UnitOfWorkPort } from "@/lib/unit-of-work/port/unit-of-work-port";
import { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type {
  CreatePromptUseCaseDto,
  CreatePromptUseCasePort,
} from "@/module/prompt/port/inbound/use-case/create-prompt-use-case-port";
import type { PromptUseCaseDto } from "@/module/prompt/port/inbound/use-case/prompt-use-case-dto";
import type { PromptRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-repository-port";

export class CreatePromptUseCaseAdapter implements CreatePromptUseCasePort {
  #promptDtoMapper: UseCaseDtoMapper<PromptAggregate, PromptUseCaseDto>;
  #promptRepositoryPort: PromptRepositoryPort;
  // 1. Add Unit of Work dependency
  #unitOfWork: UnitOfWorkPort;
  // 2. Add Outbox Repository dependency
  #outboxRepository: OutboxRepositoryPort;

  constructor(
    promptDtoMapper: UseCaseDtoMapper<PromptAggregate, PromptUseCaseDto>,
    promptRepositoryPort: PromptRepositoryPort,
    // 3. Accept new dependencies in constructor
    unitOfWork: UnitOfWorkPort,
    outboxRepository: OutboxRepositoryPort,
  ) {
    this.#promptDtoMapper = promptDtoMapper;
    this.#promptRepositoryPort = promptRepositoryPort;
    this.#unitOfWork = unitOfWork;
    this.#outboxRepository = outboxRepository;
  }

  async execute(
    ctx: AppContext,
    input: CreatePromptUseCaseDto,
  ): Promise<Result<PromptUseCaseDto, AppError>> {
    // 4. Wrap all operations in Unit of Work
    // UoW creates a new context with db.session populated
    return this.#unitOfWork.execute(ctx, async (txCtx) => {
      // 5. Create the aggregate (this adds events internally)
      const promptAggregate = PromptAggregate.new({
        title: input.title,
        messages: input.messages,
      });

      // 6. Save aggregate to repository within transaction
      // txCtx.db.session is automatically used by the repository
      const saveResult = await this.#promptRepositoryPort.insertOne(
        txCtx,
        promptAggregate,
      );

      // 7. Return early if save failed
      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      // 8. Pull events from aggregate (clears internal events)
      const events = promptAggregate.pullEvents();

      // 9. Convert domain events to outbox models
      const outboxModels = OutboxEventMapper.toModels(events);

      // 10. Persist events to outbox within same transaction
      // txCtx.db.session is automatically used by the repository
      const outboxResult = await this.#outboxRepository.insertMany(
        txCtx,
        outboxModels,
      );

      // 11. Return early if outbox save failed
      if (outboxResult.isErr()) {
        return err(outboxResult.error);
      }

      // 12. Return success with DTO
      // Transaction will be committed by UoW since we return Ok
      return saveResult.map(this.#promptDtoMapper.toDto);
    });
  }
}
```

**Dependencies:**
- `@/lib/outbox/outbox-event-mapper`
- `@/lib/outbox/port/outbox-repository-port`
- `@/lib/unit-of-work/port/unit-of-work-port`

**Tests Required:**
- Test successful creation persists aggregate and events
- Test rollback when aggregate save fails (no events persisted)
- Test rollback when outbox save fails (no aggregate persisted)
- Test events are pulled from aggregate after save
- Test empty events array is handled correctly
- Test txCtx passed to repositories has db.session populated

---

### Step 15: Update API Dependency Injection

**File:** `app/service/src/module/prompt/adapter/inbound/http/api.ts`

**Action:** MODIFY

**Rationale:** Wire up the new UoW and Outbox dependencies in the composition root.

**Pseudocode:**

```typescript
// app/service/src/module/prompt/adapter/inbound/http/api.ts

import { appConfig } from "@/lib/app-config";
import { mongoClient } from "@/lib/mongo/mongo-client";
import type { OutboxEventModel } from "@/lib/outbox/outbox-event-model";
import { OutboxMongoRepositoryAdapter } from "@/lib/outbox/adapter/outbox-mongo-repository-adapter";
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

// 1. Get database reference
const promptDatabase = mongoClient.db(getMongoPromptDatabase());

// 2. Existing prompt collection
const promptCollection =
  promptDatabase.collection<PromptMongoModel>(getMongoPromptCollection());

// 3. Create outbox collection reference
// Using same database as prompts, collection name "outbox_events"
const outboxCollection =
  promptDatabase.collection<OutboxEventModel>("outbox_events");

// 4. Create indexes for outbox collection (idempotent)
// Compound index for efficient polling: status + occurredAt
// This is called once at startup
outboxCollection.createIndex(
  { status: 1, occurredAt: 1 },
  { background: true },
).catch((err) => {
  console.error("Failed to create outbox index:", err);
});

// 5. Existing mappers
const promptMongoModelMapper = new PromptMongoModelMapper();
const promptUseCaseDtoMapper = new PromptUseCaseDtoMapper();

// 6. Existing repository
const promptMongoRepository = new PromptMongoRepository(
  promptCollection,
  promptMongoModelMapper,
);

// 7. Create outbox repository
const outboxRepository = new OutboxMongoRepositoryAdapter(outboxCollection);

// 8. Create Unit of Work with MongoDB client
const unitOfWork = new MongoUnitOfWorkAdapter(mongoClient, {
  transactionTimeoutMs: appConfig.mongo.transactionTimeoutMs,
});

// 9. Update CreatePromptUseCaseAdapter with new dependencies
const createPromptUseCase = new CreatePromptUseCaseAdapter(
  promptUseCaseDtoMapper,
  promptMongoRepository,
  unitOfWork,
  outboxRepository,
);

// 10. ListPrompts use case (unchanged)
const listPromptsUseCase = new ListPromptsUseCaseAdapter(
  promptUseCaseDtoMapper,
  promptMongoRepository,
);

// 11. Router factory (unchanged)
const promptHttpRouterV1Factory = new PromptRouterFactory(
  createPromptUseCase,
  listPromptsUseCase,
);
export const promptHttpRouterV1 = promptHttpRouterV1Factory.make();
```

**Dependencies:**
- `@/lib/app-config`
- `@/lib/outbox/outbox-event-model`
- `@/lib/outbox/adapter/outbox-mongo-repository-adapter`
- `@/lib/unit-of-work/adapter/mongo-unit-of-work-adapter`

**Tests Required:**
- Integration test: verify outbox collection is created
- Integration test: verify index is created on outbox collection

---

### Step 16: Create Unit Tests for Outbox Repository

**File:** `app/service/src/lib/outbox/adapter/outbox-mongo-repository-adapter.test.ts`

**Action:** CREATE

**Rationale:** Unit tests ensure the outbox repository correctly handles insertion and error cases using `ctx.db.session`.

**Pseudocode:**

```typescript
// app/service/src/lib/outbox/adapter/outbox-mongo-repository-adapter.test.ts

import { describe, expect, it, mock } from "bun:test";
import { err, ok } from "neverthrow";
import type { Collection, ClientSession } from "mongodb";
import { OutboxMongoRepositoryAdapter } from "./outbox-mongo-repository-adapter";
import type { OutboxEventModel } from "@/lib/outbox/outbox-event-model";
import type { AppContext } from "@/lib/app-context";
import type { Id } from "@/lib/id";

describe("OutboxMongoRepositoryAdapter", () => {
  // 1. Helper to create mock event
  const createMockEvent = (id: string): OutboxEventModel => ({
    _id: id as Id,
    aggregateId: "aggregate-123" as Id,
    eventType: "TestEvent",
    payload: { key: "value" },
    occurredAt: new Date(),
    publishedAt: null,
    status: "pending",
    retryCount: 0,
    lastError: null,
  });

  // 2. Helper to create mock collection
  const createMockCollection = (insertManyFn: () => Promise<unknown>) => ({
    insertMany: mock(insertManyFn),
  }) as unknown as Collection<OutboxEventModel>;

  // 3. Helper to create mock context
  const createMockContext = (session?: ClientSession): AppContext => ({
    config: {} as any,
    logger: {} as any,
    db: { session },
  });

  describe("insertMany", () => {
    it("should return ok when events are inserted successfully", async () => {
      // 4. Arrange
      const mockCollection = createMockCollection(async () => ({
        acknowledged: true,
        insertedIds: {},
      }));
      const repository = new OutboxMongoRepositoryAdapter(mockCollection);
      const events = [createMockEvent("event-1"), createMockEvent("event-2")];
      const ctx = createMockContext();

      // 5. Act
      const result = await repository.insertMany(ctx, events);

      // 6. Assert
      expect(result.isOk()).toBe(true);
      expect(mockCollection.insertMany).toHaveBeenCalledTimes(1);
    });

    it("should return ok for empty events array", async () => {
      // 7. Arrange
      const mockCollection = createMockCollection(async () => ({
        acknowledged: true,
        insertedIds: {},
      }));
      const repository = new OutboxMongoRepositoryAdapter(mockCollection);
      const ctx = createMockContext();

      // 8. Act
      const result = await repository.insertMany(ctx, []);

      // 9. Assert
      expect(result.isOk()).toBe(true);
      // Should not call MongoDB for empty array
      expect(mockCollection.insertMany).toHaveBeenCalledTimes(0);
    });

    it("should pass session from ctx.db.session to MongoDB", async () => {
      // 10. Arrange
      const mockCollection = createMockCollection(async () => ({
        acknowledged: true,
        insertedIds: {},
      }));
      const repository = new OutboxMongoRepositoryAdapter(mockCollection);
      const events = [createMockEvent("event-1")];
      const mockSession = {} as ClientSession;
      const ctx = createMockContext(mockSession);

      // 11. Act
      await repository.insertMany(ctx, events);

      // 12. Assert
      expect(mockCollection.insertMany).toHaveBeenCalledWith(events, {
        session: mockSession,
      });
    });

    it("should pass undefined session when ctx.db.session is not set", async () => {
      // 13. Arrange
      const mockCollection = createMockCollection(async () => ({
        acknowledged: true,
        insertedIds: {},
      }));
      const repository = new OutboxMongoRepositoryAdapter(mockCollection);
      const events = [createMockEvent("event-1")];
      const ctx = createMockContext(); // No session

      // 14. Act
      await repository.insertMany(ctx, events);

      // 15. Assert
      expect(mockCollection.insertMany).toHaveBeenCalledWith(events, {
        session: undefined,
      });
    });

    it("should return error when MongoDB fails", async () => {
      // 16. Arrange
      const mockError = new Error("MongoDB connection failed");
      const mockCollection = createMockCollection(async () => {
        throw mockError;
      });
      const repository = new OutboxMongoRepositoryAdapter(mockCollection);
      const events = [createMockEvent("event-1")];
      const ctx = createMockContext();

      // 17. Act
      const result = await repository.insertMany(ctx, events);

      // 18. Assert
      expect(result.isErr()).toBe(true);
    });
  });
});
```

**Dependencies:**
- `bun:test`
- `neverthrow`
- `mongodb` types
- `@/lib/app-context`

**Tests Required:**
- This IS the test file

---

### Step 17: Create Unit Tests for Unit of Work

**File:** `app/service/src/lib/unit-of-work/adapter/mongo-unit-of-work-adapter.test.ts`

**Action:** CREATE

**Rationale:** Unit tests ensure the UoW correctly manages transactions, commits, rollbacks, and passes context with `db.session`.

**Pseudocode:**

```typescript
// app/service/src/lib/unit-of-work/adapter/mongo-unit-of-work-adapter.test.ts

import { describe, expect, it, mock, beforeEach } from "bun:test";
import { err, ok } from "neverthrow";
import type { MongoClient, ClientSession } from "mongodb";
import { MongoUnitOfWorkAdapter } from "./mongo-unit-of-work-adapter";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";

describe("MongoUnitOfWorkAdapter", () => {
  // 1. Mock session factory
  const createMockSession = (options?: {
    commitError?: Error;
    abortError?: Error;
  }) => {
    const session = {
      startTransaction: mock(() => {}),
      commitTransaction: mock(async () => {
        if (options?.commitError) throw options.commitError;
      }),
      abortTransaction: mock(async () => {
        if (options?.abortError) throw options.abortError;
      }),
      endSession: mock(async () => {}),
    } as unknown as ClientSession;
    return session;
  };

  // 2. Mock client factory
  const createMockClient = (session: ClientSession) => ({
    startSession: mock(() => session),
  }) as unknown as MongoClient;

  // 3. Create base context
  const createBaseContext = (): AppContext => ({
    config: {} as any,
    logger: {} as any,
    db: {},
  });

  describe("execute", () => {
    it("should commit transaction when work returns ok", async () => {
      // 4. Arrange
      const mockSession = createMockSession();
      const mockClient = createMockClient(mockSession);
      const unitOfWork = new MongoUnitOfWorkAdapter(mockClient, {
        transactionTimeoutMs: 30000,
      });
      const ctx = createBaseContext();

      // 5. Act
      const result = await unitOfWork.execute(ctx, async (txCtx) => {
        return ok("success");
      });

      // 6. Assert
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe("success");
      expect(mockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(0);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it("should pass context with db.session populated to work function", async () => {
      // 7. Arrange
      const mockSession = createMockSession();
      const mockClient = createMockClient(mockSession);
      const unitOfWork = new MongoUnitOfWorkAdapter(mockClient, {
        transactionTimeoutMs: 30000,
      });
      const ctx = createBaseContext();
      let receivedCtx: AppContext | null = null;

      // 8. Act
      await unitOfWork.execute(ctx, async (txCtx) => {
        receivedCtx = txCtx;
        return ok("success");
      });

      // 9. Assert
      expect(receivedCtx).not.toBeNull();
      expect(receivedCtx!.db.session).toBe(mockSession);
      // Original context properties should be preserved
      expect(receivedCtx!.config).toBe(ctx.config);
      expect(receivedCtx!.logger).toBe(ctx.logger);
    });

    it("should abort transaction when work returns err", async () => {
      // 10. Arrange
      const mockSession = createMockSession();
      const mockClient = createMockClient(mockSession);
      const unitOfWork = new MongoUnitOfWorkAdapter(mockClient, {
        transactionTimeoutMs: 30000,
      });
      const ctx = createBaseContext();
      const mockError = AppError.from("unknown");

      // 11. Act
      const result = await unitOfWork.execute(ctx, async (txCtx) => {
        return err(mockError);
      });

      // 12. Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(mockError);
      expect(mockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.commitTransaction).toHaveBeenCalledTimes(0);
      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it("should return error when commit fails", async () => {
      // 13. Arrange
      const commitError = new Error("Commit failed");
      const mockSession = createMockSession({ commitError });
      const mockClient = createMockClient(mockSession);
      const unitOfWork = new MongoUnitOfWorkAdapter(mockClient, {
        transactionTimeoutMs: 30000,
      });
      const ctx = createBaseContext();

      // 14. Act
      const result = await unitOfWork.execute(ctx, async (txCtx) => {
        return ok("success");
      });

      // 15. Assert
      expect(result.isErr()).toBe(true);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it("should end session even when work throws exception", async () => {
      // 16. Arrange
      const mockSession = createMockSession();
      const mockClient = createMockClient(mockSession);
      const unitOfWork = new MongoUnitOfWorkAdapter(mockClient, {
        transactionTimeoutMs: 30000,
      });
      const ctx = createBaseContext();

      // 17. Act
      const result = await unitOfWork.execute(ctx, async (txCtx) => {
        throw new Error("Unexpected error");
      });

      // 18. Assert
      expect(result.isErr()).toBe(true);
      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it("should pass transaction options with timeout", async () => {
      // 19. Arrange
      const mockSession = createMockSession();
      const mockClient = createMockClient(mockSession);
      const unitOfWork = new MongoUnitOfWorkAdapter(mockClient, {
        transactionTimeoutMs: 15000,
      });
      const ctx = createBaseContext();

      // 20. Act
      await unitOfWork.execute(ctx, async (txCtx) => ok("success"));

      // 21. Assert
      expect(mockSession.startTransaction).toHaveBeenCalledWith({
        maxCommitTimeMS: 15000,
      });
    });
  });
});
```

**Dependencies:**
- `bun:test`
- `neverthrow`
- `mongodb` types
- `@/lib/app-context`
- `@/lib/app-error`

**Tests Required:**
- This IS the test file

---

### Step 18: Update Create Prompt Use Case Tests

**File:** `app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.test.ts`

**Action:** CREATE (if not exists) or MODIFY

**Rationale:** Update tests to verify UoW and Outbox integration with `AppContext`-based session management.

**Pseudocode:**

```typescript
// app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.test.ts

import { describe, expect, it, mock } from "bun:test";
import { err, ok } from "neverthrow";
import type { ClientSession } from "mongodb";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type { OutboxRepositoryPort } from "@/lib/outbox/port/outbox-repository-port";
import type { UnitOfWorkPort } from "@/lib/unit-of-work/port/unit-of-work-port";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type { PromptRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-repository-port";
import { CreatePromptUseCaseAdapter } from "./create-prompt-use-case-adapter";

describe("CreatePromptUseCaseAdapter", () => {
  // 1. Mock context (with db property)
  const mockCtx: AppContext = {
    config: {} as any,
    logger: { info: () => {}, error: () => {} } as any,
    db: {},
  };

  // 2. Mock DTO mapper
  const mockMapper = {
    toDto: (aggregate: PromptAggregate) => ({
      id: aggregate.id,
      title: aggregate.props.title,
      messages: aggregate.props.messages,
    }),
  };

  // 3. Helper to create mock Unit of Work
  // This UoW creates a new context with db.session populated
  const createMockUnitOfWork = (): UnitOfWorkPort => ({
    execute: mock(async (ctx, work) => {
      const mockSession = {} as ClientSession;
      const txCtx: AppContext = {
        ...ctx,
        db: { ...ctx.db, session: mockSession },
      };
      return work(txCtx);
    }),
  });

  // 4. Helper to create mock repository
  const createMockRepository = (
    insertResult: ReturnType<typeof ok<PromptAggregate, AppError>> | ReturnType<typeof err<PromptAggregate, AppError>>,
  ): PromptRepositoryPort => ({
    insertOne: mock(async () => insertResult),
    findMany: mock(async () => ok([])),
  });

  // 5. Helper to create mock outbox repository
  const createMockOutboxRepository = (
    insertResult: ReturnType<typeof ok<void, AppError>> | ReturnType<typeof err<void, AppError>>,
  ): OutboxRepositoryPort => ({
    insertMany: mock(async () => insertResult),
  });

  describe("execute", () => {
    it("should persist aggregate and events when successful", async () => {
      // 6. Arrange
      const mockUow = createMockUnitOfWork();
      const mockRepo = createMockRepository(
        ok({
          id: "test-id",
          props: {
            title: "Test",
            messages: [{ type: "instruction", content: "Test", order: 0 }],
          },
          pullEvents: () => [],
        } as unknown as PromptAggregate),
      );
      const mockOutbox = createMockOutboxRepository(ok(undefined));

      const useCase = new CreatePromptUseCaseAdapter(
        mockMapper,
        mockRepo,
        mockUow,
        mockOutbox,
      );

      // 7. Act
      const result = await useCase.execute(mockCtx, {
        title: "Test",
        messages: [{ type: "instruction", content: "Test", order: 0 }],
      });

      // 8. Assert
      expect(result.isOk()).toBe(true);
      expect(mockUow.execute).toHaveBeenCalledTimes(1);
      expect(mockRepo.insertOne).toHaveBeenCalledTimes(1);
      expect(mockOutbox.insertMany).toHaveBeenCalledTimes(1);
    });

    it("should pass context with db.session to repositories", async () => {
      // 9. Arrange
      let capturedRepoCtx: AppContext | null = null;
      let capturedOutboxCtx: AppContext | null = null;

      const mockUow = createMockUnitOfWork();
      const mockRepo: PromptRepositoryPort = {
        insertOne: mock(async (ctx) => {
          capturedRepoCtx = ctx;
          return ok({
            id: "test-id",
            props: { title: "Test", messages: [] },
            pullEvents: () => [],
          } as unknown as PromptAggregate);
        }),
        findMany: mock(async () => ok([])),
      };
      const mockOutbox: OutboxRepositoryPort = {
        insertMany: mock(async (ctx) => {
          capturedOutboxCtx = ctx;
          return ok(undefined);
        }),
      };

      const useCase = new CreatePromptUseCaseAdapter(
        mockMapper,
        mockRepo,
        mockUow,
        mockOutbox,
      );

      // 10. Act
      await useCase.execute(mockCtx, {
        title: "Test",
        messages: [],
      });

      // 11. Assert
      expect(capturedRepoCtx).not.toBeNull();
      expect(capturedRepoCtx!.db.session).toBeDefined();
      expect(capturedOutboxCtx).not.toBeNull();
      expect(capturedOutboxCtx!.db.session).toBeDefined();
    });

    it("should not persist events when aggregate save fails", async () => {
      // 12. Arrange
      const mockError = AppError.from("unknown");
      const mockUow = createMockUnitOfWork();
      const mockRepo = createMockRepository(err(mockError));
      const mockOutbox = createMockOutboxRepository(ok(undefined));

      const useCase = new CreatePromptUseCaseAdapter(
        mockMapper,
        mockRepo,
        mockUow,
        mockOutbox,
      );

      // 13. Act
      const result = await useCase.execute(mockCtx, {
        title: "Test",
        messages: [{ type: "instruction", content: "Test", order: 0 }],
      });

      // 14. Assert
      expect(result.isErr()).toBe(true);
      expect(mockOutbox.insertMany).toHaveBeenCalledTimes(0);
    });

    it("should return error when outbox save fails", async () => {
      // 15. Arrange
      const mockError = AppError.from("unknown");
      const mockUow = createMockUnitOfWork();
      const mockRepo = createMockRepository(
        ok({
          id: "test-id",
          props: {
            title: "Test",
            messages: [{ type: "instruction", content: "Test", order: 0 }],
          },
          pullEvents: () => [],
        } as unknown as PromptAggregate),
      );
      const mockOutbox = createMockOutboxRepository(err(mockError));

      const useCase = new CreatePromptUseCaseAdapter(
        mockMapper,
        mockRepo,
        mockUow,
        mockOutbox,
      );

      // 16. Act
      const result = await useCase.execute(mockCtx, {
        title: "Test",
        messages: [{ type: "instruction", content: "Test", order: 0 }],
      });

      // 17. Assert
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(mockError);
    });
  });
});
```

**Dependencies:**
- `bun:test`
- `neverthrow`
- `@/lib/app-context`
- All related types

**Tests Required:**
- This IS the test file

---

## 4. Data Changes

**Schema/Model Updates:**

```typescript
// New collection: outbox_events
// Document structure:
{
  _id: Id,              // ULID, primary key
  aggregateId: string,  // Reference to source aggregate
  eventType: string,    // Event class name (e.g., "PromptCreatedEvent")
  payload: object,      // Serialized event props
  occurredAt: Date,     // When event occurred
  publishedAt: Date | null,  // When published (null if pending)
  status: "pending" | "published" | "failed",
  retryCount: number,   // Publish attempt count
  lastError: string | null  // Last error message
}

// Indexes:
// 1. Primary key on _id (automatic)
// 2. Compound index on { status: 1, occurredAt: 1 } for efficient polling
```

**Migration Notes:**

- No migration needed for existing data
- Outbox collection is created automatically on first write
- Index is created at application startup (idempotent)
- MongoDB replica set must be configured before first transaction

## 5. Integration Points

| Service | Interaction | Error Handling |
|---------|-------------|----------------|
| MongoDB | Session & transaction management | Abort transaction, wrap in AppError |
| MongoDB | Outbox event insertion | Abort transaction on failure |
| MongoDB | Aggregate persistence | Abort transaction on failure |

## 6. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Empty events array | Skip outbox insert, return ok |
| MongoDB connection failure | Wrap in AppError, abort transaction |
| Transaction timeout | MongoDB aborts automatically, return error |
| Commit failure | Return error, session ended |
| Abort failure | Log error, still return original error |
| Aggregate without events | Works correctly, empty outbox insert skipped |
| Duplicate event ID | MongoDB throws, transaction aborts |
| Session expired | MongoDB throws, wrapped in AppError |
| Work function throws | Catch, abort, wrap in AppError |

## 7. Testing Strategy

**Unit Tests:**

- `BaseAggregate.pullEvents()` returns and clears events
- `BaseAggregate.hasEvents` returns correct boolean
- `BaseEvent.occurredAt` is set on construction
- `OutboxEventMapper.toModel()` creates correct model
- `OutboxEventMapper.toModels()` batch converts correctly
- `OutboxMongoRepositoryAdapter.insertMany()` handles success/failure
- `MongoUnitOfWorkAdapter.execute()` commits on ok, aborts on err
- `CreatePromptUseCaseAdapter.execute()` integrates UoW and Outbox

**Integration Tests:**

- Create prompt persists both aggregate and events atomically
- Failure in aggregate save rolls back (no events in outbox)
- Failure in outbox save rolls back (no aggregate persisted)
- MongoDB replica set accepts transactions
- Outbox index is created correctly

**Manual Verification:**

1. Start MongoDB with replica set:
   ```bash
   docker compose down -v && docker compose up -d
   ```

2. Wait for healthcheck to pass (replica set initialization)

3. Create a prompt via API:
   ```bash
   curl -X POST http://localhost:3000/api/v1/prompts \
     -H "Content-Type: application/json" \
     -d '{"title": "Test", "messages": [{"type": "instruction", "content": "Test", "order": 0}]}'
   ```

4. Verify prompt is in prompts collection:
   ```bash
   mongosh "mongodb://root:password@localhost:27017/use_prompt?authSource=admin&replicaSet=rs0" \
     --eval "db.prompts.find().pretty()"
   ```

5. Verify event is in outbox_events collection:
   ```bash
   mongosh "mongodb://root:password@localhost:27017/use_prompt?authSource=admin&replicaSet=rs0" \
     --eval "db.outbox_events.find().pretty()"
   ```

6. Verify outbox index exists:
   ```bash
   mongosh "mongodb://root:password@localhost:27017/use_prompt?authSource=admin&replicaSet=rs0" \
     --eval "db.outbox_events.getIndexes()"
   ```

## 8. Implementation Order

Recommended sequence for implementation:

1. **Step 1: Configure MongoDB Replica Set** - Foundation; transactions require replica set
2. **Step 2: Add Transaction Timeout to AppConfig** - Configuration needed by UoW
3. **Step 3: Extend AppContext with Database Session** - Core pattern for session propagation
4. **Step 4: Extend BaseEvent with occurredAt** - Required by outbox mapper
5. **Step 5: Add pullEvents() to BaseAggregate** - Required by use case integration
6. **Step 6: Create Outbox Event Model** - Type definition needed by mapper and repository
7. **Step 7: Create Outbox Event Mapper** - Required by use case to convert events
8. **Step 8: Create Outbox Repository Port** - Interface needed before adapter
9. **Step 9: Create Outbox MongoDB Repository Adapter** - Implementation of port
10. **Step 10: Create Unit of Work Port** - Interface needed before adapter
11. **Step 11: Create MongoDB Unit of Work Adapter** - Implementation of port
12. **Step 12: Prompt Repository Port (No Changes Needed)** - Interface already supports ctx.db.session
13. **Step 13: Update Prompt MongoDB Repository Adapter** - Access session via ctx.db.session
14. **Step 14: Update Create Prompt Use Case** - Integrate UoW and Outbox
15. **Step 15: Update API Dependency Injection** - Wire everything together
16. **Step 16-18: Create Unit Tests** - Can be done alongside implementation

**Parallelization opportunities:**
- Steps 6-9 (Outbox) can be done in parallel with Steps 10-11 (UoW)
- Test files can be written alongside their implementation files

**Key Changes from Original Plan:**
- Added Step 3 to extend `AppContext` with `db.session`
- Repository ports no longer need `session` parameter - they access via `ctx.db.session`
- UoW uses `withSession()` helper to create transactional context
- All repositories and use cases access session through `AppContext`
