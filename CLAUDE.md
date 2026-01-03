# CLAUDE.md

## Project Overview

Monorepo using Bun (v1.3.5) + Turborepo with:

- **Backend:** `app/service` - Bun + Elysia + MongoDB
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
