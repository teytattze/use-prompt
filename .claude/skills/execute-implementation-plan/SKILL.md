---
name: execute-implementation-plan
description: "Use this skill to execute an approved implementation plan and produce working code. This is phase 3 of the Research → Plan → Implementation pipeline. Translates the plan into production-quality code following the pseudocode step-by-step."
---

# Execute Implementation Plan

This skill implements features by translating approved implementation plans into production-quality code.

## When to Use This Skill

**Trigger conditions:**

- User has an approved implementation plan ready for execution
- User mentions "implement", "execute", or "build" in context of a planned feature
- User explicitly invokes `/execute-implementation-plan`
- Implementation plan exists and user wants to proceed to coding

## Pipeline Context

This is the third phase in a 3-phase context engineering pipeline:

```
Research → Plan → Implementation
```

The implementation plan has been reviewed and approved—your job is to translate it into production-quality code.

## Input Requirements

The skill requires:

- A `FEATURE.md` file at `@context/FEATURE.md` describing the requirements
- A `RESEARCH_REPORT.md` file at `@context/RESEARCH_REPORT.md` from the research phase
- An `IMPLEMENTATION_PLAN.md` file at `@context/IMPLEMENTATION_PLAN.md` from the planning phase

## Implementation Process

Work autonomously—do not ask for guidance during implementation.

### 1. Follow the Plan

Implement exactly what the plan specifies. If you discover an issue with the plan, flag it explicitly before deviating.

### 2. Follow the Implementation Order

Execute steps in the sequence defined in the "Implementation Order" section of the plan.

### 3. Match Existing Patterns

Use the reference implementations and coding patterns identified in the research phase.

### 4. One Step at a Time

Complete each step fully before moving to the next:

- Write the code
- Ensure it compiles/parses
- Write the tests specified for that step
- Verify tests pass

### 5. Handle Deviations Explicitly

If something in the plan doesn't work as expected:

- Stop and explain the issue
- Propose the minimal adjustment needed
- Note the deviation clearly in the implementation summary

## Code Quality Standards

- Follow the coding patterns from the reference implementations
- Include appropriate error handling as specified in the plan
- Add comments only where logic is non-obvious
- Ensure type safety (if applicable)
- Write tests as specified in the plan

## Progress Reporting

After completing each step, briefly report:

```
✓ Step N: [Title]
  - Files changed: list
  - Tests added: count
  - Notes: any observations (optional)
```

If you encounter a blocker:

```
⚠ Step N: [Title] — BLOCKED
  - Issue: description
  - Proposed resolution: suggestion
```

## Output

### Summary Location

Save the implementation summary to: `@context/IMPLEMENTATION_SUMMARY.md`

### Summary Template

Use the template at: `@context/template/IMPLEMENTATION_SUMMARY_TEMPLATE.md`

## Guidelines

**Execute in one shot:**

- The plan has been approved—implement all steps completely without stopping for feedback
- Document any deviations in the implementation summary rather than pausing for approval
- Complete the entire implementation before presenting results
