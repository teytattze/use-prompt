# Goal

Implement a prompt reaction system that allows users to upvote or downvote prompts, with the ability to undo their reaction. Use a hybrid approach with cached counts on prompts for fast reads and a separate collection for individual reaction records.

# Background

The current architecture has:

- `PromptAggregate` with basic properties (`title`, `body`)
- Hexagonal architecture with ports and adapters
- MongoDB for persistence
- No user interaction or engagement tracking

Users need a way to express their opinion on prompts to help surface quality content and provide feedback to prompt creators.

# Problem

1. **No Engagement Tracking**: Users cannot express opinions on prompts
2. **No Quality Signals**: No mechanism to surface popular or high-quality prompts
3. **No User Feedback**: Prompt creators have no visibility into how their prompts are received

# Solution

Implement a hybrid reaction system:

1. **PromptReaction Aggregate**: Separate aggregate to store individual user reactions
2. **Cached Counts on Prompt**: Store `upvoteCount` and `downvoteCount` on `PromptAggregate` for fast reads
3. **Atomic Operations**: Use MongoDB transactions to ensure consistency between reactions and counts
4. **Unique Constraint**: Each user can have only one reaction per prompt (enforced via unique index)

# Proposal

## Phase 1: Domain Layer

### 1.1 Create Reaction Type

```typescript
// module/prompt-reaction/domain/reaction-type.ts
export const ReactionType = {
  UPVOTE: "upvote",
  DOWNVOTE: "downvote",
} as const;

export type ReactionType = (typeof ReactionType)[keyof typeof ReactionType];
```

### 1.2 Create PromptReaction Aggregate

```typescript
// module/prompt-reaction/domain/aggregate/prompt-reaction-aggregate-props.ts
export interface PromptReactionAggregateProps extends BaseProps {
  promptId: string;
  userId: string;
  type: ReactionType;
}

// module/prompt-reaction/domain/aggregate/prompt-reaction-aggregate.ts
export class PromptReactionAggregate extends BaseAggregate<PromptReactionAggregateProps> {
  static new(
    props: PromptReactionAggregatePropsInput,
  ): PromptReactionAggregate {
    const aggregate = new PromptReactionAggregate(newId(), props);
    aggregate.addEvent(new PromptReactionCreatedEvent(aggregate.id, props));
    return aggregate;
  }

  changeType(newType: ReactionType): void {
    if (this.props.type === newType) return;
    const oldType = this.props.type;
    this.props.type = newType;
    this.addEvent(
      new PromptReactionChangedEvent(this.id, {
        oldType,
        newType,
        promptId: this.props.promptId,
      }),
    );
  }
}
```

### 1.3 Create Domain Events

```typescript
// module/prompt-reaction/domain/event/prompt-reaction-created-event.ts
export class PromptReactionCreatedEvent extends BaseEvent<{
  promptId: string;
  userId: string;
  type: ReactionType;
}> {
  static readonly TYPE = "prompt-reaction.created";
}

// module/prompt-reaction/domain/event/prompt-reaction-changed-event.ts
export class PromptReactionChangedEvent extends BaseEvent<{
  promptId: string;
  oldType: ReactionType;
  newType: ReactionType;
}> {
  static readonly TYPE = "prompt-reaction.changed";
}

// module/prompt-reaction/domain/event/prompt-reaction-removed-event.ts
export class PromptReactionRemovedEvent extends BaseEvent<{
  promptId: string;
  userId: string;
  type: ReactionType;
}> {
  static readonly TYPE = "prompt-reaction.removed";
}
```

### 1.4 Extend PromptAggregate with Reaction Counts

```typescript
// module/prompt/domain/aggregate/prompt-aggregate-props.ts
export interface PromptAggregateProps extends BaseProps {
  title: string;
  body: string;
  upvoteCount: number; // NEW
  downvoteCount: number; // NEW
}

// module/prompt/domain/aggregate/prompt-aggregate.ts
export class PromptAggregate extends BaseAggregate<PromptAggregateProps> {
  incrementUpvote(): void {
    this.props.upvoteCount += 1;
  }

  decrementUpvote(): void {
    this.props.upvoteCount = Math.max(0, this.props.upvoteCount - 1);
  }

  incrementDownvote(): void {
    this.props.downvoteCount += 1;
  }

  decrementDownvote(): void {
    this.props.downvoteCount = Math.max(0, this.props.downvoteCount - 1);
  }
}
```

## Phase 2: Persistence Layer

### 2.1 Create PromptReaction Mongo Model

```typescript
// module/prompt-reaction/adapter/outbound/persistence/mongo/prompt-reaction-mongo-model.ts
export type PromptReactionMongoModel = BaseMongoModel & {
  promptId: string;
  userId: string;
  type: ReactionType;
};

// Unique compound index on (promptId, userId) to enforce one reaction per user per prompt
```

### 2.2 Create PromptReaction Repository Port

```typescript
// module/prompt-reaction/port/outbound/persistence/prompt-reaction-repository-port.ts
export interface PromptReactionRepositoryPort {
  findByPromptIdAndUserId(
    ctx: AppContext,
    promptId: string,
    userId: string,
  ): Promise<Result<PromptReactionAggregate | null, AppError>>;

  insertOne(
    ctx: AppContext,
    data: PromptReactionAggregate,
    session?: ClientSession,
  ): Promise<Result<PromptReactionAggregate, AppError>>;

  updateOne(
    ctx: AppContext,
    data: PromptReactionAggregate,
    session?: ClientSession,
  ): Promise<Result<PromptReactionAggregate, AppError>>;

  deleteOne(
    ctx: AppContext,
    id: string,
    session?: ClientSession,
  ): Promise<Result<void, AppError>>;

  findByPromptId(
    ctx: AppContext,
    promptId: string,
  ): Promise<Result<PromptReactionAggregate[], AppError>>;
}
```

### 2.3 Update PromptRepositoryPort

```typescript
// module/prompt/port/outbound/persistence/prompt-repository-port.ts
export interface PromptRepositoryPort {
  // ... existing methods

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

### 2.4 Update PromptMongoModel

```typescript
// module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model.ts
export type PromptMongoModel = BaseMongoModel & {
  title: string;
  body: string;
  upvoteCount: number; // NEW
  downvoteCount: number; // NEW
};
```

## Phase 3: Application Layer (Use Cases)

### 3.1 React to Prompt Use Case

Handles creating a new reaction or changing an existing one.

```typescript
// module/prompt-reaction/port/inbound/use-case/react-to-prompt-use-case-port.ts
export interface ReactToPromptUseCaseInput {
  promptId: string;
  userId: string;
  type: ReactionType;
}

export interface ReactToPromptUseCaseOutput {
  reaction: PromptReactionDto;
  prompt: { upvoteCount: number; downvoteCount: number };
}

export interface ReactToPromptUseCasePort extends UseCasePort<
  ReactToPromptUseCaseInput,
  ReactToPromptUseCaseOutput
> {}
```

```typescript
// module/prompt-reaction/application/use-case/react-to-prompt-use-case-adapter.ts
export class ReactToPromptUseCaseAdapter implements ReactToPromptUseCasePort {
  async execute(ctx, input): Promise<Result<Output, AppError>> {
    return this.unitOfWork.execute(async (session) => {
      // 1. Check if prompt exists
      const prompt = await this.promptRepository.findById(ctx, input.promptId);
      if (prompt.isErr()) return prompt;
      if (!prompt.value) return err(AppError.notFound("Prompt not found"));

      // 2. Check for existing reaction
      const existingReaction =
        await this.reactionRepository.findByPromptIdAndUserId(
          ctx,
          input.promptId,
          input.userId,
        );

      if (existingReaction.value) {
        // 3a. Update existing reaction
        const oldType = existingReaction.value.props.type;
        if (oldType === input.type) {
          // Same reaction type - no change needed
          return ok({ reaction: existingReaction.value, prompt: prompt.value });
        }

        // Change reaction type
        existingReaction.value.changeType(input.type);
        await this.reactionRepository.updateOne(
          ctx,
          existingReaction.value,
          session,
        );

        // Update prompt counts (swap)
        if (oldType === "upvote") {
          prompt.value.decrementUpvote();
          prompt.value.incrementDownvote();
        } else {
          prompt.value.decrementDownvote();
          prompt.value.incrementUpvote();
        }
        await this.promptRepository.updateOne(ctx, prompt.value, session);

        return ok({ reaction: existingReaction.value, prompt: prompt.value });
      } else {
        // 3b. Create new reaction
        const reaction = PromptReactionAggregate.new(input);
        await this.reactionRepository.insertOne(ctx, reaction, session);

        // Update prompt count
        if (input.type === "upvote") {
          prompt.value.incrementUpvote();
        } else {
          prompt.value.incrementDownvote();
        }
        await this.promptRepository.updateOne(ctx, prompt.value, session);

        return ok({ reaction, prompt: prompt.value });
      }
    });
  }
}
```

### 3.2 Undo Reaction Use Case

```typescript
// module/prompt-reaction/port/inbound/use-case/undo-reaction-use-case-port.ts
export interface UndoReactionUseCaseInput {
  promptId: string;
  userId: string;
}

export interface UndoReactionUseCaseOutput {
  prompt: { upvoteCount: number; downvoteCount: number };
}

export interface UndoReactionUseCasePort extends UseCasePort<
  UndoReactionUseCaseInput,
  UndoReactionUseCaseOutput
> {}
```

```typescript
// module/prompt-reaction/application/use-case/undo-reaction-use-case-adapter.ts
export class UndoReactionUseCaseAdapter implements UndoReactionUseCasePort {
  async execute(ctx, input): Promise<Result<Output, AppError>> {
    return this.unitOfWork.execute(async (session) => {
      // 1. Find existing reaction
      const existingReaction =
        await this.reactionRepository.findByPromptIdAndUserId(
          ctx,
          input.promptId,
          input.userId,
        );
      if (!existingReaction.value) {
        return err(AppError.notFound("Reaction not found"));
      }

      // 2. Find prompt
      const prompt = await this.promptRepository.findById(ctx, input.promptId);
      if (prompt.isErr()) return prompt;
      if (!prompt.value) return err(AppError.notFound("Prompt not found"));

      // 3. Delete reaction
      const reactionType = existingReaction.value.props.type;
      await this.reactionRepository.deleteOne(
        ctx,
        existingReaction.value.id,
        session,
      );

      // 4. Update prompt count
      if (reactionType === "upvote") {
        prompt.value.decrementUpvote();
      } else {
        prompt.value.decrementDownvote();
      }
      await this.promptRepository.updateOne(ctx, prompt.value, session);

      return ok({ prompt: prompt.value });
    });
  }
}
```

### 3.3 Get User Reaction Use Case (Optional)

```typescript
// module/prompt-reaction/port/inbound/use-case/get-user-reaction-use-case-port.ts
export interface GetUserReactionUseCaseInput {
  promptId: string;
  userId: string;
}

export interface GetUserReactionUseCaseOutput {
  reaction: PromptReactionDto | null;
}
```

## Phase 4: HTTP Adapter Layer

### 4.1 Create Reaction Router

```typescript
// module/prompt-reaction/adapter/inbound/http/router/prompt-reaction-router-factory.ts
export const promptReactionRouterFactory = (deps: Dependencies) =>
  new Elysia({ prefix: "/prompts/:promptId/reactions" })
    // POST /prompts/:promptId/reactions - React to prompt
    .post("/", async ({ params, body, ...ctx }) => {
      const result = await deps.reactToPromptUseCase.execute(ctx, {
        promptId: params.promptId,
        userId: ctx.userId, // from auth middleware
        type: body.type,
      });
      return httpEnvelope(result);
    })
    // DELETE /prompts/:promptId/reactions - Undo reaction
    .delete("/", async ({ params, ...ctx }) => {
      const result = await deps.undoReactionUseCase.execute(ctx, {
        promptId: params.promptId,
        userId: ctx.userId,
      });
      return httpEnvelope(result);
    })
    // GET /prompts/:promptId/reactions/me - Get current user's reaction
    .get("/me", async ({ params, ...ctx }) => {
      const result = await deps.getUserReactionUseCase.execute(ctx, {
        promptId: params.promptId,
        userId: ctx.userId,
      });
      return httpEnvelope(result);
    });
```

# File Structure

```
app/service/src/module/
├── prompt/
│   ├── domain/
│   │   └── aggregate/
│   │       ├── prompt-aggregate-props.ts  # Add upvoteCount, downvoteCount
│   │       └── prompt-aggregate.ts        # Add increment/decrement methods
│   ├── port/
│   │   └── outbound/persistence/
│   │       └── prompt-repository-port.ts  # Add findById, updateOne
│   └── adapter/
│       └── outbound/persistence/mongo/
│           ├── prompt-mongo-model.ts      # Add count fields
│           └── prompt-mongo-repository-adapter.ts  # Implement new methods
│
└── prompt-reaction/                       # NEW MODULE
    ├── domain/
    │   ├── reaction-type.ts
    │   ├── aggregate/
    │   │   ├── prompt-reaction-aggregate-props.ts
    │   │   └── prompt-reaction-aggregate.ts
    │   └── event/
    │       ├── prompt-reaction-created-event.ts
    │       ├── prompt-reaction-changed-event.ts
    │       └── prompt-reaction-removed-event.ts
    ├── port/
    │   ├── inbound/use-case/
    │   │   ├── prompt-reaction-use-case-dto.ts
    │   │   ├── react-to-prompt-use-case-port.ts
    │   │   ├── undo-reaction-use-case-port.ts
    │   │   └── get-user-reaction-use-case-port.ts
    │   └── outbound/persistence/
    │       └── prompt-reaction-repository-port.ts
    ├── application/
    │   ├── use-case/
    │   │   ├── react-to-prompt-use-case-adapter.ts
    │   │   ├── react-to-prompt-use-case-adapter.test.ts
    │   │   ├── undo-reaction-use-case-adapter.ts
    │   │   ├── undo-reaction-use-case-adapter.test.ts
    │   │   ├── get-user-reaction-use-case-adapter.ts
    │   │   └── get-user-reaction-use-case-adapter.test.ts
    │   └── mapper/
    │       └── prompt-reaction-use-case-dto-mapper.ts
    └── adapter/
        ├── inbound/http/
        │   ├── api.ts
        │   └── router/
        │       └── prompt-reaction-router-factory.ts
        └── outbound/persistence/mongo/
            ├── prompt-reaction-mongo-model.ts
            ├── prompt-reaction-mongo-details.ts
            ├── prompt-reaction-mongo-model-mapper.ts
            └── prompt-reaction-mongo-repository-adapter.ts
```

# API Endpoints

| Method | Endpoint                          | Description                 | Auth Required |
| ------ | --------------------------------- | --------------------------- | ------------- |
| POST   | `/prompts/:promptId/reactions`    | Create or update reaction   | Yes           |
| DELETE | `/prompts/:promptId/reactions`    | Remove user's reaction      | Yes           |
| GET    | `/prompts/:promptId/reactions/me` | Get current user's reaction | Yes           |

## Request/Response Examples

### POST /prompts/:promptId/reactions

**Request:**

```json
{
  "type": "upvote"
}
```

**Response (201 Created / 200 OK):**

```json
{
  "data": {
    "reaction": {
      "id": "01JXYZ...",
      "promptId": "01JABC...",
      "userId": "user123",
      "type": "upvote",
      "createdAt": "2025-01-02T10:00:00Z",
      "updatedAt": "2025-01-02T10:00:00Z"
    },
    "prompt": {
      "upvoteCount": 42,
      "downvoteCount": 3
    }
  }
}
```

### DELETE /prompts/:promptId/reactions

**Response (200 OK):**

```json
{
  "data": {
    "prompt": {
      "upvoteCount": 41,
      "downvoteCount": 3
    }
  }
}
```

### GET /prompts/:promptId/reactions/me

**Response (200 OK):**

```json
{
  "data": {
    "reaction": {
      "id": "01JXYZ...",
      "promptId": "01JABC...",
      "userId": "user123",
      "type": "upvote",
      "createdAt": "2025-01-02T10:00:00Z",
      "updatedAt": "2025-01-02T10:00:00Z"
    }
  }
}
```

**Response (200 OK - No reaction):**

```json
{
  "data": {
    "reaction": null
  }
}
```

# Acceptance Criteria

## Phase 1: Domain Layer

- [ ] `ReactionType` enum is created with `upvote` and `downvote` values
- [ ] `PromptReactionAggregate` is created with `promptId`, `userId`, `type` properties
- [ ] `PromptReactionAggregate.changeType()` method updates type and emits event
- [ ] Domain events are created: `PromptReactionCreatedEvent`, `PromptReactionChangedEvent`, `PromptReactionRemovedEvent`
- [ ] `PromptAggregate` is extended with `upvoteCount` and `downvoteCount` properties (default: 0)
- [ ] `PromptAggregate` has `incrementUpvote()`, `decrementUpvote()`, `incrementDownvote()`, `decrementDownvote()` methods

## Phase 2: Persistence Layer

- [ ] `PromptReactionMongoModel` schema is defined
- [ ] Unique compound index exists on `(promptId, userId)` in `prompt_reactions` collection
- [ ] `PromptReactionRepositoryPort` interface is created with all required methods
- [ ] `PromptReactionMongoRepositoryAdapter` implements all repository methods
- [ ] `PromptRepositoryPort` is extended with `findById` and `updateOne` methods
- [ ] `PromptMongoRepositoryAdapter` implements `findById` and `updateOne`
- [ ] `PromptMongoModel` includes `upvoteCount` and `downvoteCount` fields

## Phase 3: Application Layer

- [ ] `ReactToPromptUseCasePort` interface is created
- [ ] `ReactToPromptUseCaseAdapter` handles new reactions and reaction changes atomically
- [ ] `UndoReactionUseCasePort` interface is created
- [ ] `UndoReactionUseCaseAdapter` removes reactions and updates counts atomically
- [ ] `GetUserReactionUseCasePort` interface is created
- [ ] `GetUserReactionUseCaseAdapter` returns user's reaction for a prompt
- [ ] All use cases use Unit of Work for transaction management
- [ ] Unit tests exist for all use case adapters

## Phase 4: HTTP Adapter Layer

- [ ] `POST /prompts/:promptId/reactions` endpoint creates/updates reactions
- [ ] `DELETE /prompts/:promptId/reactions` endpoint removes reactions
- [ ] `GET /prompts/:promptId/reactions/me` endpoint returns user's reaction
- [ ] All endpoints require authentication
- [ ] Request validation using Zod schemas
- [ ] Proper HTTP status codes (201 for create, 200 for update/delete, 404 for not found)

## Non-Functional Requirements

- [ ] MongoDB transactions are used for atomic operations (requires replica set)
- [ ] Duplicate reaction attempts are handled gracefully (idempotent)
- [ ] Count fields are non-negative (Math.max(0, count - 1) on decrement)
- [ ] Integration tests verify transaction atomicity (rollback on failure)
- [ ] Performance: Single prompt lookup + single reaction lookup per request

# Dependencies

- Requires **Unit of Work pattern** from `setup-uow-and-outbox` feature for transaction management
- Requires **User Authentication** middleware to provide `userId` in request context

# Future Enhancements

- [ ] Aggregate reaction counts by prompt for leaderboards
- [ ] User reaction history endpoint
- [ ] Real-time reaction count updates via WebSocket
- [ ] Rate limiting on reactions to prevent abuse
- [ ] Soft delete reactions for audit trail
