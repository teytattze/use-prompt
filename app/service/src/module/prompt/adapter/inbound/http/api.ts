import { mongoClient } from "@/lib/mongo/mongo-client";
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

const promptCollection = mongoClient
  .db(getMongoPromptDatabase())
  .collection<PromptMongoModel>(getMongoPromptCollection());
const promptMongoModelMapper = new PromptMongoModelMapper();
const promptMongoRepository = new PromptMongoRepository(
  promptCollection,
  promptMongoModelMapper,
);

const promptUseCaseDtoMapper = new PromptUseCaseDtoMapper();
const createPromptUseCase = new CreatePromptUseCaseAdapter(
  promptUseCaseDtoMapper,
  promptMongoRepository,
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
