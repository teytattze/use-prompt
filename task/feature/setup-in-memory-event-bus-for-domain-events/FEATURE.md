# Goal

Publish and subscribe domain event via in-memory event bus while ensuring transaction atomicity

# Background

The existing @app/service has implemented unit of work pattern. However, there is no way to publish the domain events.

# Problem

Domain events can't be published or consumed which will lead to data inconsistent

# Solution

Create an in-memory domain event bus that allow application layer to publish domain events and domain event handler to consume domain event

# Proposal

- Use the event emitter from bun as the in-memory domain event bus
- Ensure the unit of work ctx is passed as an argument while publishing
- Ensure the application layer waits for all the events being subscribed and processed

# Acceptance Criteria

- All the domain events are being published
- Ensure transaction atomicity. Eg. if a domain event handler fails, the aggregate operation will not be commited as well
- Data consistency is a must
