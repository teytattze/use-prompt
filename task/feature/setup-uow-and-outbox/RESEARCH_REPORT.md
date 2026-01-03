# Research Report: Unit of Work and Outbox Pattern

## 1. Relevant Files

```
Entry Points:
- /Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/module/prompt/adapter/inbound/http/api.ts — DI composition root, wires dependencies
- /Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/index.ts — Application bootstrap

Domain Layer:
- /Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/lib/domain/base-aggregate.ts — Needs pullEvents() method
- /Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/lib/domain/base-event.ts — Event base class with id, aggregateId, props
- /Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/module/prompt/domain/event/prompt-created-event.ts — Example domain event

Use Cases (to be modified):
- /Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.ts — Will integrate UoW

Repository Layer:
- /Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/module/prompt/port/outbound/persistence/prompt-repository-port.ts — Needs optional ClientSession param
- /Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-repository-adapter.ts — Needs session support

Infrastructure:
- /Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/lib/mongo/mongo-client.ts — MongoClient instance for sessions
- /Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/lib/mongo/base-mongo-model.ts — Base model with _id
- /Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/lib/app-config.ts — Config schema (needs transaction timeout)

Tests:
- /Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/module/prompt/application/use-case/list-prompts-use-case-adapter.test.ts — Testing pattern reference
```

## 2. Dependencies & Integrations

**Internal Modules:**
- `neverthrow` — Result type for error handling (ok/err pattern)
- `es-toolkit` — Utility functions (attemptAsync, isNil)
- `zod/v4` — Schema validation and branded types
- `ulid` — ID generation

**External Dependencies (from package.json):**
- `mongodb` — MongoDB driver, provides `ClientSession`, `startSession()`, transactions
- No additional packages needed for UoW/Outbox implementation

**Shared Utilities to Leverage:**
- `/Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/lib/id.ts` — `newId()` for event IDs
- `/Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/lib/app-error.ts` — `AppError.from()` for error wrapping
- `/Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/lib/mapper/persistence-model-mapper.ts` — Mapper interface pattern

## 3. Data Flow

Current flow (without UoW):
```
UseCase.execute() → Repository.insertOne() → MongoDB insert
                  → Events stored in aggregate.#events (never persisted)
```

Target flow (with UoW + Outbox):
```
UseCase.execute() → UnitOfWork.execute(session =>
  1. Repository.insertOne(aggregate, session)     → MongoDB insert (in txn)
  2. aggregate.pullEvents()                        → Extract events
  3. OutboxRepo.insertMany(events, session)        → MongoDB insert (in txn)
  4. Commit transaction
)
```

## 4. Impact Areas

**Direct Modifications Required:**
- `BaseAggregate` — Add `pullEvents()` method to retrieve and clear events
- `PromptRepositoryPort` — Add optional `ClientSession` parameter to methods
- `PromptMongoRepository` — Pass session to MongoDB operations
- `CreatePromptUseCaseAdapter` — Inject UoW and OutboxRepo, wrap in transaction
- `api.ts` (DI root) — Wire up new UoW and Outbox dependencies
- `AppConfig` — Add `mongo.transactionTimeoutMs` setting
- `compose.yml` — Enable MongoDB replica set for transaction support

**New Files to Create:**
- `lib/outbox/outbox-event-model.ts` — OutboxEventModel type
- `lib/outbox/port/outbox-repository-port.ts` — Port interface
- `lib/outbox/adapter/outbox-mongo-repository-adapter.ts` — MongoDB implementation
- `lib/outbox/mapper/outbox-event-mapper.ts` — BaseEvent to OutboxEventModel mapper
- `lib/unit-of-work/port/unit-of-work-port.ts` — Port interface
- `lib/unit-of-work/adapter/mongo-unit-of-work-adapter.ts` — MongoDB implementation

**Indirect Impacts:**
- Future use cases creating aggregates will need UoW integration
- Other repository ports may need session parameter for transactional operations

## 5. Implementation Constraints

**Coding Patterns to Follow:**
- Hexagonal architecture: Port interfaces in `/port/`, Adapters in `/adapter/`
- Private fields with `#` prefix (e.g., `#events`, `#collection`)
- Constructor dependency injection
- Result pattern with `neverthrow` (ok/err, not throw)
- Zod schemas for validation with branded types
- PersistenceModelMapper pattern for domain<->model conversion
- ULID for IDs (not ObjectId)

**MongoDB Transaction Requirements:**
- MongoDB must run as replica set (standalone does not support transactions)
- Current `compose.yml` runs standalone mongo:8.2.3 — needs replica set config
- Session passed to all operations in transaction: `collection.insertOne(doc, { session })`
- Transactions require: `session.startTransaction()`, `session.commitTransaction()`, `session.abortTransaction()`, `session.endSession()`

**Validation/Business Rules:**
- Events must be persisted atomically with aggregate
- Outbox events should have: aggregateId, eventType (class name), payload, occurredAt, status
- Event status: "pending" → "published" or "failed"
- Indexes needed: `status` + `occurredAt` compound index for polling

**Testing Requirements:**
- Unit tests with mocked dependencies (see list-prompts-use-case-adapter.test.ts pattern)
- Integration tests for transaction commit/rollback behavior
- Test framework: `bun:test` with `describe`, `it`, `expect`

## 6. Reference Implementations

**Use Case Pattern:**
`/Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.ts`
- Constructor injection of mapper and repository
- Returns `Result<DTO, AppError>`
- Uses port interfaces, not concrete implementations

**Repository Pattern:**
`/Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-repository-adapter.ts`
- Takes Collection and Mapper in constructor
- Uses `attemptAsync` for error handling
- Returns `Result` types

**Test Pattern:**
`/Users/tattzetey/github.com/teytattze/use-prompt/app/service/src/module/prompt/application/use-case/list-prompts-use-case-adapter.test.ts`
- Mock dependencies inline
- Test success and error cases
- Use `describe/it` blocks

## 7. Critical Observations

**BaseEvent Missing Information:**
The current `BaseEvent` class lacks:
- `occurredAt: Date` timestamp — needed for outbox ordering
- Event type name derivation — use `constructor.name` or explicit type property

Recommendation: Either extend `BaseEvent` or derive these in the mapper:
```typescript
// In OutboxEventMapper
static toModel(event: BaseEvent<BaseProps>): OutboxEventModel {
  return {
    _id: event.id,
    aggregateId: event.aggregateId,
    eventType: event.constructor.name,
    payload: event.props,
    occurredAt: new Date(), // or extract from event if added
    publishedAt: null,
    status: "pending",
  };
}
```

**MongoDB Replica Set Configuration:**
The current `compose.yml` must be updated for transaction support. Options:
1. Use `mongo --replSet rs0` with init script
2. Use a multi-container setup with replica set initialization
3. Use MongoDB Atlas (replica set by default)

Minimal local setup (single-node replica set):
```yaml
services:
  mongo:
    image: mongo:8.2.3-noble
    command: ["--replSet", "rs0", "--bind_ip_all"]
    # Plus init container or entrypoint script to run: rs.initiate()
```

**Session Propagation:**
All repository methods that participate in transactions need `session?: ClientSession`:
```typescript
async insertOne(
  ctx: AppContext,
  data: PromptAggregate,
  session?: ClientSession,
): Promise<Result<PromptAggregate, AppError>> {
  // ...
  await this.#collection.insertOne(model, { session });
}
```
