# use-prompt

A monorepo for prompt management built with Bun, Turborepo, and modern web technologies.

## Tech Stack

- **Runtime:** [Bun](https://bun.sh) v1.3.5
- **Monorepo:** [Turborepo](https://turborepo.com)
- **Backend:** [Elysia](https://elysiajs.com) + MongoDB (DDD + Hexagonal Architecture)
- **Frontend:** [Next.js](https://nextjs.org) + React + TailwindCSS

## Quick Start

```bash
# Install dependencies
bun install

# Start MongoDB
docker compose -f compose.yml up -d

# Start development servers
bun run dev
```

## Apps and Packages

| Package                      | Description                     |
| ---------------------------- | ------------------------------- |
| `app/service`                | Backend API (Elysia + MongoDB)  |
| `app/web`                    | Frontend (Next.js + React)      |
| `packages/eslint-config`     | Shared ESLint configuration     |
| `packages/typescript-config` | Shared TypeScript configuration |

## Commands

| Command               | Description                        |
| --------------------- | ---------------------------------- |
| `bun install`         | Install dependencies               |
| `bun run dev`         | Start all apps in development mode |
| `bun run build`       | Build all apps for production      |
| `bun run check-types` | Run TypeScript type checking       |
| `bun run lint`        | Run ESLint                         |
| `bun run test`        | Run tests                          |
| `bun run format`      | Format code with Prettier          |

### Target Specific Apps

```bash
bun run dev --filter ./app/service   # Backend only
bun run dev --filter ./app/web       # Frontend only
```

## Architecture

The backend follows **DDD (Domain-Driven Design)** with **Hexagonal Architecture**:

```
app/service/src/
├── api.ts              # HTTP entry point
├── worker.ts           # Background worker entry point
├── shared/             # Shared kernel
├── infra/              # Infrastructure adapters
├── module/             # Feature modules (bounded contexts)
└── composition/        # Dependency injection
```

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation.

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.3.5+
- [Docker](https://docker.com) (for MongoDB)

### Environment Variables

Create `.env` files as needed:

```bash
# app/service/.env
APP_ENV=local
MONGO_URI=mongodb://root:password@localhost:27017/
```

### Database

```bash
# Start MongoDB
docker compose -f compose.yml up -d

# Stop MongoDB
docker compose -f compose.yml down
```

MongoDB runs at `localhost:27017` with credentials `root:password`.
