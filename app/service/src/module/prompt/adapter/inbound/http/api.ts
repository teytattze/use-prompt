import { appConfig } from "@/lib/app-config";
import { createAppContext } from "@/lib/app-context";
import { appLogger } from "@/lib/app-logger";
import { mongoClient } from "@/lib/mongo/mongo-client";
import {
  getOutboxEventMongoCollection,
  withOutboxEventMongoCollectionIndexes,
} from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-details";
import type { OutboxEventMongoModel } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model";
import { OutboxEventMongoModelMapper } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model-mapper";
import { OutboxEventMongoRepositoryAdapter } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-repository-adapter";
import { OutboxFacade } from "@/lib/outbox/outbox-facade";
import { MongoUnitOfWorkAdapter } from "@/lib/unit-of-work/adapter/mongo-unit-of-work-adapter";
import { PromptRouterFactory } from "@/module/prompt/adapter/inbound/http/router/prompt-router-factory";
import {
  getMongoPromptCollection,
  getMongoPromptDatabase,
} from "@/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-details";
import type { PromptMongoModel } from "@/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model";
import { PromptMongoModelMapper } from "@/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model-mapper";
import { PromptMongoRepository } from "@/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-repository-adapter";
import { PromptUseCaseDtoMapper } from "@/module/prompt/application/mapper/prompt-use-case-dto-mapper";
import { CreatePromptUseCaseAdapter } from "@/module/prompt/application/use-case/create-prompt-use-case-adapter";
import { ListPromptsUseCaseAdapter } from "@/module/prompt/application/use-case/list-prompts-use-case-adapter";

const promptDatabase = mongoClient.db(getMongoPromptDatabase());

const promptCollection = promptDatabase.collection<PromptMongoModel>(
  getMongoPromptCollection(),
);
const outboxEventCollection = await withOutboxEventMongoCollectionIndexes(
  promptDatabase.collection<OutboxEventMongoModel>(
    getOutboxEventMongoCollection(),
  ),
);

const promptMongoModelMapper = new PromptMongoModelMapper();
const promptUseCaseDtoMapper = new PromptUseCaseDtoMapper();

const promptMongoRepository = new PromptMongoRepository(
  promptCollection,
  promptMongoModelMapper,
);

const outboxEventModelMapper = new OutboxEventMongoModelMapper();
const outboxRepository = new OutboxEventMongoRepositoryAdapter(
  outboxEventCollection,
  outboxEventModelMapper,
);

const unitOfWork = new MongoUnitOfWorkAdapter(mongoClient, {
  transactionTimeoutMs: appConfig.mongo.transactionTimeoutMs,
});

const createPromptUseCase = new CreatePromptUseCaseAdapter(
  promptUseCaseDtoMapper,
  promptMongoRepository,
  unitOfWork,
  outboxRepository,
);
const listPromptsUseCase = new ListPromptsUseCaseAdapter(
  promptUseCaseDtoMapper,
  promptMongoRepository,
);

const promptHttpRouterV1Factory = new PromptRouterFactory(
  createPromptUseCase,
  listPromptsUseCase,
);
export const promptHttpRouterV1 = promptHttpRouterV1Factory.make();

const outboxAppContext = createAppContext({
  config: appConfig,
  logger: appLogger,
});

export const outboxFacade = new OutboxFacade({
  ctx: outboxAppContext,
  config: appConfig.outbox,
  repository: outboxRepository,
});

// Register event handlers here
// Example: outboxFacade.registerHandler("PromptCreatedEvent", new PromptCreatedEventHandler());
// NOTE: Handlers will be implemented by bounded contexts as needed
