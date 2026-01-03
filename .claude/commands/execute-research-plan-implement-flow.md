# Execute Research-Plan-Implement Flow

Orchestrate a sequential workflow of research → plan → implement for a feature.

## Input

- `$ARGUMENTS` - The feature name to pass to each sub-agent

## Workflow Execution

Execute the following steps **sequentially**. Each step must complete successfully before proceeding to the next. Stop immediately if any step fails.

### Step 1: Research

Spawn a `research-report-generator` sub-agent to perform research:

```
/make-research-report $ARGUMENTS
```

Wait for completion. If the agent fails or reports an error, stop the workflow and report the failure.

### Step 2: Plan

After research completes successfully, spawn a `implementation-planner` sub-agent to create the implementation plan:

```
/make-implementation-plan $ARGUMENTS
```

Wait for completion. If the agent fails or reports an error, stop the workflow and report the failure.

### Step 3: Implement

After planning completes successfully, spawn a `implementation-executor` sub-agent to execute the implementation:

```
/execute-implementation-plan $ARGUMENTS
```

Wait for completion. Report the final status.

## Important

- Each sub-agent starts with a fresh context
- Do not proceed to the next step until the current step completes successfully
- If any step fails, immediately stop and report which step failed and why
