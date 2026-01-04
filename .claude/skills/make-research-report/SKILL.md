---
name: make-research-report
description: "Use this skill to perform autonomous codebase research for a new feature. This is phase 1 of the Research → Plan → Implementation pipeline. Produces a concise research report identifying all relevant files, dependencies, data flows, and constraints needed to implement a feature."
---

# Make Research Report

This skill enables autonomous codebase exploration to produce research reports that inform implementation planning.

## When to Use This Skill

**Trigger conditions:**

- User wants to understand the codebase before implementing a feature
- User mentions "research", "explore", or "analyze" in context of a new feature
- User is starting a new feature and needs context discovery
- User explicitly invokes `/make-research-report`

## Pipeline Context

This is the first phase in a 3-phase context engineering pipeline:

```
Research → Plan → Implementation
```

The research report produced here enables detailed implementation design in the planning phase.

## Input Requirements

The skill requires:

- A `FEATURE.md` file at `@context/FEATURE.md` describing the requirements

## Discovery Process

Work autonomously—do not ask for guidance during discovery.

### 1. Identify Entry Points

Find where the feature would integrate:

- Routes and handlers
- UI components
- API endpoints
- Event listeners

### 2. Trace Data Flow

Follow how related data moves through the system:

- API → Service → Repository → Database
- Request/response transformations
- State management flows

### 3. Map Dependencies

Identify modules and services the feature will interact with:

- Internal modules and utilities
- External services and APIs
- Shared libraries and helpers

### 4. Find Patterns

Look for similar existing features to understand:

- Conventions and coding patterns
- Reusable code and components
- Established architectural patterns

### 5. Check Constraints

Note any limitations or requirements:

- Validation rules
- Auth requirements
- Rate limits
- Business logic constraints

## What to Examine

- Directory structure and file organization
- Existing similar features (as implementation reference)
- Shared utilities, helpers, and base classes
- Configuration files and environment variables
- Database schemas / models / migrations
- API contracts and type definitions
- Test patterns and fixtures

## Output

### Report Location

Save the report to: `@context/RESEARCH_REPORT.md`

### Report Template

Use the template at: `@context/template/RESEARCH_REPORT_TEMPLATE.md`

## Guidelines

**Keep the output concise:**

- Aim for a report an engineer can review in 5 minutes
- Avoid verbose explanations
- Use bullet points and file paths
- Focus on actionable information for the planning phase
