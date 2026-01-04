# CLAUDE.md

## Project Overview

Monorepo using Bun (v1.3.5) + Turborepo with:

- **Backend:** `app/service` - Bun + Elysia + MongoDB (DDD + Hexagonal Architecture)
- **Frontend:** `app/web` - Next.js + React + TailwindCSS

## Commands (run from root)

| Command               | What It Does                     | When to Use                            |
| --------------------- | -------------------------------- | -------------------------------------- |
| `bun install`         | Install dependencies             | Initial setup or after pulling changes |
| `bun run build`       | Build all apps for production    | Before deploying                       |
| `bun run check-types` | TypeScript type checking         | Ensure type safety                     |
| `bun run dev`         | Start all apps in dev mode       | Active development                     |
| `bun run format`      | Format code with Prettier        | Maintain consistent style              |
| `bun run lint`        | Run ESLint across all workspaces | Before committing                      |
| `bun run test`        | Run tests across all workspaces  | Validate code                          |

### Filter by Package

Use `--filter` to target specific apps:

```bash
bun run test --filter ./app/service      # Backend only
bun run test --filter ./app/web          # Frontend only
```

### Docker (MongoDB)

```bash
docker compose -f compose.yml up -d    # Start MongoDB
docker compose -f compose.yml down     # Stop MongoDB
```

MongoDB: `localhost:27017` (credentials: `root:password`)

## Quick Start

```bash
bun install
docker compose -f compose.yml up -d
bun run dev
```

## Backend Architecture (`app/service`)

The backend follows **DDD (Domain-Driven Design)** with **Hexagonal Architecture** (Ports & Adapters).

### Directory Structure

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

### Layer Dependencies

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

### Naming Conventions

| Type       | Pattern                      | Example                        |
| ---------- | ---------------------------- | ------------------------------ |
| Aggregate  | `{name}.aggregate.ts`        | `prompt.aggregate.ts`          |
| Entity     | `{name}.entity.ts`           | `message.entity.ts`            |
| Event      | `{name}.event.ts`            | `prompt-created.event.ts`      |
| Port       | `{name}.port.ts`             | `prompt-repository.port.ts`    |
| Use Case   | `{name}.use-case.ts`         | `create-prompt.use-case.ts`    |
| Handler    | `{name}.handler.ts`          | `prompt-created.handler.ts`    |
| Repository | `{name}.repository.ts`       | `prompt-mongo.repository.ts`   |
| Mapper     | `{name}.mapper.ts`           | `prompt-dto.mapper.ts`         |
| DTO        | `{name}.dto.ts`              | `prompt.dto.ts`                |
| Router     | `{name}.router.ts`           | `prompt.router.ts`             |

### Key Patterns

- **Result type**: Uses `neverthrow` for explicit error handling (`Result<T, AppError>`)
- **Validation**: Uses Zod schemas at boundaries
- **Unit of Work**: Wraps use cases in MongoDB transactions
- **Event Bus**: In-memory pub/sub for domain events
- **Dependency Injection**: Manual wiring in `composition/` folder
