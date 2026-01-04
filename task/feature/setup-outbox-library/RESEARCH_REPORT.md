# Research Report: setup-outbox-library

## 1. Relevant Files

### Entry Points

- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/index.ts` - Main application entry, currently only HTTP server
- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/module/prompt/adapter/inbound/http/api.ts` - DI container for prompt module, where OutboxProcessor will be wired

### Existing Outbox Infrastructure (to be refactored/extended)

- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/outbox/port/outbound/persistence/outbox-event-repository-port.ts` - Repository port (only has `insertMany`)
- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-repository-adapter.ts` - MongoDB adapter
- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model.ts` - MongoDB model with status fields
- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model-mapper.ts` - Domain to model mapper
- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-details.ts` - Collection config with index on `status` + `occurredAt`

### Domain Events

- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/domain/base-event.ts` - Base event class with `id`, `aggregateId`, `occurredAt`, `props`
- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/domain/base-aggregate.ts` - Aggregate with `addEvent()`, `pullEvents()`
- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/module/prompt/domain/event/prompt-created-event.ts` - Example domain event

### Core Infrastructure

- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/app-context.ts` - AppContext with config, logger, db session
- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/app-config.ts` - Config schema (needs outbox polling config)
- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/app-error.ts` - Error handling
- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/app-logger.ts` - Pino logger
- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/mongo/mongo-client.ts` - MongoDB client

### Tests

- `/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-repository-adapter.test.ts` - Existing repository tests

## 2. Dependencies & Integrations

### Internal Modules

- `AppContext` - Thread context for config, logger, db session
- `AppError` + `neverthrow` Result - Error handling pattern
- `BaseEvent<BaseProps>` - Domain event base class
- `OutboxEventRepositoryPort` - Needs extension for polling/updating
- `MongoClient` / `Collection` - Database access

### External Dependencies (already installed)

- `mongodb: ^7.0.0` - MongoDB driver with `findOneAndUpdate`, `find` cursor
- `neverthrow: ^8.2.0` - Result type for error handling
- `pino: ^10.1.0` - Logging
- `es-toolkit: ^1.43.0` - Utilities (`attemptAsync`, `isNil`)

### Shared Utilities

- `OutboxModelMapper` - Maps domain events to MongoDB models
- `withSession()` from `app-context.ts` - Transaction session management

## 3. Data Flow

```
[OutboxProcessor]
     |
     | 1. Poll PENDING events from outbox collection
     v
[OutboxEventRepository.findPending()]
     |
     | 2. Route event to handler based on eventType
     v
[EventHandlerRegistry.getHandler(eventType)]
     |
     | 3. Execute handler with event payload
     v
[DomainEventHandler.handle(event)]
     |
     | 4a. On success: update status to PROCESSED
     | 4b. On failure: increment retryCount, set lastError, optionally mark FAILED
     v
[OutboxEventRepository.updateStatus()]
```

**Polling Loop:**

- OutboxProcessor starts a setInterval/setTimeout loop
- Polls at configurable interval (e.g., 1000ms)
- Fetches batch of PENDING events (ordered by occurredAt ASC)
- Processes events sequentially or in parallel
- Updates status atomically after each event

## 4. Impact Areas

### Direct Modifications Required

1. **Extend `OutboxEventRepositoryPort`** - Add `findPending()`, `updateStatus()` methods
2. **Extend `OutboxEventMongoRepositoryAdapter`** - Implement new port methods
3. **Create new files in `@app/service/src/lib/outbox/`:**
   - `port/inbound/outbox-processor-port.ts` - Processor interface
   - `port/inbound/event-handler-port.ts` - Handler interface
   - `adapter/inbound/outbox-processor-adapter.ts` - Polling implementation
   - `adapter/inbound/event-handler-registry.ts` - Handler registration
   - `outbox-facade.ts` - Public facade for bounded contexts
4. **Update `app-config.ts`** - Add outbox polling configuration
5. **Update `api.ts` (prompt module)** - Wire OutboxProcessor and handlers
6. **Update `index.ts`** - Start processor alongside HTTP server

### Indirect Impacts

- Event handlers can trigger side effects (cross-aggregate reactions)
- Failed events accumulate until retry limit or manual intervention
- Processor must gracefully handle shutdown signals

## 5. Implementation Constraints

### Coding Patterns to Follow

- **Hexagonal Architecture**: Ports define interfaces, adapters implement them
- **Constructor Injection**: All dependencies passed via constructor
- **Result Type**: Use `neverthrow` Result for all fallible operations
- **AppContext Threading**: Pass context through all operations
- **Private Fields**: Use `#` for private class members
- **Zod Schemas**: Validate configuration and event payloads

### Business Rules to Enforce

- Events must be processed in order (by `occurredAt` within aggregate)
- Failed events should have retry limit before permanent FAILED status
- Max `retryCount` should be configurable
- Processor should handle concurrent access (use `findOneAndUpdate` for atomic claim)

### Configuration Requirements

```typescript
outbox: {
  pollingIntervalMs: number; // e.g., 1000
  batchSize: number; // e.g., 10
  maxRetries: number; // e.g., 3
}
```

### Performance Considerations

- Use index on `{ status: 1, occurredAt: 1 }` (already exists)
- Consider adding `{ status: 1, occurredAt: 1, retryCount: 1 }` for retry filtering
- Batch processing to reduce database round-trips
- Atomic `findOneAndUpdate` to prevent duplicate processing in multi-instance

### Testing Requirements

- Unit tests for OutboxProcessor with mocked repository
- Unit tests for EventHandlerRegistry
- Integration tests with real MongoDB for atomic operations

## 6. Reference Implementations

### Similar Existing Features

1. **`MongoUnitOfWorkAdapter`** (`/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/lib/unit-of-work/adapter/mongo-unit-of-work-adapter.ts`)
   - Shows transaction handling pattern with session
   - Error handling with `attemptAsync` and `AppError.from()`
   - Clean separation of port and adapter

2. **`CreatePromptUseCaseAdapter`** (`/Users/tattzetey/github.com/teytattze/use-prompt/agent0/app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.ts`)
   - Shows how domain events are currently published to outbox
   - Pattern for constructor injection of repository ports
   - Result chaining with neverthrow

### Outbox Model Reference

```typescript
// Existing model already has needed fields:
type OutboxEventMongoModel = {
  _id: string;
  aggregateId: string;
  eventType: string; // For handler routing
  payload: Record<string, unknown>;
  occurredAt: Date;
  publishedAt: Date | null;
  status: "PENDING" | "PUBLISHED" | "FAILED"; // Note: PUBLISHED should be PROCESSED
  retryCount: number;
  lastError: string | null;
};
```

## 7. Key Decisions for Planning Phase

1. **Status Naming**: Current model uses `PUBLISHED` - should this be renamed to `PROCESSED`?
2. **Handler Registration**: Static at startup vs. dynamic registration?
3. **Concurrency Model**: Single processor instance per app, or distributed locking?
4. **Graceful Shutdown**: How to stop polling loop and wait for in-flight processing?
5. **Error Handling Strategy**: Immediate retry vs. exponential backoff?
6. **Facade API Design**: What methods does `OutboxFacade` expose beyond event publishing?
