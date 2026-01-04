import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";
import type { Id } from "@/lib/id";
import type { OutboxModelMapper } from "@/lib/mapper/outbox-model-mapper";
import type { OutboxEventMongoModel } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model";
import { OutboxEvent } from "@/lib/outbox/domain/outbox-event";

export class OutboxEventMongoModelMapper implements OutboxModelMapper<
  BaseEvent<BaseProps>,
  OutboxEventMongoModel
> {
  fromDomain(event: BaseEvent<BaseProps>): OutboxEventMongoModel {
    return {
      _id: event.id,
      aggregateId: event.aggregateId,
      eventType: event.constructor.name,
      payload: event.props as Record<string, unknown>,
      occurredAt: event.occurredAt,
      publishedAt: null,
      status: "PENDING",
      retryCount: 0,
      lastError: null,
    };
  }

  fromDomains(events: BaseEvent<BaseProps>[]): OutboxEventMongoModel[] {
    return events.map((event) => this.fromDomain(event));
  }

  toDomain(model: OutboxEventMongoModel): OutboxEvent {
    return new OutboxEvent({
      id: model._id as Id,
      aggregateId: model.aggregateId as Id,
      eventType: model.eventType,
      payload: model.payload,
      occurredAt: model.occurredAt,
      publishedAt: model.publishedAt,
      status: model.status,
      retryCount: model.retryCount,
      lastError: model.lastError,
    });
  }

  toDomains(models: OutboxEventMongoModel[]): OutboxEvent[] {
    return models.map((model) => this.toDomain(model));
  }
}
