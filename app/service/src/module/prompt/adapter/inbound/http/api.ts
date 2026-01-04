import { appConfig } from "@/lib/app-config";
import { mongoClient } from "@/lib/mongo/mongo-client";
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

const promptMongoModelMapper = new PromptMongoModelMapper();
const promptUseCaseDtoMapper = new PromptUseCaseDtoMapper();

const promptMongoRepository = new PromptMongoRepository(
  promptCollection,
  promptMongoModelMapper,
);

const unitOfWork = new MongoUnitOfWorkAdapter(mongoClient, {
  transactionTimeoutMs: appConfig.mongo.transactionTimeoutMs,
});

const createPromptUseCase = new CreatePromptUseCaseAdapter(
  promptUseCaseDtoMapper,
  promptMongoRepository,
  unitOfWork,
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
