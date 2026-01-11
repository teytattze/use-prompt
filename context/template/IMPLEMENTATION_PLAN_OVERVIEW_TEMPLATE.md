# Implementation Plan Overview

## Feature Summary

2-3 sentences describing the overall feature and the phased approach.

## Phase Breakdown

| Phase | Name       | Goal                       | Est. Complexity |
| ----- | ---------- | -------------------------- | --------------- |
| 1     | Foundation | Set up core infrastructure | Low/Medium/High |
| 2     | Domain     | Implement business logic   | Low/Medium/High |
| N     | ...        | ...                        | ...             |

## Phase Dependency Graph

```
Phase 1: Foundation
    │
    ▼
Phase 2: Domain
    │
    ├──────────┐
    ▼          ▼
Phase 3A    Phase 3B  (can run in parallel)
    │          │
    └────┬─────┘
         ▼
    Phase 4: Integration
```

## Phase Details

### Phase 1: [Name]

**Plan Document:** `@context/IMPLEMENTATION_PLAN_PHASE_1_[NAME].md`

**Goal:** Brief description

**Key Deliverables:**

- Deliverable 1
- Deliverable 2

**Files Affected:** N files (X new, Y modified)

---

### Phase 2: [Name]

**Plan Document:** `@context/IMPLEMENTATION_PLAN_PHASE_2_[NAME].md`

**Goal:** Brief description

**Key Deliverables:**

- Deliverable 1
- Deliverable 2

**Files Affected:** N files (X new, Y modified)

**Depends On:** Phase 1

---

## Critical Path

The minimum sequence of phases to complete the feature:

```
Phase 1 → Phase 2 → Phase N
```

## Risk Assessment

| Risk               | Impact | Mitigation               |
| ------------------ | ------ | ------------------------ |
| Risk 1             | High   | Mitigation strategy      |
| Phase N complexity | Medium | Break into smaller steps |

## Rollback Strategy

For each phase, describe how to rollback if issues arise:

- **Phase 1:** Rollback approach
- **Phase 2:** Rollback approach

## Success Metrics

How to know the full implementation is successful:

- Metric 1
- Metric 2
- All phase success criteria met
