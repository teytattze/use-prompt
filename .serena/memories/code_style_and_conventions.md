# Code Style and Conventions

## TypeScript Configuration

- **Strict Mode**: Enabled
- **Target**: ES2024
- **Module**: NodeNext with NodeNext resolution
- **noUncheckedIndexedAccess**: Enabled (safer array/object access)
- Uses `@total-typescript/ts-reset` for improved type safety

## ESLint Configuration

- Based on `@eslint/js` recommended
- TypeScript ESLint recommended rules
- Prettier integration via `eslint-config-prettier`
- Turbo plugin for monorepo environment variables
- `eslint-plugin-only-warn` - all rules emit warnings (not errors)

## Prettier Configuration

- Uses `@trivago/prettier-plugin-sort-imports` for import sorting
- Uses `prettier-plugin-tailwindcss` for Tailwind class sorting
- Import order:
  1. Third-party modules
  2. `@/` aliased imports
  3. Relative imports (`./` and `../`)

## Naming Conventions

### Files

- **kebab-case** for all file names (e.g., `prompt.router.ts`, `http-client.ts`)
- Naming patterns use dot-notation:
  - `{name}.aggregate.ts` for domain aggregates (e.g., `prompt.aggregate.ts`)
  - `{name}.entity.ts` for domain entities (e.g., `message.entity.ts`)
  - `{name}.event.ts` for domain events (e.g., `prompt-created.event.ts`)
  - `{name}.port.ts` for port interfaces (e.g., `prompt-repository.port.ts`)
  - `{name}.use-case.ts` for use cases (e.g., `create-prompt.use-case.ts`)
  - `{name}.handler.ts` for event handlers (e.g., `prompt-created.handler.ts`)
  - `{name}.repository.ts` for repository adapters (e.g., `prompt-mongo.repository.ts`)
  - `{name}.mapper.ts` for mappers (e.g., `prompt-dto.mapper.ts`)
  - `{name}.dto.ts` for data transfer objects (e.g., `prompt.dto.ts`)
  - `{name}.router.ts` for HTTP routers (e.g., `prompt.router.ts`)
  - `{name}.props.ts` for entity/aggregate props types (e.g., `prompt.props.ts`)

### Code

- **PascalCase** for classes, interfaces, types, and React components
- **camelCase** for variables, functions, and methods
- Prefix interfaces with descriptive names (not `I` prefix)

## Architecture Patterns

### Backend (DDD + Hexagonal Architecture)

- **Domain Layer** (`module/*/domain/`): Aggregates, entities, value objects, and domain events
- **Application Layer** (`module/*/application/`): Use cases, event handlers, DTOs, and mappers
- **Port Layer** (`module/*/port/`): Interfaces for use cases and repositories
- **Infrastructure Layer** (`module/*/infra/`): Adapters (HTTP routers, MongoDB repositories)
- **Shared Kernel** (`shared/`): Cross-cutting concerns (base classes, core utilities)
- **Composition** (`composition/`): Manual dependency injection wiring

### Frontend

- **Feature-based organization**: Group related components by feature
- **Service layer**: API calls abstracted into service files
- **UI components**: Reusable shadcn/ui components in `component/ui/`

## Error Handling

- Backend uses `neverthrow` for Result types (functional error handling)
- Define custom error types in `shared/core/app-error.ts`

## ID Generation

- Use ULID for entity IDs (sortable, unique)
