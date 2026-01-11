# Implementation Plan - Phase N: [Phase Name]

## Phase Overview

**Goal:** 1-2 sentences describing what this phase accomplishes.

**Deliverables:** What will be working after this phase completes.

**Dependencies:** What must exist before this phase starts.

**Success Criteria:**

- Criterion 1
- Criterion 2

## Change Manifest

List every file that will be created or modified in this phase:

```
CREATE:
- path/to/new-file.ts — purpose

MODIFY:
- path/to/existing-file.ts — what changes
```

## Step-by-Step Plan

For each logical unit of work, provide:

### Step N: [Descriptive Title]

**File:** `path/to/file.ts`

**Action:** CREATE | MODIFY

**Rationale:** Why this change is needed (1 sentence)

**Pseudocode:**

```
// Describe the implementation in detailed pseudocode
// Include function signatures with types
// Show control flow and logic
// Specify error handling
// Note any validation rules

function exampleFunction(param: Type): ReturnType {
    // 1. Validate input
    //    - Check param is not null
    //    - Validate format matches X pattern

    // 2. Fetch required data
    //    - Call existingService.getData(param)
    //    - Handle not-found case: throw NotFoundError

    // 3. Apply business logic
    //    - If condition A: do X
    //    - Else if condition B: do Y
    //    - Edge case: when Z happens, handle by...

    // 4. Persist changes
    //    - Call repository.save(entity)
    //    - Emit event: 'entity.updated'

    // 5. Return result
    //    - Transform to response DTO
    //    - Include fields: a, b, c
}
```

**Dependencies:** List any imports or modules this step requires

**Tests Required:**

- Test case 1: description
- Test case 2: description

---

## Data Changes (if applicable)

**Schema/Model Updates:**

```
// New fields, tables, or model changes with types
```

**Migration Notes:**

- Migration strategy (if needed)
- Backward compatibility considerations

## Integration Points

For each external integration in this phase:

- **Service:** Name
- **Interaction:** What this phase does with it
- **Error Handling:** How failures are handled

## Edge Cases & Error Handling

| Scenario          | Handling          |
| ----------------- | ----------------- |
| Edge case 1       | How it's handled  |
| Error condition 1 | Response/recovery |

## Testing Strategy

**Unit Tests:**

- List key unit test scenarios for this phase

**Integration Tests:**

- List integration test scenarios for this phase

**Manual Verification:**

- Steps to manually verify this phase works

## Implementation Order

Recommended sequence for implementing this phase:

1. Step X — reason for ordering
2. Step Y — reason for ordering
3. ...

## Phase Completion Checklist

- [ ] All files created/modified as specified
- [ ] All tests passing
- [ ] Success criteria met
- [ ] No regressions in existing functionality
- [ ] Ready for next phase
