---
name: make-implementation-plan
description: "Use this skill to create a detailed implementation plan from a research report. This is phase 2 of the Research → Plan → Implementation pipeline. Produces a step-by-step plan with pseudocode that an engineer can validate before any code is written."
---

# Make Implementation Plan

This skill creates comprehensive implementation plans that guide engineers through feature development.

## When to Use This Skill

**Trigger conditions:**

- User has completed research and needs an implementation plan
- User mentions "plan", "design", or "blueprint" in context of a feature
- User explicitly invokes `/make-implementation-plan`
- Research report exists and user wants to proceed to planning

## Pipeline Context

This is the second phase in a 3-phase context engineering pipeline:

```
Research → Plan → Implementation
```

The implementation plan produced here enables mechanical code implementation in the final phase.

## Input Requirements

The skill requires:

- A `FEATURE.md` file at `@context/FEATURE.md` describing the requirements
- A `RESEARCH_REPORT.md` file at `@context/RESEARCH_REPORT.md` from the research phase

## Planning Process

Work autonomously—do not ask for guidance during planning.

### 1. Review Research

Analyze the research report to understand:

- Entry points and integration areas
- Data flows and transformations
- Dependencies and constraints
- Existing patterns to follow

### 2. Define File Changes

For every file to be created or modified:

- Specify the exact file path
- Describe what changes are needed
- Note dependencies on other files

### 3. Write Pseudocode

Include detailed pseudocode with:

- Types and function signatures
- Control flow logic
- Business logic implementation
- Error handling for each operation

### 4. Plan Error Handling

Address failure modes:

- Validation errors
- External service failures
- Edge cases and boundary conditions
- Recovery strategies

### 5. Define Test Cases

For each component:

- Unit test scenarios
- Integration test cases
- Edge case coverage
- Mock/stub requirements

### 6. Order Implementation

Recommend implementation order:

- Foundation components first
- Dependencies before dependents
- Core logic before edge cases
- Tests alongside implementation

## What to Include

- Every file to be created or modified
- Detailed pseudocode with types and signatures
- Control flow and business logic
- Error handling for each step
- Test cases for each component
- Integration points and failure modes
- Recommended implementation order

## Output

### Plan Location

Save the plan to: `@context/IMPLEMENTATION_PLAN.md`

### Plan Template

Use the template at: `@context/template/IMPLEMENTATION_PLAN_TEMPLATE.md`

## Guidelines

**Be thorough:**

- The engineer reviewing this plan should identify any design issues before implementation starts
- Include enough detail that implementation becomes primarily a translation exercise
- Address edge cases and error handling upfront
- Make the plan specific enough for mechanical implementation
