# Goal

Implement prompt versioning that creates a new revision whenever a prompt is updated, allowing users to view the complete history of changes with no limit on revision count.

# Background

The current architecture has:

- `PromptAggregate` with `title` and `messages` properties
- No update capability for existing prompts
- No history tracking of changes
- Hexagonal architecture with ports and adapters
- MongoDB for persistence

Users need the ability to iterate on prompts while maintaining access to previous versions for comparison, rollback, or audit purposes.

# Problem

1. **No Update Support**: Cannot modify existing prompts
2. **No Version History**: Changes overwrite previous content with no record
3. **No Audit Trail**: Cannot track when and what changed
4. **No Rollback Capability**: Cannot revert to a previous version

# Solution

Implement versioning within the `prompt` bounded context using a separate collection:

1. **PromptRevisionAggregate**: Stores snapshots of prompt state at each version
2. **Revision Number on Prompt**: Tracks current version for fast access
3. **Separate Collection**: `prompt_revisions` collection for scalability
4. **Atomic Updates**: Use Unit of Work to ensure prompt update + revision creation are atomic

# Proposal

## Phase 1: Domain Layer

### 1.1 Create PromptRevisionAggregate

```typescript
// module/prompt/domain/aggregate/prompt-revision-aggregate-props.ts
import { z } from "zod/v4";
import { idSchema } from "@/lib/domain/id";
import { messageSchema } from "../entity/message";

export const promptRevisionAggregatePropsSchema = z.object({
  promptId: idSchema,
  revisionNumber: z.number().int().positive(),
  title: z.string().min(1).max(100),
  messages: z.array(messageSchema).min(1),
});

type PromptRevisionAggregatePropsSchema =
  typeof promptRevisionAggregatePropsSchema;
export type PromptRevisionAggregatePropsInput =
  z.input<PromptRevisionAggregatePropsSchema>;
export type PromptRevisionAggregateProps =
  z.output<PromptRevisionAggregatePropsSchema>;
```

```typescript
// module/prompt/domain/aggregate/prompt-revision-aggregate.ts
import { BaseAggregate } from "@/lib/domain/base-aggregate";
import { type IdInput, idSchema, newId } from "@/lib/domain/id";
import { PromptRevisionCreatedEvent } from "../event/prompt-revision-created-event";
import {
  type PromptRevisionAggregateProps,
  type PromptRevisionAggregatePropsInput,
  promptRevisionAggregatePropsSchema,
} from "./prompt-revision-aggregate-props";

export class PromptRevisionAggregate extends BaseAggregate<PromptRevisionAggregateProps> {
  constructor(id: IdInput, props: PromptRevisionAggregatePropsInput) {
    super(idSchema.parse(id), promptRevisionAggregatePropsSchema.parse(props));
  }

  static new(
    props: PromptRevisionAggregatePropsInput,
  ): PromptRevisionAggregate {
    const aggregate = new PromptRevisionAggregate(newId(), props);
    const event = new PromptRevisionCreatedEvent(aggregate.id, {
      promptId: aggregate.props.promptId,
      revisionNumber: aggregate.props.revisionNumber,
      title: aggregate.props.title,
      messages: aggregate.props.messages,
    });
    aggregate.addEvent(event);
    return aggregate;
  }
}
```

### 1.2 Update PromptAggregateProps

Add `currentRevision` field:

```typescript
// module/prompt/domain/aggregate/prompt-aggregate-props.ts
import { z } from "zod/v4";
import { messageSchema } from "../entity/message";

export const promptAggregatePropsSchema = z.object({
  title: z.string().min(1).max(100),
  messages: z.array(messageSchema).min(1),
  currentRevision: z.number().int().positive().default(1),
});

type PromptAggregatePropsSchema = typeof promptAggregatePropsSchema;
export type PromptAggregatePropsInput = z.input<PromptAggregatePropsSchema>;
export type PromptAggregateProps = z.output<PromptAggregatePropsSchema>;
```

### 1.3 Update PromptAggregate

Add `update()` method:

```typescript
// module/prompt/domain/aggregate/prompt-aggregate.ts
import { BaseAggregate } from "@/lib/domain/base-aggregate";
import { type IdInput, idSchema, newId } from "@/lib/domain/id";
import type { Message } from "../entity/message";
import { PromptCreatedEvent } from "../event/prompt-created-event";
import { PromptUpdatedEvent } from "../event/prompt-updated-event";
import {
  type PromptAggregateProps,
  type PromptAggregatePropsInput,
  promptAggregatePropsSchema,
} from "./prompt-aggregate-props";

export class PromptAggregate extends BaseAggregate<PromptAggregateProps> {
  constructor(id: IdInput, props: PromptAggregatePropsInput) {
    super(idSchema.parse(id), promptAggregatePropsSchema.parse(props));
  }

  static new(props: PromptAggregatePropsInput): PromptAggregate {
    const aggregate = new PromptAggregate(newId(), {
      ...props,
      currentRevision: 1,
    });
    const event = new PromptCreatedEvent(aggregate.id, {
      title: aggregate.props.title,
      messages: aggregate.props.messages,
    });
    aggregate.addEvent(event);
    return aggregate;
  }

  update(props: { title: string; messages: Message[] }): void {
    this.props.title = props.title;
    this.props.messages = props.messages;
    this.props.currentRevision += 1;

    const event = new PromptUpdatedEvent(this.id, {
      title: props.title,
      messages: props.messages,
      revisionNumber: this.props.currentRevision,
    });
    this.addEvent(event);
  }
}
```

### 1.4 Create Domain Events

```typescript
// module/prompt/domain/event/prompt-updated-event.ts
import { BaseEvent } from "@/lib/domain/base-event";
import type { Message } from "../entity/message";

export class PromptUpdatedEvent extends BaseEvent<{
  title: string;
  messages: Message[];
  revisionNumber: number;
}> {
  static readonly TYPE = "prompt.updated";
}
```

```typescript
// module/prompt/domain/event/prompt-revision-created-event.ts
import { BaseEvent } from "@/lib/domain/base-event";
import type { Message } from "../entity/message";

export class PromptRevisionCreatedEvent extends BaseEvent<{
  promptId: string;
  revisionNumber: number;
  title: string;
  messages: Message[];
}> {
  static readonly TYPE = "prompt-revision.created";
}
```

## Phase 2: Persistence Layer

### 2.1 Create PromptRevision Mongo Model

```typescript
// module/prompt/adapter/outbound/persistence/mongo/prompt-revision-mongo-model.ts
import type { BaseMongoModel } from "@/lib/mongo/base-mongo-model";
import type { MessageMongoModel } from "./prompt-mongo-model";

export type PromptRevisionMongoModel = BaseMongoModel & {
  promptId: string;
  revisionNumber: number;
  title: string;
  messages: MessageMongoModel[];
};
```

### 2.2 Create PromptRevision Mongo Details

```typescript
// module/prompt/adapter/outbound/persistence/mongo/prompt-revision-mongo-details.ts
export const promptRevisionMongoDetails = {
  collectionName: "prompt_revisions",
  indexes: [
    {
      key: { promptId: 1, revisionNumber: -1 },
      unique: true,
    },
    {
      key: { promptId: 1 },
    },
  ],
} as const;
```

### 2.3 Create PromptRevision Model Mapper

```typescript
// module/prompt/adapter/outbound/persistence/mongo/prompt-revision-mongo-model-mapper.ts
import type { PromptRevisionAggregate } from "@/module/prompt/domain/aggregate/prompt-revision-aggregate";
import type { PromptRevisionMongoModel } from "./prompt-revision-mongo-model";

export class PromptRevisionMongoModelMapper {
  static toModel(aggregate: PromptRevisionAggregate): PromptRevisionMongoModel {
    return {
      _id: aggregate.id,
      promptId: aggregate.props.promptId,
      revisionNumber: aggregate.props.revisionNumber,
      title: aggregate.props.title,
      messages: aggregate.props.messages.map((m) => ({
        role: m.role,
        content: m.content,
        order: m.order,
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  static toAggregate(model: PromptRevisionMongoModel): PromptRevisionAggregate {
    return new PromptRevisionAggregate(model._id, {
      promptId: model.promptId,
      revisionNumber: model.revisionNumber,
      title: model.title,
      messages: model.messages,
    });
  }
}
```

### 2.4 Create PromptRevision Repository Port

```typescript
// module/prompt/port/outbound/persistence/prompt-revision-repository-port.ts
import type { ClientSession } from "mongodb";
import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { PromptRevisionAggregate } from "@/module/prompt/domain/aggregate/prompt-revision-aggregate";

export interface PromptRevisionRepositoryPort {
  insertOne(
    ctx: AppContext,
    data: PromptRevisionAggregate,
    session?: ClientSession,
  ): Promise<Result<PromptRevisionAggregate, AppError>>;

  findByPromptId(
    ctx: AppContext,
    promptId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Result<PromptRevisionAggregate[], AppError>>;

  findByPromptIdAndRevisionNumber(
    ctx: AppContext,
    promptId: string,
    revisionNumber: number,
  ): Promise<Result<PromptRevisionAggregate | null, AppError>>;

  countByPromptId(
    ctx: AppContext,
    promptId: string,
  ): Promise<Result<number, AppError>>;
}
```

### 2.5 Update PromptRepositoryPort

Add `findById` and `updateOne` methods:

```typescript
// module/prompt/port/outbound/persistence/prompt-repository-port.ts
import type { ClientSession } from "mongodb";
import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";

export interface PromptRepositoryPort {
  insertOne(
    ctx: AppContext,
    data: PromptAggregate,
    session?: ClientSession,
  ): Promise<Result<PromptAggregate, AppError>>;

  findMany(ctx: AppContext): Promise<Result<PromptAggregate[], AppError>>;

  findById(
    ctx: AppContext,
    id: string,
  ): Promise<Result<PromptAggregate | null, AppError>>;

  updateOne(
    ctx: AppContext,
    data: PromptAggregate,
    session?: ClientSession,
  ): Promise<Result<PromptAggregate, AppError>>;
}
```

### 2.6 Update PromptMongoModel

Add `currentRevision` field:

```typescript
// module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model.ts
import type { BaseMongoModel } from "@/lib/mongo/base-mongo-model";
import type { MessageRole } from "@/module/prompt/domain/entity/message-role";

export type MessageMongoModel = {
  role: MessageRole;
  content: string;
  order: number;
};

export type PromptMongoModel = BaseMongoModel & {
  title: string;
  messages: MessageMongoModel[];
  currentRevision: number;
};
```

## Phase 3: Application Layer (Use Cases)

### 3.1 Update Prompt Use Case

```typescript
// module/prompt/port/inbound/use-case/update-prompt-use-case-port.ts
import type { UseCasePort } from "@/lib/use-case-port";
import type { MessageInput } from "@/module/prompt/domain/entity/message";
import type { PromptDto, PromptRevisionDto } from "./prompt-use-case-dto";

export interface UpdatePromptUseCaseInput {
  promptId: string;
  title: string;
  messages: MessageInput[];
}

export interface UpdatePromptUseCaseOutput {
  prompt: PromptDto;
  revision: PromptRevisionDto;
}

export interface UpdatePromptUseCasePort extends UseCasePort<
  UpdatePromptUseCaseInput,
  UpdatePromptUseCaseOutput
> {}
```

```typescript
// module/prompt/application/use-case/update-prompt-use-case-adapter.ts
import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type { UnitOfWorkPort } from "@/lib/unit-of-work/port/unit-of-work-port";
import { PromptRevisionAggregate } from "@/module/prompt/domain/aggregate/prompt-revision-aggregate";
import type {
  UpdatePromptUseCaseInput,
  UpdatePromptUseCaseOutput,
  UpdatePromptUseCasePort,
} from "@/module/prompt/port/inbound/use-case/update-prompt-use-case-port";
import type { PromptRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-repository-port";
import type { PromptRevisionRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-revision-repository-port";
import { PromptUseCaseDtoMapper } from "../mapper/prompt-use-case-dto-mapper";

export class UpdatePromptUseCaseAdapter implements UpdatePromptUseCasePort {
  constructor(
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly promptRepository: PromptRepositoryPort,
    private readonly revisionRepository: PromptRevisionRepositoryPort,
  ) {}

  async execute(
    ctx: AppContext,
    input: UpdatePromptUseCaseInput,
  ): Promise<Result<UpdatePromptUseCaseOutput, AppError>> {
    return this.unitOfWork.execute(async (session) => {
      // 1. Find existing prompt
      const promptResult = await this.promptRepository.findById(
        ctx,
        input.promptId,
      );
      if (promptResult.isErr()) return promptResult;
      if (!promptResult.value) {
        return err(AppError.notFound("Prompt not found"));
      }

      const prompt = promptResult.value;

      // 2. Create revision snapshot (BEFORE updating)
      const revision = PromptRevisionAggregate.new({
        promptId: prompt.id,
        revisionNumber: prompt.props.currentRevision,
        title: prompt.props.title,
        messages: prompt.props.messages,
      });

      const revisionResult = await this.revisionRepository.insertOne(
        ctx,
        revision,
        session,
      );
      if (revisionResult.isErr()) return revisionResult;

      // 3. Update prompt (increments currentRevision)
      prompt.update({
        title: input.title,
        messages: input.messages,
      });

      const updateResult = await this.promptRepository.updateOne(
        ctx,
        prompt,
        session,
      );
      if (updateResult.isErr()) return updateResult;

      return ok({
        prompt: PromptUseCaseDtoMapper.toDto(prompt),
        revision: PromptUseCaseDtoMapper.toRevisionDto(revision),
      });
    });
  }
}
```

### 3.2 List Prompt Revisions Use Case

```typescript
// module/prompt/port/inbound/use-case/list-prompt-revisions-use-case-port.ts
import type { UseCasePort } from "@/lib/use-case-port";
import type { PromptRevisionDto } from "./prompt-use-case-dto";

export interface ListPromptRevisionsUseCaseInput {
  promptId: string;
  limit?: number;
  offset?: number;
}

export interface ListPromptRevisionsUseCaseOutput {
  revisions: PromptRevisionDto[];
  total: number;
}

export interface ListPromptRevisionsUseCasePort extends UseCasePort<
  ListPromptRevisionsUseCaseInput,
  ListPromptRevisionsUseCaseOutput
> {}
```

```typescript
// module/prompt/application/use-case/list-prompt-revisions-use-case-adapter.ts
import { type Result, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type {
  ListPromptRevisionsUseCaseInput,
  ListPromptRevisionsUseCaseOutput,
  ListPromptRevisionsUseCasePort,
} from "@/module/prompt/port/inbound/use-case/list-prompt-revisions-use-case-port";
import type { PromptRevisionRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-revision-repository-port";
import { PromptUseCaseDtoMapper } from "../mapper/prompt-use-case-dto-mapper";

export class ListPromptRevisionsUseCaseAdapter implements ListPromptRevisionsUseCasePort {
  constructor(
    private readonly revisionRepository: PromptRevisionRepositoryPort,
  ) {}

  async execute(
    ctx: AppContext,
    input: ListPromptRevisionsUseCaseInput,
  ): Promise<Result<ListPromptRevisionsUseCaseOutput, AppError>> {
    const [revisionsResult, countResult] = await Promise.all([
      this.revisionRepository.findByPromptId(ctx, input.promptId, {
        limit: input.limit ?? 20,
        offset: input.offset ?? 0,
      }),
      this.revisionRepository.countByPromptId(ctx, input.promptId),
    ]);

    if (revisionsResult.isErr()) return revisionsResult;
    if (countResult.isErr()) return countResult;

    return ok({
      revisions: revisionsResult.value.map(
        PromptUseCaseDtoMapper.toRevisionDto,
      ),
      total: countResult.value,
    });
  }
}
```

### 3.3 Get Prompt Revision Use Case

```typescript
// module/prompt/port/inbound/use-case/get-prompt-revision-use-case-port.ts
import type { UseCasePort } from "@/lib/use-case-port";
import type { PromptRevisionDto } from "./prompt-use-case-dto";

export interface GetPromptRevisionUseCaseInput {
  promptId: string;
  revisionNumber: number;
}

export interface GetPromptRevisionUseCaseOutput {
  revision: PromptRevisionDto;
}

export interface GetPromptRevisionUseCasePort extends UseCasePort<
  GetPromptRevisionUseCaseInput,
  GetPromptRevisionUseCaseOutput
> {}
```

```typescript
// module/prompt/application/use-case/get-prompt-revision-use-case-adapter.ts
import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type {
  GetPromptRevisionUseCaseInput,
  GetPromptRevisionUseCaseOutput,
  GetPromptRevisionUseCasePort,
} from "@/module/prompt/port/inbound/use-case/get-prompt-revision-use-case-port";
import type { PromptRevisionRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-revision-repository-port";
import { PromptUseCaseDtoMapper } from "../mapper/prompt-use-case-dto-mapper";

export class GetPromptRevisionUseCaseAdapter implements GetPromptRevisionUseCasePort {
  constructor(
    private readonly revisionRepository: PromptRevisionRepositoryPort,
  ) {}

  async execute(
    ctx: AppContext,
    input: GetPromptRevisionUseCaseInput,
  ): Promise<Result<GetPromptRevisionUseCaseOutput, AppError>> {
    const result =
      await this.revisionRepository.findByPromptIdAndRevisionNumber(
        ctx,
        input.promptId,
        input.revisionNumber,
      );

    if (result.isErr()) return result;
    if (!result.value) {
      return err(AppError.notFound("Revision not found"));
    }

    return ok({
      revision: PromptUseCaseDtoMapper.toRevisionDto(result.value),
    });
  }
}
```

### 3.4 Update PromptUseCaseDto

```typescript
// module/prompt/port/inbound/use-case/prompt-use-case-dto.ts
import type { Message } from "@/module/prompt/domain/entity/message";

export interface PromptDto {
  id: string;
  title: string;
  messages: Message[];
  currentRevision: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptRevisionDto {
  id: string;
  promptId: string;
  revisionNumber: number;
  title: string;
  messages: Message[];
  createdAt: Date;
}
```

### 3.5 Update PromptUseCaseDtoMapper

```typescript
// module/prompt/application/mapper/prompt-use-case-dto-mapper.ts
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type { PromptRevisionAggregate } from "@/module/prompt/domain/aggregate/prompt-revision-aggregate";
import type {
  PromptDto,
  PromptRevisionDto,
} from "@/module/prompt/port/inbound/use-case/prompt-use-case-dto";

export class PromptUseCaseDtoMapper {
  static toDto(aggregate: PromptAggregate): PromptDto {
    return {
      id: aggregate.id,
      title: aggregate.props.title,
      messages: aggregate.props.messages,
      currentRevision: aggregate.props.currentRevision,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  static toRevisionDto(aggregate: PromptRevisionAggregate): PromptRevisionDto {
    return {
      id: aggregate.id,
      promptId: aggregate.props.promptId,
      revisionNumber: aggregate.props.revisionNumber,
      title: aggregate.props.title,
      messages: aggregate.props.messages,
      createdAt: new Date(),
    };
  }
}
```

## Phase 4: HTTP Adapter Layer

### 4.1 Update Prompt Router

```typescript
// module/prompt/adapter/inbound/http/router/prompt-router-factory.ts
// Add these routes to existing router

// PUT /prompts/:id - Update prompt (creates revision)
.put(
  "/:id",
  async ({ params, body, ...ctx }) => {
    const result = await deps.updatePromptUseCase.execute(ctx, {
      promptId: params.id,
      title: body.title,
      messages: body.messages,
    });
    return httpEnvelope(result);
  },
  {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      title: t.String({ minLength: 1, maxLength: 100 }),
      messages: t.Array(messageBodySchema, { minItems: 1 }),
    }),
  },
)

// GET /prompts/:id/revisions - List revisions
.get(
  "/:id/revisions",
  async ({ params, query, ...ctx }) => {
    const result = await deps.listPromptRevisionsUseCase.execute(ctx, {
      promptId: params.id,
      limit: query.limit,
      offset: query.offset,
    });
    return httpEnvelope(result);
  },
  {
    params: t.Object({ id: t.String() }),
    query: t.Object({
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
      offset: t.Optional(t.Number({ minimum: 0 })),
    }),
  },
)

// GET /prompts/:id/revisions/:revisionNumber - Get specific revision
.get(
  "/:id/revisions/:revisionNumber",
  async ({ params, ...ctx }) => {
    const result = await deps.getPromptRevisionUseCase.execute(ctx, {
      promptId: params.id,
      revisionNumber: parseInt(params.revisionNumber, 10),
    });
    return httpEnvelope(result);
  },
  {
    params: t.Object({
      id: t.String(),
      revisionNumber: t.String(),
    }),
  },
)
```

# File Structure

```
app/service/src/module/prompt/
├── domain/
│   ├── entity/
│   │   ├── message-role.ts
│   │   └── message.ts
│   ├── aggregate/
│   │   ├── prompt-aggregate-props.ts        # Add currentRevision
│   │   ├── prompt-aggregate.ts              # Add update() method
│   │   ├── prompt-revision-aggregate-props.ts  # NEW
│   │   └── prompt-revision-aggregate.ts        # NEW
│   └── event/
│       ├── prompt-created-event.ts
│       ├── prompt-updated-event.ts             # NEW
│       └── prompt-revision-created-event.ts    # NEW
├── port/
│   ├── inbound/use-case/
│   │   ├── prompt-use-case-dto.ts              # Add PromptRevisionDto
│   │   ├── create-prompt-use-case-port.ts
│   │   ├── list-prompts-use-case-port.ts
│   │   ├── update-prompt-use-case-port.ts         # NEW
│   │   ├── list-prompt-revisions-use-case-port.ts # NEW
│   │   └── get-prompt-revision-use-case-port.ts   # NEW
│   └── outbound/persistence/
│       ├── prompt-repository-port.ts           # Add findById, updateOne
│       └── prompt-revision-repository-port.ts  # NEW
├── application/
│   ├── use-case/
│   │   ├── create-prompt-use-case-adapter.ts
│   │   ├── list-prompts-use-case-adapter.ts
│   │   ├── update-prompt-use-case-adapter.ts         # NEW
│   │   ├── update-prompt-use-case-adapter.test.ts    # NEW
│   │   ├── list-prompt-revisions-use-case-adapter.ts    # NEW
│   │   ├── list-prompt-revisions-use-case-adapter.test.ts  # NEW
│   │   ├── get-prompt-revision-use-case-adapter.ts      # NEW
│   │   └── get-prompt-revision-use-case-adapter.test.ts # NEW
│   └── mapper/
│       └── prompt-use-case-dto-mapper.ts       # Add toRevisionDto
└── adapter/
    ├── inbound/http/
    │   ├── api.ts
    │   └── router/
    │       └── prompt-router-factory.ts        # Add revision routes
    └── outbound/persistence/mongo/
        ├── prompt-mongo-model.ts               # Add currentRevision
        ├── prompt-mongo-details.ts
        ├── prompt-mongo-model-mapper.ts        # Update mapping
        ├── prompt-mongo-repository-adapter.ts  # Add findById, updateOne
        ├── prompt-revision-mongo-model.ts         # NEW
        ├── prompt-revision-mongo-details.ts       # NEW
        ├── prompt-revision-mongo-model-mapper.ts  # NEW
        └── prompt-revision-mongo-repository-adapter.ts  # NEW
```

# API Endpoints

| Method | Endpoint                                 | Description                      |
| ------ | ---------------------------------------- | -------------------------------- |
| PUT    | `/prompts/:id`                           | Update prompt (creates revision) |
| GET    | `/prompts/:id/revisions`                 | List all revisions (paginated)   |
| GET    | `/prompts/:id/revisions/:revisionNumber` | Get specific revision            |

## Request/Response Examples

### PUT /prompts/:id

**Request:**

```json
{
  "title": "Updated Code Review Assistant",
  "messages": [
    {
      "role": "instruction",
      "content": "You are an expert code reviewer. Focus on security and performance.",
      "order": 0
    }
  ]
}
```

**Response (200 OK):**

```json
{
  "data": {
    "prompt": {
      "id": "01JXYZ...",
      "title": "Updated Code Review Assistant",
      "messages": [
        {
          "role": "instruction",
          "content": "You are an expert code reviewer. Focus on security and performance.",
          "order": 0
        }
      ],
      "currentRevision": 2,
      "createdAt": "2025-01-01T10:00:00Z",
      "updatedAt": "2025-01-02T10:00:00Z"
    },
    "revision": {
      "id": "01JABC...",
      "promptId": "01JXYZ...",
      "revisionNumber": 1,
      "title": "Code Review Assistant",
      "messages": [
        {
          "role": "instruction",
          "content": "You are a code reviewer.",
          "order": 0
        }
      ],
      "createdAt": "2025-01-02T10:00:00Z"
    }
  }
}
```

### GET /prompts/:id/revisions

**Response (200 OK):**

```json
{
  "data": {
    "revisions": [
      {
        "id": "01JDEF...",
        "promptId": "01JXYZ...",
        "revisionNumber": 2,
        "title": "Code Review Assistant v2",
        "messages": [...],
        "createdAt": "2025-01-03T10:00:00Z"
      },
      {
        "id": "01JABC...",
        "promptId": "01JXYZ...",
        "revisionNumber": 1,
        "title": "Code Review Assistant",
        "messages": [...],
        "createdAt": "2025-01-02T10:00:00Z"
      }
    ],
    "total": 2
  }
}
```

### GET /prompts/:id/revisions/:revisionNumber

**Response (200 OK):**

```json
{
  "data": {
    "revision": {
      "id": "01JABC...",
      "promptId": "01JXYZ...",
      "revisionNumber": 1,
      "title": "Code Review Assistant",
      "messages": [
        {
          "role": "instruction",
          "content": "You are a code reviewer.",
          "order": 0
        }
      ],
      "createdAt": "2025-01-02T10:00:00Z"
    }
  }
}
```

# Acceptance Criteria

## Phase 1: Domain Layer

- [ ] `PromptRevisionAggregateProps` schema is created with `promptId`, `revisionNumber`, `title`, `messages`
- [ ] `PromptRevisionAggregate` class is created with `new()` factory method
- [ ] `PromptAggregateProps` includes `currentRevision` field (default: 1)
- [ ] `PromptAggregate.update()` method updates content and increments `currentRevision`
- [ ] `PromptUpdatedEvent` is created with title, messages, revisionNumber payload
- [ ] `PromptRevisionCreatedEvent` is created

## Phase 2: Persistence Layer

- [ ] `PromptRevisionMongoModel` type is defined
- [ ] `prompt_revisions` collection has unique index on `(promptId, revisionNumber)`
- [ ] `PromptRevisionRepositoryPort` interface is created with all methods
- [ ] `PromptRevisionMongoRepositoryAdapter` implements all repository methods
- [ ] `PromptRepositoryPort` is extended with `findById` and `updateOne`
- [ ] `PromptMongoRepositoryAdapter` implements `findById` and `updateOne`
- [ ] `PromptMongoModel` includes `currentRevision` field

## Phase 3: Application Layer

- [ ] `UpdatePromptUseCasePort` interface is created
- [ ] `UpdatePromptUseCaseAdapter` creates revision snapshot before updating
- [ ] `UpdatePromptUseCaseAdapter` uses Unit of Work for atomic operations
- [ ] `ListPromptRevisionsUseCasePort` interface is created
- [ ] `ListPromptRevisionsUseCaseAdapter` returns paginated revisions
- [ ] `GetPromptRevisionUseCasePort` interface is created
- [ ] `GetPromptRevisionUseCaseAdapter` returns specific revision by number
- [ ] `PromptUseCaseDtoMapper` includes `toRevisionDto` method
- [ ] Unit tests exist for all new use case adapters

## Phase 4: HTTP Adapter Layer

- [ ] `PUT /prompts/:id` endpoint updates prompt and returns revision
- [ ] `GET /prompts/:id/revisions` endpoint returns paginated revision list
- [ ] `GET /prompts/:id/revisions/:revisionNumber` endpoint returns specific revision
- [ ] Request validation using Zod/Typebox schemas
- [ ] Proper HTTP status codes (200, 404)

## Non-Functional Requirements

- [ ] MongoDB transactions used for atomic update + revision creation
- [ ] Revisions stored in descending order (newest first) via index
- [ ] No limit on number of revisions per prompt
- [ ] Integration tests verify transaction atomicity

# Dependencies

- Requires **Message Entity** from `setup-message-entity` feature
- Requires **Unit of Work** from `setup-uow-and-outbox` feature for transaction management

# Future Enhancements

- [ ] Diff view between revisions
- [ ] Restore prompt from specific revision
- [ ] Revision metadata (author, change description)
- [ ] Soft delete old revisions (configurable retention policy)
- [ ] Compare two revisions side-by-side
