# Implementation Plan: setup-message-entity

## 1. Implementation Summary

This plan replaces the single `body` field in the prompt domain with a `messages` array of `Message` entities. Each message has a `type` (instruction, output_template, example_input, example_output), `content`, and `order`. The implementation follows the existing hexagonal architecture, updating all layers from domain through persistence to HTTP adapter while maintaining backward compatibility patterns.

## 2. Change Manifest

```
CREATE:
- app/service/src/module/prompt/domain/entity/message-type.ts — MessageType enum constant
- app/service/src/module/prompt/domain/entity/message.ts — Message Zod schema

MODIFY:
- app/service/src/module/prompt/domain/aggregate/prompt-aggregate-props.ts — Replace body with messages array
- app/service/src/module/prompt/domain/aggregate/prompt-aggregate.ts — Update new() factory to use messages
- app/service/src/module/prompt/domain/event/prompt-created-event.ts — Update payload to include messages
- app/service/src/module/prompt/port/inbound/use-case/prompt-use-case-dto.ts — Replace body with messages
- app/service/src/module/prompt/port/inbound/use-case/create-prompt-use-case-port.ts — Update input schema for messages
- app/service/src/module/prompt/application/mapper/prompt-use-case-dto-mapper.ts — Map messages instead of body
- app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.ts — Pass messages to aggregate
- app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model.ts — Add MessageMongoModel, update PromptMongoModel
- app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model-mapper.ts — Map messages array
- app/service/src/module/prompt/application/use-case/list-prompts-use-case-adapter.test.ts — Update mocks to use messages
```

## 3. Step-by-Step Plan

### Step 1: Create MessageType Enum

**File:** `app/service/src/module/prompt/domain/entity/message-type.ts`

**Action:** CREATE

**Rationale:** Define type-safe enum for message classification following the existing const object pattern.

**Pseudocode:**

```typescript
// Define MessageType as a const object for type-safe enum values
// This pattern matches existing codebase conventions

export const MessageType = {
  INSTRUCTION: "instruction",
  OUTPUT_TEMPLATE: "output_template",
  EXAMPLE_INPUT: "example_input",
  EXAMPLE_OUTPUT: "example_output",
} as const;

// Extract type from const object for TypeScript type checking
export type MessageType = (typeof MessageType)[keyof typeof MessageType];
```

**Dependencies:** None

**Tests Required:**

- Type inference works correctly (compile-time check)

---

### Step 2: Create Message Entity Schema

**File:** `app/service/src/module/prompt/domain/entity/message.ts`

**Action:** CREATE

**Rationale:** Define the Message value object schema with Zod validation.

**Pseudocode:**

```typescript
import { z } from "zod/v4";
import { MessageType } from "./message-type";

// Define Zod schema for Message entity
// 1. type: Must be one of the MessageType enum values
// 2. content: Non-empty string, max 10000 chars (matching existing body constraint)
// 3. order: Non-negative integer for explicit ordering

export const messageSchema = z.object({
  type: z.enum([
    MessageType.INSTRUCTION,
    MessageType.OUTPUT_TEMPLATE,
    MessageType.EXAMPLE_INPUT,
    MessageType.EXAMPLE_OUTPUT,
  ]),
  content: z.string().min(1).max(10000),
  order: z.number().int().nonnegative(),
});

// Export input type (before parsing) and output type (after parsing)
export type MessageInput = z.input<typeof messageSchema>;
export type Message = z.output<typeof messageSchema>;
```

**Dependencies:**

- `zod/v4`
- `./message-type` (Step 1)

**Tests Required:**

- Valid message with all fields passes validation
- Empty content fails validation
- Content exceeding 10000 chars fails validation
- Invalid type value fails validation
- Negative order fails validation
- Non-integer order fails validation

---

### Step 3: Update PromptAggregateProps Schema

**File:** `app/service/src/module/prompt/domain/aggregate/prompt-aggregate-props.ts`

**Action:** MODIFY

**Rationale:** Replace single `body` field with `messages` array.

**Pseudocode:**

```typescript
import { z } from "zod/v4";
import { messageSchema } from "../entity/message";

// Update schema to replace body with messages array
// 1. Keep title: string, min 1, max 100, branded
// 2. Replace body with messages: array of Message, min 1 required

export const promptAggregatePropsSchema = z.object({
  title: z.string().min(1).max(100).brand<"title">(),
  messages: z.array(messageSchema).min(1), // At least one message required
});

type PromptAggregatePropsSchema = typeof promptAggregatePropsSchema;
export type PromptAggregatePropsInput = z.input<PromptAggregatePropsSchema>;
export type PromptAggregateProps = z.output<PromptAggregatePropsSchema>;
```

**Dependencies:**

- `zod/v4`
- `../entity/message` (Step 2)

**Tests Required:**

- Valid props with title and messages array passes
- Empty messages array fails validation
- Props without messages field fails validation

---

### Step 4: Update PromptCreatedEvent

**File:** `app/service/src/module/prompt/domain/event/prompt-created-event.ts`

**Action:** MODIFY

**Rationale:** Update event payload to carry messages array instead of body.

**Pseudocode:**

```typescript
import { z } from "zod/v4";
import { BaseEvent } from "@/lib/domain/base-event";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt-aggregate-props";

// Update event props schema to reference new messages field
const promptCreatedEventPropsSchema = z.object({
  title: promptAggregatePropsSchema.shape.title,
  messages: promptAggregatePropsSchema.shape.messages, // Changed from body
});

type PromptCreatedEventProps = z.output<typeof promptCreatedEventPropsSchema>;

export class PromptCreatedEvent extends BaseEvent<PromptCreatedEventProps> {}
```

**Dependencies:**

- `zod/v4`
- `@/lib/domain/base-event`
- `../aggregate/prompt-aggregate-props` (Step 3)

**Tests Required:**

- Event can be created with messages payload
- Event payload contains correct messages array

---

### Step 5: Update PromptAggregate

**File:** `app/service/src/module/prompt/domain/aggregate/prompt-aggregate.ts`

**Action:** MODIFY

**Rationale:** Update factory method to use messages in event creation.

**Pseudocode:**

```typescript
import { BaseAggregate } from "@/lib/domain/base-aggregate";
import { type IdInput, idSchema, newId } from "@/lib/id";
import {
  type PromptAggregateProps,
  type PromptAggregatePropsInput,
  promptAggregatePropsSchema,
} from "@/module/prompt/domain/aggregate/prompt-aggregate-props";
import { PromptCreatedEvent } from "@/module/prompt/domain/event/prompt-created-event";

export class PromptAggregate extends BaseAggregate<PromptAggregateProps> {
  constructor(id: IdInput, props: PromptAggregatePropsInput) {
    super(idSchema.parse(id), promptAggregatePropsSchema.parse(props));
  }

  static new(props: PromptAggregatePropsInput): PromptAggregate {
    const aggregate = new PromptAggregate(newId(), props);

    // Create event with messages instead of body
    const event = new PromptCreatedEvent(aggregate.id, {
      title: aggregate.props.title,
      messages: aggregate.props.messages, // Changed from body
    });

    aggregate.addEvent(event);
    return aggregate;
  }
}
```

**Dependencies:**

- `@/lib/domain/base-aggregate`
- `@/lib/id`
- `./prompt-aggregate-props` (Step 3)
- `../event/prompt-created-event` (Step 4)

**Tests Required:**

- `PromptAggregate.new()` creates aggregate with messages
- Event is added with correct messages payload
- Aggregate props contain parsed messages

---

### Step 6: Update PromptUseCaseDto

**File:** `app/service/src/module/prompt/port/inbound/use-case/prompt-use-case-dto.ts`

**Action:** MODIFY

**Rationale:** Update DTO schema to expose messages array instead of body.

**Pseudocode:**

```typescript
import { z } from "zod/v4";
import { idSchema } from "@/lib/id";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt-aggregate-props";

// Update DTO schema to use messages instead of body
export const promptUseCaseDtoSchema = z.object({
  id: idSchema,
  title: promptAggregatePropsSchema.shape.title,
  messages: promptAggregatePropsSchema.shape.messages, // Changed from body
});

export type PromptUseCaseDto = z.output<typeof promptUseCaseDtoSchema>;
```

**Dependencies:**

- `zod/v4`
- `@/lib/id`
- `../../domain/aggregate/prompt-aggregate-props` (Step 3)

**Tests Required:**

- DTO type includes messages array
- DTO type excludes body field

---

### Step 7: Update CreatePromptUseCasePort

**File:** `app/service/src/module/prompt/port/inbound/use-case/create-prompt-use-case-port.ts`

**Action:** MODIFY

**Rationale:** Update input schema to accept messages array for prompt creation.

**Pseudocode:**

```typescript
import { z } from "zod/v4";
import type { UseCasePort } from "@/lib/use-case/use-case-port";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt-aggregate-props";
import type { PromptUseCaseDto } from "@/module/prompt/port/inbound/use-case/prompt-use-case-dto";

// Update input schema to use messages instead of body
export const createPromptUseCaseDtoSchema = z.object({
  title: promptAggregatePropsSchema.shape.title,
  messages: promptAggregatePropsSchema.shape.messages, // Changed from body
});

export type CreatePromptUseCaseDto = z.infer<
  typeof createPromptUseCaseDtoSchema
>;

export interface CreatePromptUseCasePort extends UseCasePort<
  CreatePromptUseCaseDto,
  PromptUseCaseDto
> {}
```

**Dependencies:**

- `zod/v4`
- `@/lib/use-case/use-case-port`
- `../../domain/aggregate/prompt-aggregate-props` (Step 3)
- `./prompt-use-case-dto` (Step 6)

**Tests Required:**

- Input type accepts messages array
- Validation rejects missing messages field
- Validation rejects empty messages array

---

### Step 8: Update PromptUseCaseDtoMapper

**File:** `app/service/src/module/prompt/application/mapper/prompt-use-case-dto-mapper.ts`

**Action:** MODIFY

**Rationale:** Map messages from aggregate to DTO.

**Pseudocode:**

```typescript
import type { UseCaseDtoMapper } from "@/lib/mapper/use-case-dto-mapper";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type { PromptUseCaseDto } from "@/module/prompt/port/inbound/use-case/prompt-use-case-dto";

export class PromptUseCaseDtoMapper implements UseCaseDtoMapper<
  PromptAggregate,
  PromptUseCaseDto
> {
  toDto(domain: PromptAggregate): PromptUseCaseDto {
    return {
      id: domain.id,
      title: domain.props.title,
      messages: domain.props.messages, // Changed from body
    };
  }
}
```

**Dependencies:**

- `@/lib/mapper/use-case-dto-mapper`
- `../domain/aggregate/prompt-aggregate` (Step 5)
- `../port/inbound/use-case/prompt-use-case-dto` (Step 6)

**Tests Required:**

- Mapper correctly maps aggregate messages to DTO messages
- All message fields (type, content, order) are preserved

---

### Step 9: Update CreatePromptUseCaseAdapter

**File:** `app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.ts`

**Action:** MODIFY

**Rationale:** Pass messages to aggregate instead of body.

**Pseudocode:**

```typescript
import { type Result, err } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { UseCaseDtoMapper } from "@/lib/mapper/use-case-dto-mapper";
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

  constructor(
    promptDtoMapper: UseCaseDtoMapper<PromptAggregate, PromptUseCaseDto>,
    promptRepositoryPort: PromptRepositoryPort,
  ) {
    this.#promptDtoMapper = promptDtoMapper;
    this.#promptRepositoryPort = promptRepositoryPort;
  }

  async execute(
    ctx: AppContext,
    input: CreatePromptUseCaseDto,
  ): Promise<Result<PromptUseCaseDto, AppError>> {
    // Create aggregate with messages instead of body
    const promptAggregate = PromptAggregate.new({
      title: input.title,
      messages: input.messages, // Changed from body
    });

    const result = await this.#promptRepositoryPort.insertOne(
      ctx,
      promptAggregate,
    );

    if (result.isErr()) {
      return err(result.error);
    }
    return result.map(this.#promptDtoMapper.toDto);
  }
}
```

**Dependencies:**

- `neverthrow`
- `@/lib/app-context`
- `@/lib/app-error`
- `@/lib/mapper/use-case-dto-mapper`
- `../domain/aggregate/prompt-aggregate` (Step 5)
- `../port/inbound/use-case/create-prompt-use-case-port` (Step 7)
- `../port/inbound/use-case/prompt-use-case-dto` (Step 6)
- `../port/outbound/persistence/prompt-repository-port`

**Tests Required:**

- Use case creates aggregate with correct messages
- Repository receives aggregate with messages
- Returned DTO contains messages

---

### Step 10: Update PromptMongoModel

**File:** `app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model.ts`

**Action:** MODIFY

**Rationale:** Define MongoDB model types for messages array.

**Pseudocode:**

```typescript
import type { BaseMongoModel } from "@/lib/mongo/base-mongo-model";
import type { MessageType } from "@/module/prompt/domain/entity/message-type";

// Define MessageMongoModel for embedded message documents
export type MessageMongoModel = {
  type: MessageType;
  content: string;
  order: number;
};

// Update PromptMongoModel to use messages array instead of body
export type PromptMongoModel = BaseMongoModel & {
  title: string;
  messages: MessageMongoModel[]; // Changed from body: string
};
```

**Dependencies:**

- `@/lib/mongo/base-mongo-model`
- `../../domain/entity/message-type` (Step 1)

**Tests Required:**

- Type correctly represents MongoDB document structure

---

### Step 11: Update PromptMongoModelMapper

**File:** `app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model-mapper.ts`

**Action:** MODIFY

**Rationale:** Map messages array between domain and persistence models.

**Pseudocode:**

```typescript
import type { PersistenceModelMapper } from "@/lib/mapper/persistence-model-mapper";
import type { PromptMongoModel } from "@/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model";
import { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";

export class PromptMongoModelMapper implements PersistenceModelMapper<
  PromptAggregate,
  PromptMongoModel
> {
  fromDomain(domain: PromptAggregate): PromptMongoModel {
    return {
      _id: domain.id,
      title: domain.props.title,
      // Map each message from domain to MongoDB model
      messages: domain.props.messages.map((message) => ({
        type: message.type,
        content: message.content,
        order: message.order,
      })),
    };
  }

  toDomain(model: PromptMongoModel): PromptAggregate {
    return new PromptAggregate(model._id, {
      title: model.title,
      // Map each message from MongoDB model to domain input
      messages: model.messages.map((message) => ({
        type: message.type,
        content: message.content,
        order: message.order,
      })),
    });
  }
}
```

**Dependencies:**

- `@/lib/mapper/persistence-model-mapper`
- `./prompt-mongo-model` (Step 10)
- `../../domain/aggregate/prompt-aggregate` (Step 5)

**Tests Required:**

- `fromDomain` correctly maps aggregate messages to MongoDB format
- `toDomain` correctly reconstructs aggregate from MongoDB document
- Message order is preserved through round-trip
- All message fields are correctly mapped

---

### Step 12: Update Test File

**File:** `app/service/src/module/prompt/application/use-case/list-prompts-use-case-adapter.test.ts`

**Action:** MODIFY

**Rationale:** Update mock objects to use messages instead of body.

**Pseudocode:**

```typescript
import { describe, expect, it } from "bun:test";
import { err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type { PromptRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-repository-port";
import { ListPromptsUseCaseAdapter } from "./list-prompts-use-case-adapter";

describe("ListPromptsUseCaseAdapter", () => {
  const mockCtx = {
    config: {},
    logger: { info: () => {}, error: () => {} },
  } as unknown as AppContext;

  // Update helper to create mock aggregate with messages instead of body
  const createMockAggregate = (
    id: string,
    title: string,
    messages: Array<{ type: string; content: string; order: number }>,
  ) =>
    ({
      id,
      props: { title, messages }, // Changed from body
    }) as unknown as PromptAggregate;

  // Update mapper mock to use messages
  const mockMapper = {
    toDto: (aggregate: PromptAggregate) => ({
      id: aggregate.id,
      title: aggregate.props.title,
      messages: aggregate.props.messages, // Changed from body
    }),
  };

  describe("execute", () => {
    it("should return array of DTOs when prompts exist", async () => {
      // Create test messages
      const messages1 = [
        { type: "instruction", content: "Test Content 1", order: 0 },
      ];
      const messages2 = [
        { type: "instruction", content: "Test Content 2", order: 0 },
      ];

      const aggregate1 = createMockAggregate("1", "Test Title 1", messages1);
      const aggregate2 = createMockAggregate("2", "Test Title 2", messages2);

      const mockRepository: PromptRepositoryPort = {
        insertOne: async () => ok(aggregate1),
        findMany: async () => ok([aggregate1, aggregate2]),
      };

      const useCase = new ListPromptsUseCaseAdapter(mockMapper, mockRepository);
      const result = await useCase.execute(mockCtx, undefined);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        expect(String(result.value[0]?.title)).toBe("Test Title 1");
        expect(String(result.value[1]?.title)).toBe("Test Title 2");
        // Verify messages are present
        expect(result.value[0]?.messages).toHaveLength(1);
        expect(result.value[1]?.messages).toHaveLength(1);
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

- All previous steps must be complete for types to align

**Tests Required:**

- All existing tests pass with updated mock structure
- Messages are correctly present in test assertions

---

## 4. Data Changes

**Schema/Model Updates:**

```typescript
// Before: PromptMongoModel
{
  _id: string;
  title: string;
  body: string;
}

// After: PromptMongoModel
{
  _id: string;
  title: string;
  messages: Array<{
    type:
      | "instruction"
      | "output_template"
      | "example_input"
      | "example_output";
    content: string;
    order: number;
  }>;
}
```

**Migration Notes:**

MongoDB migration script to convert existing `body` field to `messages` array:

```javascript
// Run in MongoDB shell or migration script
db.prompts.updateMany({ body: { $exists: true } }, [
  {
    $set: {
      messages: [
        {
          type: "instruction",
          content: "$body",
          order: 0,
        },
      ],
    },
  },
  { $unset: "body" },
]);
```

- Run migration before deploying new code
- Migration is idempotent (only affects documents with `body` field)
- No rollback plan needed as this is a forward-only change

## 5. Integration Points

| Service     | Interaction                                         | Error Handling                                             |
| ----------- | --------------------------------------------------- | ---------------------------------------------------------- |
| MongoDB     | Store/retrieve prompts with embedded messages array | Repository returns `AppError` via `neverthrow` Result type |
| Elysia HTTP | Validate request body schema with Zod               | 400 Bad Request on validation failure                      |

## 6. Edge Cases & Error Handling

| Scenario                      | Handling                                                |
| ----------------------------- | ------------------------------------------------------- |
| Empty messages array          | Zod validation rejects with `.min(1)` constraint        |
| Message content > 10000 chars | Zod validation rejects with `.max(10000)` constraint    |
| Invalid message type          | Zod validation rejects with `.enum()` constraint        |
| Negative order value          | Zod validation rejects with `.nonnegative()` constraint |
| Non-integer order             | Zod validation rejects with `.int()` constraint         |
| Missing required fields       | Zod validation returns detailed error messages          |
| Duplicate order values        | Allowed - order determines sequence, not uniqueness     |
| Non-sequential order values   | Allowed - order can have gaps (0, 5, 10)                |

## 7. Testing Strategy

**Unit Tests:**

1. **Message Schema Tests** (`message.test.ts` - new file)
   - Valid message passes validation
   - Invalid type fails validation
   - Empty content fails validation
   - Content > 10000 chars fails validation
   - Negative order fails validation
   - Non-integer order fails validation

2. **PromptAggregate Tests** (update existing)
   - Factory creates aggregate with messages array
   - Event contains messages payload
   - Props are correctly parsed by Zod

3. **Mapper Tests** (update existing or add new)
   - PromptMongoModelMapper correctly maps messages to/from MongoDB
   - PromptUseCaseDtoMapper correctly maps messages to DTO

**Integration Tests:**

1. **HTTP Route Tests**
   - POST /api/v1/prompt with valid messages returns 200
   - POST /api/v1/prompt with empty messages returns 400
   - POST /api/v1/prompt with invalid message type returns 400
   - GET /api/v1/prompt returns prompts with messages array

**Manual Verification:**

1. Start development server: `bun run dev`
2. Create prompt with messages:
   ```bash
   curl -X POST http://localhost:3000/api/v1/prompt \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Test Prompt",
       "messages": [
         {"type": "instruction", "content": "You are a helpful assistant.", "order": 0},
         {"type": "output_template", "content": "Response: {{response}}", "order": 1}
       ]
     }'
   ```
3. Verify response contains messages array
4. List prompts and verify messages are returned:
   ```bash
   curl http://localhost:3000/api/v1/prompt
   ```

## 8. Implementation Order

Recommended sequence for implementation:

1. **Step 1: Create MessageType enum** — No dependencies, foundational type
2. **Step 2: Create Message schema** — Depends on MessageType
3. **Step 3: Update PromptAggregateProps** — Depends on Message schema
4. **Step 4: Update PromptCreatedEvent** — Depends on updated props schema
5. **Step 5: Update PromptAggregate** — Depends on updated event
6. **Step 6: Update PromptUseCaseDto** — Depends on updated props schema
7. **Step 7: Update CreatePromptUseCasePort** — Depends on updated props schema
8. **Step 8: Update PromptUseCaseDtoMapper** — Depends on updated aggregate and DTO
9. **Step 9: Update CreatePromptUseCaseAdapter** — Depends on updated port and aggregate
10. **Step 10: Update PromptMongoModel** — Depends on MessageType
11. **Step 11: Update PromptMongoModelMapper** — Depends on updated model and aggregate
12. **Step 12: Update Test File** — After all production code is updated

**Rationale:** This order follows dependency chains from foundational types through domain, port, application, and adapter layers. Each step can be type-checked before proceeding to the next.
