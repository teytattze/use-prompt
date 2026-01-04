# Goal

A poll-based outbox library to supports domain events

# Background

- Basic outbox repository is setup
- Domain events are stored in outbox event collection

# Problem

- **Unprocessed Events**: Events accumulate in outbox but are never consumed
- **No Event Handlers**: No infrastructure to register and invoke handlers per event type
- **No Delivery Guarantees**: No retry logic or failure tracking for event processing
- **No Cross-Aggregate Reactions**: Aggregates cannot react to each other's events

# Solution

Refactor the existing outbox repository and create a outbox library that:

- **Polls** the outbox collection for new inserts events
- **Routes** events to registered handlers based on `eventType`
- **Updates** event status to `PROCESSED` or `FAILED` after processing

# Proposal

- Follow the DDD hexagonal (port/adapter) pattern
- Encapsulate the library by exposing a configurable `OutboxProcessor` & `OutboxFacade` in @app/service/src/lib/outbox
- The existing bounded context such as `prompt` will import the `OutboxProcessor` and configure it (such as database name, collection)
- The existing bounded context such as `prompt` will import the `OutboxFacade` to publish domain events

# Acceptance Criteria

- Created an extensible outbox library
- Intgrated with the new outbox library
- Wired dependencies within the bounded context
- `index.ts` should only import and call run
