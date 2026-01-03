# Goal

Introduce a `Message` entity to support multi-part prompt content with different types (instruction, output template, examples), replacing the current single `body` field structure.

# Background

The current architecture has:

- `PromptAggregate` with `title` and `body` properties
- Single `body` field limits prompts to one content block
- No support for structured prompt patterns (system instructions, examples, output templates)

Modern prompt engineering requires structured prompts with multiple content blocks serving different purposes.

# Problem

1. **Single Content Block**: Current `body` field cannot represent multi-part prompts
2. **No Type Differentiation**: Cannot distinguish between instructions, examples, and output templates
3. **Limited Flexibility**: Users cannot build structured prompts with multiple sections
4. **No Ordering**: Cannot control the sequence of content blocks

# Solution

Replace the single `body` field with a `messages` array containing `Message` entities:

1. **Message Entity**: Value object with `type`, `content`, and `order` properties
2. **Tyep Enum**: Type-safe classification of message purpose
3. **Ordered Array**: Messages maintain explicit ordering for rendering

# Proposal

## Phase 1: Domain Layer

### 1.1 Create MessageType Enum

```typescript
// module/prompt/domain/entity/message-type.ts
export const MessageType = {
  INSTRUCTION: "instruction",
  OUTPUT_TEMPLATE: "output_template",
  EXAMPLE_INPUT: "example_input",
  EXAMPLE_OUTPUT: "example_output",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];
```

### 1.2 Create Message Entity Schema

```typescript
// module/prompt/domain/entity/message.ts
import { z } from "zod/v4";
import { MessageType } from "./message-type";

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

export type MessageInput = z.input<typeof messageSchema>;
export type Message = z.output<typeof messageSchema>;
```

### 1.3 Update PromptAggregateProps

Replace `body` with `messages` array:

```typescript
// module/prompt/domain/aggregate/prompt-aggregate-props.ts
import { z } from "zod/v4";
import { messageSchema } from "../entity/message";

export const promptAggregatePropsSchema = z.object({
  title: z.string().min(1).max(100),
  messages: z.array(messageSchema).min(1),
});

type PromptAggregatePropsSchema = typeof promptAggregatePropsSchema;
export type PromptAggregatePropsInput = z.input<PromptAggregatePropsSchema>;
export type PromptAggregateProps = z.output<PromptAggregatePropsSchema>;
```

### 1.4 Update PromptAggregate

```typescript
// module/prompt/domain/aggregate/prompt-aggregate.ts
export class PromptAggregate extends BaseAggregate<PromptAggregateProps> {
  constructor(id: IdInput, props: PromptAggregatePropsInput) {
    super(idSchema.parse(id), promptAggregatePropsSchema.parse(props));
  }

  static new(props: PromptAggregatePropsInput): PromptAggregate {
    const aggregate = new PromptAggregate(newId(), props);
    const event = new PromptCreatedEvent(aggregate.id, {
      title: aggregate.props.title,
      messages: aggregate.props.messages,
    });
    aggregate.addEvent(event);
    return aggregate;
  }
}
```

### 1.5 Update PromptCreatedEvent

```typescript
// module/prompt/domain/event/prompt-created-event.ts
export class PromptCreatedEvent extends BaseEvent<{
  title: string;
  messages: Message[];
}> {
  static readonly TYPE = "prompt.created";
}
```

## Phase 2: Persistence Layer

### 2.1 Update PromptMongoModel

```typescript
// module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model.ts
import type { BaseMongoModel } from "@/lib/mongo/base-mongo-model";
import type { MessageType } from "@/module/prompt/domain/entity/message-type";

export type MessageMongoModel = {
  type: MessageType;
  content: string;
  order: number;
};

export type PromptMongoModel = BaseMongoModel & {
  title: string;
  messages: MessageMongoModel[];
};
```

### 2.2 Update PromptMongoModelMapper

```typescript
// module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model-mapper.ts
export class PromptMongoModelMapper {
  static toModel(aggregate: PromptAggregate): PromptMongoModel {
    return {
      _id: aggregate.id,
      title: aggregate.props.title,
      messages: aggregate.props.messages.map((m) => ({
        type: m.type,
        content: m.content,
        order: m.order,
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  static toAggregate(model: PromptMongoModel): PromptAggregate {
    return new PromptAggregate(model._id, {
      title: model.title,
      messages: model.messages,
    });
  }
}
```

## Phase 3: Application Layer

### 3.1 Update PromptUseCaseDto

```typescript
// module/prompt/port/inbound/use-case/prompt-use-case-dto.ts
import type { Message } from "@/module/prompt/domain/entity/message";

export interface PromptDto {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.2 Update CreatePromptUseCasePort

```typescript
// module/prompt/port/inbound/use-case/create-prompt-use-case-port.ts
import type { MessageInput } from "@/module/prompt/domain/entity/message";

export interface CreatePromptUseCaseInput {
  title: string;
  messages: MessageInput[];
}

export interface CreatePromptUseCaseOutput {
  prompt: PromptDto;
}
```

### 3.3 Update PromptUseCaseDtoMapper

```typescript
// module/prompt/application/mapper/prompt-use-case-dto-mapper.ts
export class PromptUseCaseDtoMapper {
  static toDto(aggregate: PromptAggregate): PromptDto {
    return {
      id: aggregate.id,
      title: aggregate.props.title,
      messages: aggregate.props.messages,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
```

## Phase 4: HTTP Adapter Layer

### 4.1 Update Request/Response Schemas

```typescript
// module/prompt/adapter/inbound/http/router/prompt-router-factory.ts
const messageBodySchema = z.object({
  type: z.enum([
    "instruction",
    "output_template",
    "example_input",
    "example_output",
  ]),
  content: z.string().min(1).max(10000),
  order: z.number().int().nonnegative(),
});

const createPromptBodySchema = z.object({
  title: z.string().min(1).max(100),
  messages: z.array(messageBodySchema).min(1),
});
```

# File Structure

```
app/service/src/module/prompt/
├── domain/
│   ├── entity/
│   │   ├── message-type.ts           # NEW: MessageType enum
│   │   └── message.ts                # NEW: Message schema
│   ├── aggregate/
│   │   ├── prompt-aggregate-props.ts # UPDATED: messages array
│   │   └── prompt-aggregate.ts       # UPDATED: use messages
│   └── event/
│       └── prompt-created-event.ts   # UPDATED: messages payload
├── port/
│   └── inbound/use-case/
│       ├── prompt-use-case-dto.ts    # UPDATED: messages field
│       └── create-prompt-use-case-port.ts  # UPDATED: messages input
├── application/
│   ├── use-case/
│   │   └── create-prompt-use-case-adapter.ts  # UPDATED
│   └── mapper/
│       └── prompt-use-case-dto-mapper.ts      # UPDATED
└── adapter/
    ├── inbound/http/router/
    │   └── prompt-router-factory.ts  # UPDATED: request schema
    └── outbound/persistence/mongo/
        ├── prompt-mongo-model.ts     # UPDATED: messages array
        └── prompt-mongo-model-mapper.ts  # UPDATED
```

# API Changes

## POST /prompts

**Request (Before):**

```json
{
  "title": "Code Review Assistant",
  "body": "You are a code reviewer..."
}
```

**Request (After):**

```json
{
  "title": "Code Review Assistant",
  "messages": [
    {
      "type": "instruction",
      "content": "You are a code reviewer. Analyze the code for bugs and improvements.",
      "order": 0
    },
    {
      "type": "example_input",
      "content": "function add(a, b) { return a + b }",
      "order": 1
    },
    {
      "type": "example_output",
      "content": "The function looks correct but lacks type annotations.",
      "order": 2
    },
    {
      "type": "output_template",
      "content": "## Summary\n{{summary}}\n\n## Issues\n{{issues}}",
      "order": 3
    }
  ]
}
```

**Response:**

```json
{
  "data": {
    "prompt": {
      "id": "01JXYZ...",
      "title": "Code Review Assistant",
      "messages": [
        {
          "type": "instruction",
          "content": "You are a code reviewer. Analyze the code for bugs and improvements.",
          "order": 0
        },
        {
          "type": "example_input",
          "content": "function add(a, b) { return a + b }",
          "order": 1
        },
        {
          "type": "example_output",
          "content": "The function looks correct but lacks type annotations.",
          "order": 2
        },
        {
          "type": "output_template",
          "content": "## Summary\n{{summary}}\n\n## Issues\n{{issues}}",
          "order": 3
        }
      ],
      "createdAt": "2025-01-02T10:00:00Z",
      "updatedAt": "2025-01-02T10:00:00Z"
    }
  }
}
```

# Acceptance Criteria

## Phase 1: Domain Layer

- [ ] `MessageType` enum is created with `instruction`, `output_template`, `example_input`, `example_output` values
- [ ] `messageSchema` Zod schema is created with `type`, `content`, `order` properties
- [ ] `PromptAggregateProps` replaces `body` with `messages: Message[]`
- [ ] `PromptAggregate.new()` accepts `messages` array
- [ ] `PromptCreatedEvent` payload includes `messages` array
- [ ] Validation enforces at least 1 message per prompt
- [ ] Validation enforces max 10000 characters per message content

## Phase 2: Persistence Layer

- [ ] `MessageMongoModel` type is defined
- [ ] `PromptMongoModel` includes `messages` array field
- [ ] `PromptMongoModelMapper.toModel()` correctly maps messages
- [ ] `PromptMongoModelMapper.toAggregate()` correctly reconstructs messages

## Phase 3: Application Layer

- [ ] `PromptDto` includes `messages` array
- [ ] `CreatePromptUseCaseInput` accepts `messages` array
- [ ] `PromptUseCaseDtoMapper` correctly maps messages to DTO
- [ ] Existing unit tests are updated for new structure

## Phase 4: HTTP Adapter Layer

- [ ] Request body schema validates `messages` array
- [ ] Request body schema validates each message's `type`, `content`, `order`
- [ ] Response includes full `messages` array
- [ ] Invalid type values return 400 error

## Non-Functional Requirements

- [ ] Messages are stored in order within MongoDB document
- [ ] Migration script handles existing prompts (converts `body` to single `instruction` message)

# Migration Strategy

For existing prompts with `body` field, run a migration to convert:

```javascript
// MongoDB migration script
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

# Dependencies

- None (this is a foundational change)

# Future Enhancements

- [ ] Add more message roles (e.g., `system`, `user`, `assistant` for chat-style prompts)
- [ ] Add optional `label` field to messages for UI display
- [ ] Support message templates with variables (e.g., `{{input}}`)
- [ ] Validate example_input/example_output pairs appear together
