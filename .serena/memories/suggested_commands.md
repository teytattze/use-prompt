# Suggested Commands

## Development

```bash
# Start all apps in development mode
bun run dev

# Start specific app
bun run dev --filter=@use-prompt/web
bun run dev --filter=@use-prompt/service
```

## Building

```bash
# Build all apps and packages
bun run build

# Build specific app
bun run build --filter=@use-prompt/web
bun run build --filter=@use-prompt/service
```

## Code Quality

```bash
# Run linting
bun run lint

# Run type checking
bun run check-types

# Format code
bun run format
```

## App-Specific Commands

### Web App (app/web)

```bash
cd app/web
bun run dev      # Start Next.js dev server
bun run build    # Build for production
bun run start    # Start production server
bun run lint     # Run ESLint
bun run check-types  # TypeScript type checking
```

### Service (app/service)

```bash
cd app/service
bun run dev      # Start with hot reload (bun --watch)
bun run build    # Build to dist/
bun run start    # Run production build
bun run test     # Run tests
bun run check-types  # TypeScript type checking
```

## System Utilities (macOS/Darwin)

```bash
# Git
git status
git add .
git commit -m "message"
git push

# File operations
ls -la
find . -name "*.ts"
grep -r "pattern" --include="*.ts"

# Process management
lsof -i :3000    # Check port usage
```

## Docker (Service)

```bash
cd app/service
docker compose up    # Start MongoDB and other services
docker compose down  # Stop services
```
