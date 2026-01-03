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

### Backend Service - Hexagonal/Clean Architecture

The service follows hexagonal (ports & adapters) architecture:

```
src/module/prompt/
├── adapter/
│   ├── inbound/http/      # HTTP routers and API
│   └── outbound/persistence/mongo/  # MongoDB repository
├── application/
│   ├── use-case/          # Use case implementations
│   └── mapper/            # DTO mappers
├── port/
│   ├── inbound/use-case/  # Use case interfaces
│   └── outbound/persistence/  # Repository interfaces
└── domain/
    ├── aggregate/         # Domain aggregates
    └── event/             # Domain events
```

### Frontend - Feature-based Structure

```
src/
├── app/              # Next.js app router pages
├── component/ui/     # Reusable UI components (shadcn)
├── feature/          # Feature-specific components
├── lib/              # Utilities and helpers
└── service/          # API service layer
```
