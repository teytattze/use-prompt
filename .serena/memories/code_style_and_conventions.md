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

- **kebab-case** for all file names (e.g., `prompt-router-factory.ts`, `http-client.ts`)
- Suffix patterns:
  - `-adapter.ts` for adapter implementations
  - `-port.ts` for port interfaces
  - `-dto.ts` for data transfer objects
  - `-mapper.ts` for mappers
  - `-use-case.ts` for use cases
  - `-aggregate.ts` for domain aggregates
  - `-event.ts` for domain events
  - `-model.ts` for persistence models

### Code

- **PascalCase** for classes, interfaces, types, and React components
- **camelCase** for variables, functions, and methods
- Prefix interfaces with descriptive names (not `I` prefix)

## Architecture Patterns

### Backend (Hexagonal Architecture)

- **Ports**: Define interfaces for inbound (use cases) and outbound (repositories)
- **Adapters**: Implement ports (HTTP controllers, MongoDB repositories)
- **Application**: Use case implementations and mappers
- **Domain**: Aggregates, entities, value objects, and domain events

### Frontend

- **Feature-based organization**: Group related components by feature
- **Service layer**: API calls abstracted into service files
- **UI components**: Reusable shadcn/ui components in `component/ui/`

## Error Handling

- Backend uses `neverthrow` for Result types (functional error handling)
- Define custom error types in `lib/app-error.ts`

## ID Generation

- Use ULID for entity IDs (sortable, unique)
