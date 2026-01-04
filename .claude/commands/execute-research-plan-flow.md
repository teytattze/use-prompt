# Execute Research-Plan Flow

Orchestrate a sequential workflow of research → plan for a feature.

## Input

- Feature requirements must be defined in `@context/FEATURE.md`

## Workflow Execution

Execute the following steps **sequentially**. Each step must complete successfully before proceeding to the next. Stop immediately if any step fails.

### Step 1: Research

Spawn a `research-report-generator` sub-agent to perform research:

```
/make-research-report
```

Wait for completion. If the agent fails or reports an error, stop the workflow and report the failure.

### Step 2: Plan

After research completes successfully, spawn a `implementation-planner` sub-agent to create the implementation plan:

```
/make-implementation-plan
```

Wait for completion. If the agent fails or reports an error, stop the workflow and report the failure.

## Important

- Each sub-agent starts with a fresh context
- Do not proceed to the next step until the current step completes successfully
- If any step fails, immediately stop and report which step failed and why
- All artifacts are read from and written to `@context/`
