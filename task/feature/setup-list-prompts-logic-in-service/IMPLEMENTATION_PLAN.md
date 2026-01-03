# Implementation Plan

## 1. Implementation Summary

Implement a `GET /api/v1/prompt` endpoint following the existing hexagonal architecture patterns. This involves adding a `findMany` method to the repository layer, creating a new `ListPromptsUseCaseAdapter` use case, and wiring up a GET route handler in the router factory. The implementation reuses existing DTOs and mappers.

## 2. Change Manifest

```
CREATE:
- app/service/src/module/prompt/port/inbound/use-case/list-prompts-use-case-port.ts — use case port interface
- app/service/src/module/prompt/application/use-case/list-prompts-use-case-adapter.ts — use case implementation
- app/service/src/module/prompt/application/use-case/list-prompts-use-case-adapter.test.ts — unit tests

MODIFY:
- app/service/src/module/prompt/port/outbound/persistence/prompt-repository-port.ts — add findMany method signature
- app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-repository-adapter.ts — implement findMany method
- app/service/src/module/prompt/adapter/inbound/http/router/prompt-router-factory.ts — add GET route handler and inject new use case
- app/service/src/module/prompt/adapter/inbound/http/api.ts — instantiate and wire ListPromptsUseCaseAdapter
```

## 3. Step-by-Step Plan

### Step 1: Add findMany Method to PromptRepositoryPort

**File:** `app/service/src/module/prompt/port/outbound/persistence/prompt-repository-port.ts`

**Action:** MODIFY

**Rationale:** Define the contract for fetching all prompts from the persistence layer.

**Pseudocode:**

```typescript
import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";

export interface PromptRepositoryPort {
  insertOne(
    ctx: AppContext,
    data: PromptAggregate,
  ): Promise<Result<PromptAggregate, AppError>>;

  // NEW METHOD
  findMany(ctx: AppContext): Promise<Result<PromptAggregate[], AppError>>;
}
```

**Dependencies:** None (modifies existing interface)

**Tests Required:**

- No direct tests (interface only)

---

### Step 2: Implement findMany in PromptMongoRepository

**File:** `app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-repository-adapter.ts`

**Action:** MODIFY

**Rationale:** Implement the repository method to fetch all prompt documents from MongoDB and map them to domain aggregates.

**Pseudocode:**

```typescript
async findMany(
  _: AppContext,
): Promise<Result<PromptAggregate[], AppError>> {
  // 1. Query MongoDB for all documents
  //    - Use collection.find({}).toArray()
  //    - Wrap in attemptAsync for error handling

  // 2. Handle error case
  //    - If error is not nil, return err(AppError.from(error))

  // 3. Map documents to domain aggregates
  //    - Use this.#mapper.toDomain() for each document

  // 4. Return success with array of aggregates
  //    - Return ok(aggregates)
}
```

**Full Implementation:**

```typescript
async findMany(
  _: AppContext,
): Promise<Result<PromptAggregate[], AppError>> {
  const [error, documents] = await attemptAsync(
    async () => await this.#collection.find({}).toArray(),
  );
  if (!isNil(error)) {
    return err(AppError.from(error));
  }
  const aggregates = documents.map((doc) => this.#mapper.toDomain(doc));
  return ok(aggregates);
}
```

**Dependencies:**

- `attemptAsync` from `es-toolkit`
- `isNil` from `es-toolkit`
- `err`, `ok` from `neverthrow`
- `AppError` from `@/lib/app-error`

**Tests Required:**

- Test findMany returns array of aggregates
- Test findMany returns empty array when no documents
- Test findMany returns error on MongoDB failure

---

### Step 3: Create ListPromptsUseCasePort Interface

**File:** `app/service/src/module/prompt/port/inbound/use-case/list-prompts-use-case-port.ts`

**Action:** CREATE

**Rationale:** Define the use case port interface following the existing pattern. Since list operation has no input, use `void` as the input type.

**Pseudocode:**

```typescript
import type { UseCasePort } from "@/lib/use-case/use-case-port";
import type { PromptUseCaseDto } from "@/module/prompt/port/inbound/use-case/prompt-use-case-dto";

// Interface extends UseCasePort with void input and array of DTOs output
export interface ListPromptsUseCasePort extends UseCasePort<
  void,
  PromptUseCaseDto[]
> {}
```

**Dependencies:**

- `@/lib/use-case/use-case-port` — base UseCasePort interface
- `@/module/prompt/port/inbound/use-case/prompt-use-case-dto` — existing DTO type

**Tests Required:**

- No direct tests (interface only)

---

### Step 4: Create ListPromptsUseCaseAdapter Implementation

**File:** `app/service/src/module/prompt/application/use-case/list-prompts-use-case-adapter.ts`

**Action:** CREATE

**Rationale:** Implement the use case that orchestrates fetching prompts from the repository and mapping them to DTOs.

**Pseudocode:**

```typescript
import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { UseCaseDtoMapper } from "@/lib/mapper/use-case-dto-mapper";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type { ListPromptsUseCasePort } from "@/module/prompt/port/inbound/use-case/list-prompts-use-case-port";
import type { PromptUseCaseDto } from "@/module/prompt/port/inbound/use-case/prompt-use-case-dto";
import type { PromptRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-repository-port";

export class ListPromptsUseCaseAdapter implements ListPromptsUseCasePort {
  #promptDtoMapper: UseCaseDtoMapper<PromptAggregate, PromptUseCaseDto>;
  #promptRepositoryPort: PromptRepositoryPort;

  constructor(
    promptDtoMapper: UseCaseDtoMapper<PromptAggregate, PromptUseCaseDto>,
    promptRepositoryPort: PromptRepositoryPort,
  ) {
    // 1. Store dependencies as private fields
    this.#promptDtoMapper = promptDtoMapper;
    this.#promptRepositoryPort = promptRepositoryPort;
  }

  async execute(
    ctx: AppContext,
    _input: void,
  ): Promise<Result<PromptUseCaseDto[], AppError>> {
    // 1. Fetch all prompts from repository
    //    - Call this.#promptRepositoryPort.findMany(ctx)
    const result = await this.#promptRepositoryPort.findMany(ctx);

    // 2. Handle error case
    //    - If result.isErr(), return err(result.error)
    if (result.isErr()) {
      return err(result.error);
    }

    // 3. Map aggregates to DTOs
    //    - Use this.#promptDtoMapper.toDto() for each aggregate
    const dtos = result.value.map((aggregate) =>
      this.#promptDtoMapper.toDto(aggregate),
    );

    // 4. Return success with array of DTOs
    return ok(dtos);
  }
}
```

**Dependencies:**

- `neverthrow` — Result, err, ok
- `@/lib/app-context` — AppContext type
- `@/lib/app-error` — AppError type
- `@/lib/mapper/use-case-dto-mapper` — UseCaseDtoMapper interface
- `@/module/prompt/domain/aggregate/prompt-aggregate` — PromptAggregate type
- `@/module/prompt/port/inbound/use-case/list-prompts-use-case-port` — ListPromptsUseCasePort interface
- `@/module/prompt/port/inbound/use-case/prompt-use-case-dto` — PromptUseCaseDto type
- `@/module/prompt/port/outbound/persistence/prompt-repository-port` — PromptRepositoryPort interface

**Tests Required:**

- Test execute returns array of DTOs when prompts exist
- Test execute returns empty array when no prompts exist
- Test execute returns error when repository fails

---

### Step 5: Create Unit Tests for ListPromptsUseCaseAdapter

**File:** `app/service/src/module/prompt/application/use-case/list-prompts-use-case-adapter.test.ts`

**Action:** CREATE

**Rationale:** Verify the use case correctly orchestrates the repository and mapper, handles empty results, and propagates errors.

**Pseudocode:**

```typescript
import { describe, expect, it, mock } from "bun:test";
import { err, ok } from "neverthrow";
import { AppError } from "@/lib/app-error";
import { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import { ListPromptsUseCaseAdapter } from "./list-prompts-use-case-adapter";

describe("ListPromptsUseCaseAdapter", () => {
  // Setup: Create mock context
  const mockCtx = {
    config: {},
    logger: { info: () => {}, error: () => {} },
  } as any;

  // Setup: Create mock mapper
  const mockMapper = {
    toDto: (aggregate: PromptAggregate) => ({
      id: aggregate.id,
      title: aggregate.props.title,
      body: aggregate.props.body,
    }),
  };

  describe("execute", () => {
    it("should return array of DTOs when prompts exist", async () => {
      // 1. Arrange
      //    - Create test aggregates
      //    - Create mock repository that returns ok(aggregates)
      //    - Create use case with mocks
      // 2. Act
      //    - Call execute(ctx, undefined)
      // 3. Assert
      //    - Result is ok
      //    - Result value is array with correct DTOs
    });

    it("should return empty array when no prompts exist", async () => {
      // 1. Arrange
      //    - Create mock repository that returns ok([])
      //    - Create use case with mocks
      // 2. Act
      //    - Call execute(ctx, undefined)
      // 3. Assert
      //    - Result is ok
      //    - Result value is empty array
    });

    it("should return error when repository fails", async () => {
      // 1. Arrange
      //    - Create mock repository that returns err(AppError)
      //    - Create use case with mocks
      // 2. Act
      //    - Call execute(ctx, undefined)
      // 3. Assert
      //    - Result is err
      //    - Error is the AppError from repository
    });
  });
});
```

**Full Implementation:**

```typescript
import { describe, expect, it } from "bun:test";
import { err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type { PromptRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-repository-port";
import { ListPromptsUseCaseAdapter } from "./list-prompts-use-case-adapter";

describe("ListPromptsUseCaseAdapter", () => {
  const mockCtx = {
    config: {},
    logger: { info: () => {}, error: () => {} },
  } as unknown as AppContext;

  const mockMapper = {
    toDto: (aggregate: PromptAggregate) => ({
      id: aggregate.id,
      title: aggregate.props.title,
      body: aggregate.props.body,
    }),
  };

  describe("execute", () => {
    it("should return array of DTOs when prompts exist", async () => {
      const aggregate1 = PromptAggregate.new({
        title: "Test Title 1",
        body: "Test Body 1",
      });
      const aggregate2 = PromptAggregate.new({
        title: "Test Title 2",
        body: "Test Body 2",
      });

      const mockRepository: PromptRepositoryPort = {
        insertOne: async () => ok(aggregate1),
        findMany: async () => ok([aggregate1, aggregate2]),
      };

      const useCase = new ListPromptsUseCaseAdapter(mockMapper, mockRepository);
      const result = await useCase.execute(mockCtx, undefined);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].title).toBe("Test Title 1");
        expect(result.value[1].title).toBe("Test Title 2");
      }
    });

    it("should return empty array when no prompts exist", async () => {
      const mockRepository: PromptRepositoryPort = {
        insertOne: async () => ok({} as PromptAggregate),
        findMany: async () => ok([]),
      };

      const useCase = new ListPromptsUseCaseAdapter(mockMapper, mockRepository);
      const result = await useCase.execute(mockCtx, undefined);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(0);
      }
    });

    it("should return error when repository fails", async () => {
      const mockError = AppError.from("unknown");
      const mockRepository: PromptRepositoryPort = {
        insertOne: async () => err(mockError),
        findMany: async () => err(mockError),
      };

      const useCase = new ListPromptsUseCaseAdapter(mockMapper, mockRepository);
      const result = await useCase.execute(mockCtx, undefined);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe(mockError);
      }
    });
  });
});
```

**Dependencies:**

- `bun:test` — describe, expect, it
- `neverthrow` — err, ok
- `@/lib/app-context` — AppContext type
- `@/lib/app-error` — AppError class
- `@/module/prompt/domain/aggregate/prompt-aggregate` — PromptAggregate class
- `@/module/prompt/port/outbound/persistence/prompt-repository-port` — PromptRepositoryPort interface

**Tests Required:**

- N/A (this is the test file)

---

### Step 6: Update PromptRouterFactory to Add GET Handler

**File:** `app/service/src/module/prompt/adapter/inbound/http/router/prompt-router-factory.ts`

**Action:** MODIFY

**Rationale:** Add the GET route handler and inject the new use case into the router factory.

**Pseudocode:**

```typescript
import { Elysia } from "elysia";
import { HttpEnvelope } from "@/lib/http/http-envelope";
import { setupAppContextMiddleware } from "@/lib/http/middleware/setup-app-context-middleware";
import {
  type CreatePromptUseCasePort,
  createPromptUseCaseDtoSchema,
} from "@/module/prompt/port/inbound/use-case/create-prompt-use-case-port";
import type { ListPromptsUseCasePort } from "@/module/prompt/port/inbound/use-case/list-prompts-use-case-port";

export class PromptRouterFactory {
  #createPromptUseCase: CreatePromptUseCasePort;
  #listPromptsUseCase: ListPromptsUseCasePort;

  constructor(
    createPromptUseCase: CreatePromptUseCasePort,
    listPromptsUseCase: ListPromptsUseCasePort,
  ) {
    // 1. Store both use cases as private fields
    this.#createPromptUseCase = createPromptUseCase;
    this.#listPromptsUseCase = listPromptsUseCase;
  }

  async make() {
    return (
      new Elysia({ name: "prompt-router-v1", prefix: "/api/v1/prompt" })
        .use(setupAppContextMiddleware())
        // Existing POST handler
        .post(
          "/",
          async ({ body, ctx }) => {
            const result = await this.#createPromptUseCase.execute(ctx, body);
            if (result.isErr()) {
              return HttpEnvelope.error(result.error).toJson();
            }
            return HttpEnvelope.ok({ data: result.value }).toJson();
          },
          { body: createPromptUseCaseDtoSchema },
        )
        // NEW: GET handler
        .get("/", async ({ ctx }) => {
          // 1. Execute use case with undefined input (no input needed for list)
          const result = await this.#listPromptsUseCase.execute(ctx, undefined);

          // 2. Handle error case
          if (result.isErr()) {
            return HttpEnvelope.error(result.error).toJson();
          }

          // 3. Return success envelope with data array
          return HttpEnvelope.ok({ data: result.value }).toJson();
        })
    );
  }
}
```

**Dependencies:**

- `@/module/prompt/port/inbound/use-case/list-prompts-use-case-port` — ListPromptsUseCasePort interface

**Tests Required:**

- Integration test for GET /api/v1/prompt returns prompts
- Integration test for GET /api/v1/prompt returns empty array
- Integration test for GET /api/v1/prompt handles errors

---

### Step 7: Update api.ts to Wire ListPromptsUseCaseAdapter

**File:** `app/service/src/module/prompt/adapter/inbound/http/api.ts`

**Action:** MODIFY

**Rationale:** Instantiate the new use case and pass it to the router factory.

**Pseudocode:**

```typescript
import { mongoClient } from "@/lib/mongo/mongo-client";
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

// Existing setup
const promptCollection = mongoClient
  .db(getMongoPromptDatabase())
  .collection<PromptMongoModel>(getMongoPromptCollection());
const promptMongoModelMapper = new PromptMongoModelMapper();
const promptMongoRepository = new PromptMongoRepository(
  promptCollection,
  promptMongoModelMapper,
);

const promptUseCaseDtoMapper = new PromptUseCaseDtoMapper();
const createPromptUseCase = new CreatePromptUseCaseAdapter(
  promptUseCaseDtoMapper,
  promptMongoRepository,
);

// NEW: Instantiate ListPromptsUseCaseAdapter
const listPromptsUseCase = new ListPromptsUseCaseAdapter(
  promptUseCaseDtoMapper,
  promptMongoRepository,
);

// UPDATED: Pass both use cases to router factory
const promptHttpRouterV1Factory = new PromptRouterFactory(
  createPromptUseCase,
  listPromptsUseCase,
);
export const promptHttpRouterV1 = promptHttpRouterV1Factory.make();
```

**Dependencies:**

- `@/module/prompt/application/use-case/list-prompts-use-case-adapter` — ListPromptsUseCaseAdapter class

**Tests Required:**

- N/A (wiring only, tested via integration tests)

---

## 4. Data Changes (if applicable)

**Schema/Model Updates:**

None — reuses existing `PromptMongoModel` and `PromptAggregate`.

**Migration Notes:**

- No migrations required
- Backward compatible — only adds a new endpoint

## 5. Integration Points

| Service | Interaction                                 | Error Handling                            |
| ------- | ------------------------------------------- | ----------------------------------------- |
| MongoDB | Query all documents from prompts collection | Return `AppError` wrapped in `Result.err` |

## 6. Edge Cases & Error Handling

| Scenario                   | Handling                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------ |
| No prompts in database     | Return `HttpEnvelope.ok({ data: [] })` with empty array                              |
| MongoDB connection failure | Repository returns `err(AppError.from(error))`, propagated to HTTP as error envelope |
| MongoDB query timeout      | Handled by `attemptAsync`, wrapped as `AppError`                                     |

## 7. Testing Strategy

**Unit Tests:**

- `ListPromptsUseCaseAdapter.execute()` returns DTOs when prompts exist
- `ListPromptsUseCaseAdapter.execute()` returns empty array when no prompts
- `ListPromptsUseCaseAdapter.execute()` propagates repository errors

**Integration Tests:**

- (Optional) GET /api/v1/prompt returns 200 with prompts
- (Optional) GET /api/v1/prompt returns 200 with empty array

**Manual Verification:**

1. Start the service locally
2. Create a prompt via `POST /api/v1/prompt`
3. Call `GET /api/v1/prompt` and verify the created prompt is in the response
4. Verify response format matches `{ status: 200, code: "ok", message: "ok", data: [...] }`

## 8. Implementation Order

Recommended sequence for implementation:

1. **Step 1: PromptRepositoryPort.findMany** — Define the interface first (dependency for Step 2)
2. **Step 2: PromptMongoRepository.findMany** — Implement persistence layer (dependency for Step 4)
3. **Step 3: ListPromptsUseCasePort** — Define use case interface (dependency for Step 4 and Step 6)
4. **Step 4: ListPromptsUseCaseAdapter** — Implement use case logic (dependency for Step 5 and Step 7)
5. **Step 5: Unit tests** — Verify use case before wiring to HTTP layer
6. **Step 6: PromptRouterFactory** — Add GET handler (dependency for Step 7)
7. **Step 7: api.ts wiring** — Final integration step
