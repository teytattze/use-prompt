# Use Open Prompt - Project Overview

## Purpose

A monorepo project for managing and sharing prompts. The project provides a web interface and a backend service for creating and viewing prompts.

## Tech Stack

### Monorepo Structure

- **Package Manager**: Bun (v1.3.5)
- **Build System**: Turborepo
- **Language**: TypeScript 5.9.2 (100% TypeScript codebase)

### Frontend (app/web)

- **Framework**: Next.js 16.1.1
- **UI**: React 19.2.3
- **Styling**: Tailwind CSS 4.1.11
- **Components**: shadcn/ui with Base UI React
- **State Management**: TanStack React Query 5.90.16
- **Validation**: Zod 4.2.1
- **HTTP Client**: Axios 1.13.2

### Backend (app/service)

- **Runtime**: Bun
- **Framework**: Elysia 1.4.19
- **Database**: MongoDB 7.0.0
- **Validation**: Zod 4.2.1
- **Logging**: Pino 10.1.0
- **ID Generation**: ULID 3.0.2
- **Error Handling**: neverthrow 8.2.0

### Shared Packages

- `@use-prompt/eslint-config`: Shared ESLint configurations
- `@use-prompt/typescript-config`: Shared TypeScript configurations

## Architecture

### Backend Service - DDD + Hexagonal Architecture

The service follows **Domain-Driven Design** with **Hexagonal Architecture** (Ports & Adapters):

```
src/
├── api.ts                    # HTTP server entry point
├── worker.ts                 # Background worker entry point
│
├── shared/                   # Shared kernel (cross-cutting concerns)
│   ├── core/                 # Core utilities (config, context, error, logger, id)
│   ├── domain/               # DDD base classes (entity, aggregate, event)
│   ├── port/                 # Shared port interfaces
│   └── http/                 # HTTP utilities (envelope)
│
├── infra/                    # Infrastructure adapters
│   ├── mongo/                # MongoDB (client, unit-of-work)
│   ├── event-bus/            # Event bus (in-memory)
│   └── http/                 # HTTP middleware
│
├── module/                   # Feature modules (bounded contexts)
│   └── prompt/
│       ├── domain/           # Domain layer (aggregates, entities, events)
│       ├── application/      # Application layer (use cases, handlers, mappers)
│       ├── port/             # Module-specific port interfaces
│       └── infra/            # Module-specific adapters (persistence, http)
│
└── composition/              # Dependency injection wiring
    ├── shared.composition.ts
    ├── prompt.composition.ts
    ├── api.composition.ts
    └── worker.composition.ts
```

#### Layer Dependencies

```
composition/ → modules, infra, shared
     │
     ▼
module/*/infra/ → module/*/application, module/*/port, shared, infra
     │
     ▼
module/*/application/ → module/*/domain, module/*/port, shared
     │
     ▼
module/*/port/ → module/*/domain, shared
     │
     ▼
module/*/domain/ → shared/domain, shared/core
     │
     ▼
shared/ → (nothing)
```

#### Key Patterns

- **Result type**: Uses `neverthrow` for explicit error handling (`Result<T, AppError>`)
- **Validation**: Uses Zod schemas at boundaries
- **Unit of Work**: Wraps use cases in MongoDB transactions
- **Event Bus**: In-memory pub/sub for domain events
- **Dependency Injection**: Manual wiring in `composition/` folder