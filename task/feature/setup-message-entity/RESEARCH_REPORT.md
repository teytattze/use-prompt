# Research Report: setup-message-entity

## 1. Relevant Files

### Entry Points / HTTP Layer

- `app/service/src/module/prompt/adapter/inbound/http/router/prompt-router-factory.ts` — HTTP routes for POST/GET `/api/v1/prompt`, uses `createPromptUseCaseDtoSchema` for request validation

### Domain Layer

- `app/service/src/module/prompt/domain/aggregate/prompt-aggregate.ts` — `PromptAggregate` class with `new()` factory method, references `body` field
- `app/service/src/module/prompt/domain/aggregate/prompt-aggregate-props.ts` — `promptAggregatePropsSchema` with `title` and `body` Zod schemas
- `app/service/src/module/prompt/domain/event/prompt-created-event.ts` — `PromptCreatedEvent` with `title` and `body` payload
- `app/service/src/module/prompt/domain/entity/` — **Empty directory**, new `message-type.ts` and `message.ts` files will be created here

### Application Layer

- `app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.ts` — Creates `PromptAggregate` with `body` and `title`
- `app/service/src/module/prompt/application/use-case/list-prompts-use-case-adapter.ts` — Lists prompts, maps aggregates to DTOs
- `app/service/src/module/prompt/application/mapper/prompt-use-case-dto-mapper.ts` — Maps `PromptAggregate` to `PromptUseCaseDto`

### Port Layer

- `app/service/src/module/prompt/port/inbound/use-case/prompt-use-case-dto.ts` — DTO schema with `id`, `title`, `body`
- `app/service/src/module/prompt/port/inbound/use-case/create-prompt-use-case-port.ts` — Input schema referencing `promptAggregatePropsSchema.shape.body`
- `app/service/src/module/prompt/port/inbound/use-case/list-prompts-use-case-port.ts` — No changes needed (just returns DTOs)
- `app/service/src/module/prompt/port/outbound/persistence/prompt-repository-port.ts` — No changes needed (accepts `PromptAggregate`)

### Persistence Layer

- `app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model.ts` — MongoDB model with `title` and `body` strings
- `app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model-mapper.ts` — Maps between `PromptAggregate` and `PromptMongoModel`
- `app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-repository-adapter.ts` — No changes needed (uses mapper)

### Tests

- `app/service/src/module/prompt/application/use-case/list-prompts-use-case-adapter.test.ts` — Mock uses `body` property, needs update

### Shared Libraries

- `app/service/src/lib/id.ts` — ULID-based ID generation with Zod schema
- `app/service/src/lib/domain/base-aggregate.ts` — Base class for aggregates
- `app/service/src/lib/domain/base-event.ts` — Base class for domain events
- `app/service/src/lib/mongo/base-mongo-model.ts` — Base MongoDB model type with `_id`

## 2. Dependencies & Integrations

### Internal Modules

- `zod/v4` — All schemas use Zod v4 for validation
- `@/lib/id` — ID schema and generation via ULID
- `@/lib/domain/*` — Base classes for aggregates, entities, events
- `@/lib/mapper/*` — Mapper interfaces (`PersistenceModelMapper`, `UseCaseDtoMapper`)

### External Services

- MongoDB — Document storage, embedded arrays natively supported
- No external API dependencies for this change

### Shared Patterns

- Branded types via Zod (e.g., `.brand<"title">()`) for type safety
- `neverthrow` Result types for error handling
- Hexagonal architecture with ports/adapters

## 3. Data Flow

```
HTTP Request (messages array)
    ↓
PromptRouterFactory (validates via Zod schema)
    ↓
CreatePromptUseCaseAdapter (creates PromptAggregate.new(props))
    ↓
PromptAggregate (domain model with messages)
    ↓
PromptMongoModelMapper.fromDomain() (transforms to MongoDB model)
    ↓
PromptMongoRepository.insertOne() (persists to MongoDB)
    ↓
PromptUseCaseDtoMapper.toDto() (transforms to response DTO)
    ↓
HTTP Response (messages array)
```

## 4. Impact Areas

### Direct Modifications Required

1. **New Files (2):**
   - `domain/entity/message-type.ts` — MessageType enum
   - `domain/entity/message.ts` — Message Zod schema

2. **Domain Layer (2):**
   - `prompt-aggregate-props.ts` — Replace `body` with `messages: Message[]`
   - `prompt-created-event.ts` — Update payload to include `messages`

3. **Application Layer (2):**
   - `prompt-use-case-dto-mapper.ts` — Map `messages` instead of `body`
   - `create-prompt-use-case-adapter.ts` — Pass `messages` to aggregate

4. **Port Layer (2):**
   - `prompt-use-case-dto.ts` — Replace `body` with `messages`
   - `create-prompt-use-case-port.ts` — Update input schema for `messages`

5. **Persistence Layer (2):**
   - `prompt-mongo-model.ts` — Add `MessageMongoModel` type, update `PromptMongoModel`
   - `prompt-mongo-model-mapper.ts` — Map `messages` array

6. **Tests (1):**
   - `list-prompts-use-case-adapter.test.ts` — Update mocks to use `messages`

### Indirect Impacts

- **MongoDB Migration** — Existing documents with `body` field need migration to `messages` array
- **API Breaking Change** — POST `/api/v1/prompt` request/response structure changes

## 5. Implementation Constraints

### Coding Patterns to Follow

- Use Zod schemas for all validation (see `promptAggregatePropsSchema` pattern)
- Use branded types for domain values (e.g., `.brand<"title">()`)
- Use `const` object pattern for enums (see existing codebase patterns)
- Export both `Input` and `Output` types from Zod schemas
- Use kebab-case for file names with appropriate suffixes

### Validation Rules

- `messages` array must have at least 1 message (`.min(1)`)
- `content` max length: 10000 characters
- `order` must be non-negative integer
- `type` must be one of: `instruction`, `output_template`, `example_input`, `example_output`

### Testing Requirements

- Update existing test mocks to use `messages` array
- Ensure test helper `createMockAggregate` returns `messages` property

### Performance Considerations

- Messages stored as embedded array in MongoDB document (no joins needed)
- Order maintained by `order` field, not array index (allows reordering)

## 6. Reference Implementations

### Zod Schema Pattern

```typescript
// From: prompt-aggregate-props.ts
export const promptAggregatePropsSchema = z.object({
  title: z.string().min(1).max(100).brand<"title">(),
  body: z.string().min(1).max(10000).brand<"body">(),
});
```

### Aggregate Factory Pattern

```typescript
// From: prompt-aggregate.ts
static new(props: PromptAggregatePropsInput): PromptAggregate {
  const aggregate = new PromptAggregate(newId(), props);
  const event = new PromptCreatedEvent(aggregate.id, {
    body: aggregate.props.body,
    title: aggregate.props.title,
  });
  aggregate.addEvent(event);
  return aggregate;
}
```

### MongoDB Mapper Pattern

```typescript
// From: prompt-mongo-model-mapper.ts
fromDomain(domain: PromptAggregate): PromptMongoModel {
  return {
    _id: domain.id,
    body: domain.props.body,
    title: domain.props.title,
  };
}
```
