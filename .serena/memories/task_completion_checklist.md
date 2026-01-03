# Task Completion Checklist

When completing a coding task, run the following checks:

## 1. Type Checking

```bash
bun run check-types
```

Ensure there are no TypeScript errors across all packages.

## 2. Linting

```bash
bun run lint
```

Fix any linting warnings (note: all rules are set to warn, not error).

## 3. Formatting

```bash
bun run format
```

Apply consistent formatting with Prettier.

## 4. Build Verification

```bash
bun run build
```

Ensure all packages build successfully.

## 5. Testing (if applicable)

```bash
# For service app
cd app/service && bun run test
```

## Quick Check (All at once)

```bash
bun run check-types && bun run lint && bun run build
```

## Notes

- Always run `check-types` before committing
- Format code before creating PRs
- Ensure imports are properly sorted (handled by Prettier plugin)
- Check that new files follow the kebab-case naming convention
