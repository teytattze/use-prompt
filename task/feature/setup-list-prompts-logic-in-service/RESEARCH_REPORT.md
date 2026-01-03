# Research Report

## 1. Relevant Files

List files that will be modified or referenced, grouped by purpose:

```
Entry Points:
- app/service/src/module/prompt/adapter/inbound/http/api.ts — wires up use cases and creates the router
- app/service/src/module/prompt/adapter/inbound/http/router/prompt-router-factory.ts — defines HTTP routes, needs new GET handler

Services/Logic:
- app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.ts — reference for use case pattern
- app/service/src/module/prompt/port/inbound/use-case/create-prompt-use-case-port.ts — reference for use case port pattern
- app/service/src/lib/use-case/use-case-port.ts — base UseCasePort interface

Data Layer:
- app/service/src/module/prompt/port/outbound/persistence/prompt-repository-port.ts — needs findAll method
- app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-repository-adapter.ts — needs findAll implementation
- app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model-mapper.ts — has toDomain method (reuse)

DTOs/Schemas:
- app/service/src/module/prompt/port/inbound/use-case/prompt-use-case-dto.ts — existing PromptUseCaseDto (reuse)
- app/service/src/module/prompt/application/mapper/prompt-use-case-dto-mapper.ts — existing mapper (reuse)

Tests:
- app/service/src/module/prompt/application/use-case/list-prompts-use-case-adapter.test.ts — new unit test file
```

## 2. Dependencies & Integrations

- **Internal modules:**
  - `@/lib/use-case/use-case-port` — base use case interface
  - `@/lib/http/http-envelope` — API response wrapper
  - `@/lib/app-context` — request context (config, logger)
  - `@/lib/app-error` — error handling with neverthrow
  - `@/lib/http/middleware/setup-app-context-middleware` — context injection

- **External services:**
  - MongoDB — via `mongodb` package, accessed through `mongoClient`

- **Shared utilities:**
  - `neverthrow` — Result type for error handling
  - `zod` — schema validation
  - `elysia` — HTTP framework

## 3. Data Flow

```
GET /api/v1/prompt
    ↓
PromptRouterFactory.make() (GET handler)
    ↓
ListPromptsUseCaseAdapter.execute(ctx, input)
    ↓
PromptRepositoryPort.findAll(ctx)
    ↓
PromptMongoRepository.findAll() → MongoDB collection.find()
    ↓
PromptMongoModelMapper.toDomain() (for each document)
    ↓
PromptUseCaseDtoMapper.toDto() (for each aggregate)
    ↓
HttpEnvelope.ok({ data: prompts[] })
```

## 4. Impact Areas

**Direct modifications required:**

- `PromptRepositoryPort` — add `findAll` method signature
- `PromptMongoRepository` — implement `findAll` method
- `PromptRouterFactory` — add GET route handler, inject new use case
- `api.ts` — instantiate and wire `ListPromptsUseCaseAdapter`

**New files to create:**

- `list-prompts-use-case-port.ts` — use case port interface
- `list-prompts-use-case-adapter.ts` — use case implementation
- `list-prompts-use-case-adapter.test.ts` — unit test

**Indirect impacts:**

- None — this is an additive feature with no breaking changes

## 5. Implementation Constraints

**Coding patterns to follow:**

- Use `Result<T, AppError>` return type from `neverthrow`
- Use private class fields with `#` prefix (e.g., `#promptRepositoryPort`)
- Use Zod for input validation schemas
- Use `HttpEnvelope.ok({ data })` for success responses
- Follow existing naming: `{Action}{Entity}UseCasePort`, `{Action}{Entity}UseCaseAdapter`

**Validation/business rules:**

- No input validation needed for list (no filters/pagination in initial scope)
- Return empty array if no prompts exist

**Auth/permission requirements:**

- None currently (no auth middleware in existing POST endpoint)

**Performance considerations:**

- Initial implementation returns all prompts (no pagination)
- Consider adding limit/offset later for large datasets

**Testing requirements:**

- Unit test for `ListPromptsUseCaseAdapter.execute()`
- Mock `PromptRepositoryPort` using Bun's test framework
- Test success case with prompts
- Test success case with empty result
- Test error case from repository

## 6. Reference Implementations

1. **CreatePromptUseCaseAdapter** ([create-prompt-use-case-adapter.ts](app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.ts))
   - Pattern for use case with repository injection
   - Uses `#promptRepositoryPort` and `#promptDtoMapper`
   - Returns `Result<PromptUseCaseDto, AppError>`

2. **PromptRouterFactory** ([prompt-router-factory.ts](app/service/src/module/prompt/adapter/inbound/http/router/prompt-router-factory.ts))
   - Pattern for Elysia route handlers
   - Uses `HttpEnvelope` for response wrapping
   - Injects use cases via constructor
