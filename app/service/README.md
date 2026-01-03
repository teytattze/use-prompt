# @use-prompt/service

Backend service for the use-open-prompt platform.

## Tech Stack

- **Runtime**: Bun
- **Framework**: Elysia (TypeScript web framework)
- **Database**: MongoDB
- **Language**: TypeScript with Zod for validation
- **Error Handling**: neverthrow (Result/Error types)
- **ID Generation**: ULID

## Getting Started

### Prerequisites

Start MongoDB using Docker:

```sh
docker compose up -d
```

### Install Dependencies

```sh
bun install
```

### Run Development Server

```sh
bun run dev
```

Open http://localhost:3000

## Project Structure

The project implements **Hexagonal (Ports & Adapters) Architecture** with clear separation of concerns:

```
src/
├── core/                          # Domain-specific business logic (feature modules)
│   └── prompt/                    # Feature module: Prompt management
│       ├── domain/                # Domain layer (aggregate roots, entities)
│       ├── port/                  # Interface contracts
│       │   ├── inbound/           # What the system receives (use cases)
│       │   └── outbound/          # External dependencies (repositories)
│       ├── application/           # Application services & mappers
│       │   ├── use-case/          # Use case implementations
│       │   └── mapper/            # Domain → DTO mappers
│       └── adapter/               # Concrete implementations
│           ├── inbound/http/      # HTTP controllers & routers
│           └── outbound/persistence/  # Database repositories
│
└── lib/                           # Shared infrastructure & utilities
    ├── domain/                    # Base domain classes
    ├── use-case/                  # Base use case port interface
    ├── mapper/                    # Mapping interfaces
    ├── http/                      # HTTP infrastructure (envelope)
    ├── mongo/                     # MongoDB client
    ├── app-config.ts              # Configuration (Zod validated)
    ├── app-context.ts             # Request context type
    ├── app-error.ts               # Centralized error handling
    ├── app-logger.ts              # Logging infrastructure
    └── id.ts                      # ID generation (ULID)
```

## Architecture Overview

### Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Adapters (External)                     │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Inbound (HTTP)    │    │   Outbound (MongoDB)        │ │
│  │   - Routers         │    │   - Repositories            │ │
│  │   - Middleware      │    │   - Model Mappers           │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Ports (Interfaces)                       │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Inbound Ports     │    │   Outbound Ports            │ │
│  │   - Use Case Ports  │    │   - Repository Ports        │ │
│  │   - DTOs            │    │                             │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer                          │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Use Cases         │    │   Mappers                   │ │
│  │   (Business Logic)  │    │   (Domain ↔ DTO)            │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Domain Layer                             │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Aggregates        │    │   Entities & Value Objects  │ │
│  │   (Root Entities)   │    │                             │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
HTTP Request (POST /api/v1/prompt)
    │
    ▼
setupAppContextMiddleware (decorates context)
    │
    ▼
PromptRouterFactory (Elysia route handler)
    │
    ▼
CreatePromptUseCaseAdapter.execute()
    ├── Creates PromptAggregate with validation
    ├── Calls PromptMongoRepository.insertOne()
    │   ├── PromptMongoModelMapper.fromDomain()
    │   ├── MongoDB insert operation
    │   └── Returns Result<PromptAggregate, AppError>
    ├── PromptUseCaseDtoMapper.toDto()
    └── Returns Result<PromptUseCaseDto, AppError>
    │
    ▼
HttpEnvelope.ok() or .error()
    │
    ▼
HTTP Response (JSON)
```

## Key Concepts

### Domain Layer (`/core/*/domain/`)

Contains the core business logic and rules. Domain objects are isolated from external concerns.

- **Aggregates**: Root entities that enforce invariants (e.g., `PromptAggregate`)
- **Entities**: Objects with identity
- **Value Objects**: Immutable objects without identity
- **Domain Events**: Events emitted by aggregates

### Port Layer (`/core/*/port/`)

Interfaces that define contracts between layers.

- **Inbound Ports**: Define what operations the application offers (use cases)
- **Outbound Ports**: Define what the application needs from external services (repositories)

### Application Layer (`/core/*/application/`)

Orchestrates the flow of data and coordinates domain objects.

- **Use Cases**: Implement business workflows by coordinating domain objects and ports
- **Mappers**: Transform data between domain objects and DTOs

### Adapter Layer (`/core/*/adapter/`)

Concrete implementations that connect to external systems.

- **Inbound Adapters**: Handle incoming requests (HTTP routers, middleware)
- **Outbound Adapters**: Handle outgoing operations (database repositories)

## Shared Infrastructure (`/lib/`)

### Base Classes

| File                       | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `domain/base-entity.ts`    | Base class for all entities with ID + props                  |
| `domain/base-aggregate.ts` | Base class for aggregate roots (extends entity, adds events) |
| `domain/base-event.ts`     | Base class for domain events                                 |
| `domain/base-props.ts`     | Type definition for entity properties                        |

### Interfaces

| File                                 | Purpose                                          |
| ------------------------------------ | ------------------------------------------------ |
| `use-case/use-case-port.ts`          | Interface for all use cases                      |
| `mapper/use-case-dto-mapper.ts`      | Interface for domain → DTO mapping               |
| `mapper/persistence-model-mapper.ts` | Interface for domain ↔ persistence model mapping |

### Infrastructure

| File                        | Purpose                                      |
| --------------------------- | -------------------------------------------- |
| `id.ts`                     | ID generation using ULID with Zod branding   |
| `app-error.ts`              | Centralized error handling with status codes |
| `app-context.ts`            | Request context type definition              |
| `app-config.ts`             | Configuration schema and initialization      |
| `http/http-envelope.ts`     | Standardized HTTP response wrapper           |
| `mongo/mongo-client.ts`     | MongoDB client singleton                     |
| `mongo/base-mongo-model.ts` | Base type for MongoDB documents              |

## API Endpoints

### Prompts

| Method | Endpoint         | Description         |
| ------ | ---------------- | ------------------- |
| POST   | `/api/v1/prompt` | Create a new prompt |

## Adding a New Feature Module

1. Create the domain layer:

   ```
   src/core/<feature>/domain/<feature>-aggregate.ts
   ```

2. Define ports:

   ```
   src/core/<feature>/port/inbound/use-case/<action>-<feature>-use-case-port.ts
   src/core/<feature>/port/outbound/persistence/<feature>-repository-port.ts
   ```

3. Implement application layer:

   ```
   src/core/<feature>/application/use-case/<action>-<feature>-use-case-adapter.ts
   src/core/<feature>/application/mapper/<feature>-use-case-dto-mapper.ts
   ```

4. Create adapters:

   ```
   src/core/<feature>/adapter/inbound/http/router/<feature>-router-factory.ts
   src/core/<feature>/adapter/outbound/persistence/mongo/<feature>-mongo-repository-adapter.ts
   ```

5. Wire up in `src/core/<feature>/adapter/inbound/http/api.ts`

## Configuration

Configuration is managed via environment variables and validated with Zod:

```typescript
{
  app: {
    env: "local" | "development" | "staging" | "production",
    version: string
  },
  mongo: {
    uri: string  // MongoDB connection string
  }
}
```

## Docker

Start MongoDB:

```sh
docker compose up -d
```

MongoDB runs on port 27017 with default credentials (root/password).
