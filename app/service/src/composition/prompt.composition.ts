import { mongoClient, unitOfWork, domainEventBus } from "@/composition/shared.composition";
import { PromptDtoMapper } from "@/module/prompt/application/mapper/prompt-dto.mapper";
import { PromptCreatedHandler } from "@/module/prompt/application/event-handler/prompt-created.handler";
import { CreatePromptUseCase } from "@/module/prompt/application/use-case/create-prompt.use-case";
import { ListPromptsUseCase } from "@/module/prompt/application/use-case/list-prompts.use-case";
import { SearchPromptsUseCase } from "@/module/prompt/application/use-case/search-prompts.use-case";
import { PromptCreatedEvent } from "@/module/prompt/domain/event/prompt-created.event";
import { PromptRouter } from "@/module/prompt/infra/http/prompt.router";
import {
  getMongoPromptCollection,
  getMongoPromptDatabase,
} from "@/module/prompt/infra/persistence/prompt-mongo.details";
import type { PromptMongoModel } from "@/module/prompt/infra/persistence/prompt-mongo.model";
import { PromptMongoMapper } from "@/module/prompt/infra/persistence/prompt-mongo.mapper";
import { PromptMongoRepository } from "@/module/prompt/infra/persistence/prompt-mongo.repository";

const promptDatabase = mongoClient.db(getMongoPromptDatabase());

const promptCollection = promptDatabase.collection<PromptMongoModel>(
  getMongoPromptCollection(),
);

const promptMongoMapper = new PromptMongoMapper();
const promptDtoMapper = new PromptDtoMapper();

const promptRepository = new PromptMongoRepository(
  promptCollection,
  promptMongoMapper,
);

const promptCreatedHandler = new PromptCreatedHandler();
domainEventBus.subscribe(PromptCreatedEvent.name, promptCreatedHandler);

const createPromptUseCase = new CreatePromptUseCase(
  promptDtoMapper,
  promptRepository,
  unitOfWork,
  domainEventBus,
);

const listPromptsUseCase = new ListPromptsUseCase(
  promptDtoMapper,
  promptRepository,
);

const searchPromptsUseCase = new SearchPromptsUseCase(
  promptDtoMapper,
  promptRepository,
);

export const promptRouter = new PromptRouter(
  createPromptUseCase,
  listPromptsUseCase,
  searchPromptsUseCase,
);
