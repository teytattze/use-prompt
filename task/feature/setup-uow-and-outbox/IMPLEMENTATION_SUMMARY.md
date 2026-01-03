# Implementation Summary

## 1. Overview

Implemented the Unit of Work (UoW) and Transactional Outbox patterns to enable reliable domain event persistence. The UoW pattern coordinates MongoDB transactions across aggregate and event persistence, while the Outbox pattern stores domain events in a dedicated collection for eventual publishing. This ensures atomicity: either both the aggregate and its events are persisted, or neither is.

## 2. Files Changed

```
CREATED:
- app/service/src/lib/outbox/outbox-event-model.ts                      - Outbox event MongoDB model type with status tracking
- app/service/src/lib/outbox/outbox-event-mapper.ts                     - Maps BaseEvent to OutboxEventModel
- app/service/src/lib/outbox/port/outbox-repository-port.ts             - Outbox repository interface
- app/service/src/lib/outbox/adapter/outbox-mongo-repository-adapter.ts - MongoDB outbox implementation
- app/service/src/lib/outbox/adapter/outbox-mongo-repository-adapter.test.ts - Unit tests (5 tests)
- app/service/src/lib/unit-of-work/port/unit-of-work-port.ts            - UoW interface
- app/service/src/lib/unit-of-work/adapter/mongo-unit-of-work-adapter.ts - MongoDB UoW implementation
- app/service/src/lib/unit-of-work/adapter/mongo-unit-of-work-adapter.test.ts - Unit tests (6 tests)
- app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.test.ts - Unit tests (4 tests)

MODIFIED:
- compose.yml                                                           - Added replica set config and healthcheck for transactions
- app/service/src/lib/app-config.ts                                     - Added mongo.transactionTimeoutMs config, updated URI for replica set
- app/service/src/lib/app-context.ts                                    - Added db.session for transaction propagation, withSession() and createAppContext() helpers
- app/service/src/lib/domain/base-event.ts                              - Added occurredAt timestamp
- app/service/src/lib/domain/base-aggregate.ts                          - Added pullEvents() and hasEvents methods
- app/service/src/lib/http/middleware/setup-app-context-middleware.ts   - Added db: {} to context
- app/service/src/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-repository-adapter.ts - Access session via ctx.db.session
- app/service/src/module/prompt/application/use-case/create-prompt-use-case-adapter.ts - Integrated UoW and Outbox
- app/service/src/module/prompt/adapter/inbound/http/api.ts             - Wired UoW and Outbox dependencies
- app/service/src/module/prompt/application/use-case/list-prompts-use-case-adapter.test.ts - Added db to mock context
```

## 3. Tests Added

| Test File                                          | Test Cases | Coverage                                  |
| -------------------------------------------------- | ---------- | ----------------------------------------- |
| outbox-mongo-repository-adapter.test.ts            | 5 tests    | Insert success/failure, session handling  |
| mongo-unit-of-work-adapter.test.ts                 | 6 tests    | Commit/abort, session propagation, errors |
| create-prompt-use-case-adapter.test.ts             | 4 tests    | UoW integration, rollback scenarios       |

## 4. Deviations from Plan

| Step | Planned                                    | Actual                                      | Reason                                                                 |
| ---- | ------------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------- |
| 15   | Only update api.ts                         | Also updated setup-app-context-middleware.ts | The middleware creates AppContext and needed db: {} property           |
| 18   | Modify existing test                       | Created new test file                       | No existing test file existed for CreatePromptUseCaseAdapter           |
| -    | Update list-prompts test                   | Added db: {} to mockCtx                     | Existing test needed update to match new AppContext type               |

## 5. Verification

- [x] All tests pass (18 tests across 4 files)
- [x] Type checking passes
- [x] Feature works as specified
- [x] No unresolved deviations from plan

## 6. Manual Verification Steps

Steps to manually verify the feature works:

1. Stop and remove existing MongoDB container:
   ```bash
   docker compose down -v
   ```

2. Start MongoDB with replica set:
   ```bash
   docker compose up -d
   ```

3. Wait for healthcheck to pass (replica set initialization, ~30 seconds):
   ```bash
   docker compose ps  # Wait until mongo shows "healthy"
   ```

4. Start the service:
   ```bash
   bun run dev --filter ./app/service
   ```

5. Create a prompt via API:
   ```bash
   curl -X POST http://localhost:3000/api/v1/prompt \
     -H "Content-Type: application/json" \
     -d '{"title": "Test", "messages": [{"type": "INSTRUCTION", "content": "Test content", "order": 0}]}'
   ```

6. Verify prompt is in prompts collection:
   ```bash
   mongosh "mongodb://root:password@localhost:27017/use_prompt?authSource=admin&replicaSet=rs0&directConnection=true" \
     --eval "db.prompts.find().pretty()"
   ```

7. Verify event is in outbox_events collection:
   ```bash
   mongosh "mongodb://root:password@localhost:27017/use_prompt?authSource=admin&replicaSet=rs0&directConnection=true" \
     --eval "db.outbox_events.find().pretty()"
   ```

8. Verify outbox index exists:
   ```bash
   mongosh "mongodb://root:password@localhost:27017/use_prompt?authSource=admin&replicaSet=rs0&directConnection=true" \
     --eval "db.outbox_events.getIndexes()"
   ```

## 7. Notes

- **MongoDB Replica Set Required**: Transactions only work with replica sets. The compose.yml now initializes a single-node replica set automatically via healthcheck.

- **Connection String Updated**: The MongoDB URI now includes `?replicaSet=rs0&directConnection=true` to connect to the replica set.

- **Event Publisher Not Implemented**: The Outbox pattern is complete for persisting events, but the background worker to publish events is out of scope for this phase (as noted in the FEATURE.md).

- **Backward Compatibility**: Repositories continue to work without transactions when `ctx.db.session` is undefined, making this change backward compatible.

- **Index Creation**: The outbox collection index is created at application startup (idempotent operation with `background: true`).
