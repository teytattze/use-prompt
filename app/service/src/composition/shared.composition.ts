import { appConfig } from "@/shared/core/app-config";
import { mongoClient } from "@/infra/mongo/mongo-client";
import { MongoUnitOfWork } from "@/infra/mongo/mongo-unit-of-work";
import { InMemoryEventBus } from "@/infra/event-bus/in-memory-event-bus";

export const unitOfWork = new MongoUnitOfWork(mongoClient, {
  transactionTimeoutMs: appConfig.mongo.transactionTimeoutMs,
});

export const domainEventBus = new InMemoryEventBus();

export { mongoClient };
