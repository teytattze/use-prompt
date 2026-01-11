---
name: execute-multi-phases-implementation-plan
description: "Use this skill to execute a multi-phase implementation plan sequentially. This is phase 3 of the Research → Multi-Phase Plan → Implementation pipeline. Spawns an agent for each phase and executes them in order, producing implementation summaries for each phase."
---

# Execute Multi-Phases Implementation Plan

This skill implements features by executing multi-phase implementation plans sequentially, spawning dedicated agents for each phase.

## When to Use This Skill

**Trigger conditions:**

- User has approved multi-phase implementation plans ready for execution
- User mentions "execute phases", "implement phases", or "run phases"
- User explicitly invokes `/execute-multi-phases-implementation-plan`
- `IMPLEMENTATION_PLAN_OVERVIEW.md` exists with phase plans
- User wants to proceed with phased implementation

## Pipeline Context

This is the third phase in the multi-phase context engineering pipeline:

```
Research → Multi-Phase Plan → Multi-Phase Implementation
```

The phase plans have been reviewed and approved—your job is to orchestrate their sequential execution.

## Input Requirements

The skill requires:

- A `FEATURE.md` file at `@context/FEATURE.md` describing the requirements
- A `RESEARCH_REPORT.md` file at `@context/RESEARCH_REPORT.md` from the research phase
- An `IMPLEMENTATION_PLAN_OVERVIEW.md` file at `@context/IMPLEMENTATION_PLAN_OVERVIEW.md` from the planning phase
- Phase plan files at `@context/IMPLEMENTATION_PLAN_PHASE_N_[NAME].md` (one per phase)

## Execution Process

Work autonomously—do not ask for guidance during execution.

### 1. Read the Overview

Parse `IMPLEMENTATION_PLAN_OVERVIEW.md` to identify:

- Total number of phases
- Phase names and their plan document paths
- Phase dependencies and execution order
- Critical path through the phases

### 2. Discover Phase Plans

Find all phase plan files matching the pattern:

```
@context/IMPLEMENTATION_PLAN_PHASE_*_*.md
```

Verify all phases referenced in the overview have corresponding plan files.

### 3. Execute Phases Sequentially

For each phase in order:

1. **Announce the phase:**

   ```
   ═══════════════════════════════════════════════════════════════
   Phase N: [Phase Name]
   ═══════════════════════════════════════════════════════════════
   Goal: [Phase goal from plan]
   Plan: @context/IMPLEMENTATION_PLAN_PHASE_N_[NAME].md
   ```

2. **Spawn an implementation agent:**

   Use the Task tool with an `implementation-executor` agent to execute the phase. Pass the specific phase plan file path and relevant context.

   The agent prompt should include:
   - The phase plan file path
   - Reference to the feature and research documents
   - Instruction to follow the plan exactly
   - Instruction to save summary to `@context/IMPLEMENTATION_SUMMARY_PHASE_N_[NAME].md`

3. **Wait for completion:**

   Monitor the agent's progress and capture the result.

4. **Report phase status:**

   ```
   ✓ Phase N: [Phase Name] — COMPLETED
     - Files changed: [count]
     - Tests added: [count]
     - Summary: @context/IMPLEMENTATION_SUMMARY_PHASE_N_[NAME].md
   ```

   Or if blocked:

   ```
   ⚠ Phase N: [Phase Name] — BLOCKED
     - Issue: [description]
     - Resolution needed: [suggestion]
   ```

5. **Proceed or halt:**
   - If phase completed successfully, proceed to the next phase
   - If phase blocked, halt and report the issue

### 4. Handle Parallel Phases

If the overview indicates phases can run in parallel:

- Spawn agents for parallel phases simultaneously
- Wait for all parallel phases to complete before proceeding
- Report combined status

### 5. Complete Execution

After all phases complete:

1. Generate overall implementation summary
2. Report final status

## Agent Spawning

Use the Task tool to spawn implementation agents:

```
Task tool parameters:
- subagent_type: "implementation-executor"
- description: "Execute Phase N: [Phase Name]"
- prompt: See prompt template below
```

**Agent Prompt Template:**

```
Execute Implementation Phase

You are executing Phase N of a multi-phase implementation plan.

## Context Files
- Feature: @context/FEATURE.md
- Research: @context/RESEARCH_REPORT.md
- Phase Plan: @context/IMPLEMENTATION_PLAN_PHASE_N_[NAME].md

## Instructions
1. Read the phase plan thoroughly
2. Follow the implementation order specified in the plan
3. Complete each step fully before moving to the next
4. Write tests as specified in the plan
5. Handle deviations explicitly—document any issues

## Output
Save the implementation summary to: @context/IMPLEMENTATION_SUMMARY_PHASE_N_[NAME].md

Use this format for the summary:
- Phase: N - [Name]
- Status: COMPLETED | PARTIAL | BLOCKED
- Files Changed: list with paths
- Tests Added: count and names
- Deviations: any changes from the plan
- Notes: observations or issues

## Code Quality
- Follow existing patterns from reference implementations
- Include appropriate error handling
- Ensure type safety
- Write tests as specified
```

## Progress Reporting

### During Execution

Report progress after each phase:

```
═══════════════════════════════════════════════════════════════
Execution Progress: Phase N/M completed
═══════════════════════════════════════════════════════════════
✓ Phase 1: Foundation — COMPLETED
✓ Phase 2: Domain — COMPLETED
→ Phase 3: Application — IN PROGRESS
○ Phase 4: Integration — PENDING
```

### Final Report

After all phases complete:

```
═══════════════════════════════════════════════════════════════
Multi-Phase Implementation Complete
═══════════════════════════════════════════════════════════════

Summary:
- Total Phases: N
- Completed: N
- Files Changed: X
- Tests Added: Y

Phase Summaries:
- Phase 1: @context/IMPLEMENTATION_SUMMARY_PHASE_1_[NAME].md
- Phase 2: @context/IMPLEMENTATION_SUMMARY_PHASE_2_[NAME].md
...

Overall Summary: @context/IMPLEMENTATION_SUMMARY.md
```

## Output

### Summary Locations

Save phase summaries to:

- `@context/IMPLEMENTATION_SUMMARY_PHASE_N_[NAME].md` (one per phase)

Save overall summary to:

- `@context/IMPLEMENTATION_SUMMARY.md`

### Overall Summary Content

The overall summary should include:

- Feature name and description
- Phases executed with status
- Total files changed across all phases
- Total tests added across all phases
- Any deviations from the original plans
- Final verification steps performed

## Error Handling

### Phase Failure

If a phase fails:

1. Capture the error details from the agent
2. Report the failure clearly
3. Stop execution (do not proceed to dependent phases)
4. Suggest resolution options

### Recovery

To recover from a failed phase:

1. Fix the underlying issue
2. Re-run this skill
3. It will detect completed phases and resume from the failed phase

## Guidelines

**Sequential by default:**

- Execute phases in the order specified by the overview
- Only run phases in parallel when explicitly marked as parallel-safe
- Wait for dependencies before starting dependent phases

**Maintain context:**

- Each agent receives the same base context
- Phase-specific context is passed via the phase plan file
- Agents share the codebase but run independently

**Track everything:**

- Every phase produces its own summary
- The overall summary aggregates all phase results
- Deviations are documented at both phase and overall levels

**Fail fast:**

- If a critical phase fails, halt immediately
- Report which phases completed and which failed
- Preserve the ability to resume from the failure point
