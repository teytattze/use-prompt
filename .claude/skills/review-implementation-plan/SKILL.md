---
name: review-implementation-plan
description: "Use this skill to review an implementation plan before execution. This is phase 2.5 of the Research → Plan → Implementation pipeline. Validates the plan against code conventions, style guides, and architectural patterns to ensure quality before implementation."
---

# Review Implementation Plan

This skill reviews implementation plans to ensure they align with project conventions, style guides, and architectural patterns before code execution begins.

## When to Use This Skill

**Trigger conditions:**

- User has completed an implementation plan and wants it reviewed
- User mentions "review", "validate", or "check" in context of a plan
- User explicitly invokes `/review-implementation-plan`
- Implementation plan exists and user wants quality assurance before execution

## Pipeline Context

This is an optional quality gate between planning and implementation:

```
Research → Plan → [Review] → Implementation
```

The review ensures the implementation plan adheres to project standards before code is written.

## Input Requirements

The skill requires:

- An `IMPLEMENTATION_PLAN.md` file at `@context/IMPLEMENTATION_PLAN.md`
- Access to project memories: `code_style_and_conventions`, `project_overview`

## Review Process

Work autonomously—do not ask for guidance during review.

### 1. Load Context

Gather project standards:

- Read `code_style_and_conventions` memory
- Read `project_overview` memory
- Review existing reference implementations in the codebase

### 2. Validate Naming Conventions

Check all proposed files and code elements:

- **File names**: Must use kebab-case (e.g., `prompt-router-factory.ts`)
- **File suffixes**: Must follow patterns (`-adapter.ts`, `-port.ts`, `-dto.ts`, `-mapper.ts`, `-use-case.ts`, `-aggregate.ts`, `-event.ts`, `-model.ts`)
- **Classes/interfaces/types**: Must use PascalCase
- **Variables/functions/methods**: Must use camelCase
- **No `I` prefix** on interfaces

### 3. Validate Architecture Patterns

For backend changes, verify hexagonal architecture:

- **Ports**: Interfaces for inbound (use cases) and outbound (repositories)
- **Adapters**: Implementations of ports (HTTP controllers, MongoDB repositories)
- **Application**: Use case implementations and mappers
- **Domain**: Aggregates, entities, value objects, domain events

For frontend changes, verify:

- **Feature-based organization**: Components grouped by feature
- **Service layer**: API calls abstracted into service files
- **UI components**: Reusable shadcn/ui components in `component/ui/`

### 4. Validate Code Patterns

Check proposed pseudocode against project standards:

- **Error handling**: Uses `neverthrow` Result types (not try/catch for business logic)
- **ID generation**: Uses ULID for entity IDs
- **Type safety**: Leverages strict TypeScript with `noUncheckedIndexedAccess`
- **Import ordering**: Third-party → `@/` aliased → relative imports

### 5. Validate File Organization

Ensure files are placed correctly:

- Backend: `app/service/src/` with hexagonal structure
- Frontend: `app/web/` with feature-based structure
- Shared types: Appropriate location for DTOs and interfaces

### 6. Check Completeness

Verify the plan includes:

- All necessary files in the change manifest
- Error handling for each operation
- Test cases for each component
- Integration points and failure modes
- Proper implementation order (dependencies before dependents)

### 7. Identify Anti-patterns

Flag any issues:

- Direct database access bypassing repositories
- Business logic in adapters/controllers
- Missing error handling
- Circular dependencies
- Overly complex implementations
- Missing validation at system boundaries

## Review Checklist

### Naming & Structure

- [ ] All file names use kebab-case
- [ ] File suffixes match their purpose (-adapter, -port, -dto, etc.)
- [ ] Classes/types use PascalCase
- [ ] Variables/functions use camelCase
- [ ] Files are placed in correct directories

### Architecture

- [ ] Backend follows hexagonal architecture (ports/adapters)
- [ ] Frontend follows feature-based organization
- [ ] Proper separation of concerns
- [ ] No business logic in adapters/controllers

### Code Quality

- [ ] Uses `neverthrow` for error handling
- [ ] Uses ULID for entity IDs
- [ ] Proper TypeScript types (no `any`)
- [ ] Validation at system boundaries

### Completeness

- [ ] All files listed in change manifest
- [ ] Test cases defined for each component
- [ ] Error scenarios documented
- [ ] Implementation order is logical

## Output

### Report Location

Save the review report to: `@context/IMPLEMENTATION_PLAN_REVIEW.md`

### Report Format

```markdown
# Implementation Plan Review

## Review Summary

**Status:** APPROVED | NEEDS_REVISION | BLOCKED

**Overall Assessment:** 1-2 sentences summarizing the review outcome.

## Checklist Results

### Naming & Structure

- [x] All file names use kebab-case
- [ ] File suffixes match their purpose — Issue: `userService.ts` should be `user-service.ts`
      ...

### Architecture

...

### Code Quality

...

### Completeness

...

## Issues Found

### Critical (Must Fix)

1. **[Issue Title]**
   - Location: Step N, file path
   - Problem: Description
   - Recommended Fix: How to resolve

### Warnings (Should Fix)

1. **[Issue Title]**
   - Location: Step N, file path
   - Problem: Description
   - Recommended Fix: How to resolve

### Suggestions (Nice to Have)

1. **[Suggestion Title]**
   - Location: Step N, file path
   - Suggestion: Description

## Recommended Changes

If NEEDS_REVISION, provide specific changes to make:

1. Change X to Y in Step N
2. Add Z to Step M
   ...

## Approval

- [ ] Plan is ready for execution (check when APPROVED)
```

## Guidelines

**Be thorough but pragmatic:**

- Focus on issues that will cause problems during implementation
- Don't nitpick on minor stylistic preferences that are subjective
- Prioritize architectural and naming convention violations
- Flag missing error handling and test coverage gaps

**Be specific:**

- Reference exact step numbers and file paths
- Provide concrete recommendations for fixes
- Show examples of correct patterns when flagging issues

**Be actionable:**

- Clearly categorize issues by severity (Critical/Warning/Suggestion)
- Provide the recommended fix for each issue
- Make it easy for the planner to revise the plan
