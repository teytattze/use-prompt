import {
  domainEventBus,
  mongoClient,
  unitOfWork,
} from "@/composition/shared.composition";
import { PromptCreatedHandler } from "@/module/prompt/application/event-handler/prompt-created.handler";
import { PromptDtoMapper } from "@/module/prompt/application/mapper/prompt-dto.mapper";
import { ArchivePromptUseCase } from "@/module/prompt/application/use-case/archive-prompt.use-case";
import { CreatePromptUseCase } from "@/module/prompt/application/use-case/create-prompt.use-case";
import { GetPromptUseCase } from "@/module/prompt/application/use-case/get-prompt.use-case";
import { ListPromptsUseCase } from "@/module/prompt/application/use-case/list-prompts.use-case";
import { ListRecentUseCase } from "@/module/prompt/application/use-case/list-recent.use-case";
import { ListTrendingUseCase } from "@/module/prompt/application/use-case/list-trending.use-case";
import { ListUserPromptsUseCase } from "@/module/prompt/application/use-case/list-user-prompts.use-case";
import { SearchPromptsBrowseUseCase } from "@/module/prompt/application/use-case/search-prompts-browse.use-case";
import { SearchPromptsUseCase } from "@/module/prompt/application/use-case/search-prompts.use-case";
import { PromptCreatedEvent } from "@/module/prompt/domain/event/prompt-created.event";
import {
  PromptRouter,
  UserPromptsRouter,
} from "@/module/prompt/infra/http/prompt.router";
import {
  getMongoPromptCollection,
  getMongoPromptDatabase,
} from "@/module/prompt/infra/persistence/prompt-mongo.details";
import { PromptMongoMapper } from "@/module/prompt/infra/persistence/prompt-mongo.mapper";
import type { PromptMongoModel } from "@/module/prompt/infra/persistence/prompt-mongo.model";
import { PromptMongoRepository } from "@/module/prompt/infra/persistence/prompt-mongo.repository";
import type { VoteRepositoryPort } from "@/module/vote/port/vote-repository.port";

// Database and base components (shared, no VoteRepository dependency)
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

// Event handler registration
const promptCreatedHandler = new PromptCreatedHandler();
domainEventBus.subscribe(PromptCreatedEvent.name, promptCreatedHandler);

// Use case that doesn't need VoteRepository
const createPromptUseCase = new CreatePromptUseCase(
  promptDtoMapper,
  promptRepository,
  unitOfWork,
  domainEventBus,
);

const archivePromptUseCase = new ArchivePromptUseCase(
  promptRepository,
  unitOfWork,
  domainEventBus,
);

/**
 * Composes the prompt module with VoteRepository dependency.
 * This function should be called after the Vote module is composed.
 */
export function composePromptModule(voteRepository: VoteRepositoryPort) {
  // Use cases that need VoteRepository for aura calculations
  const listPromptsUseCase = new ListPromptsUseCase(
    promptDtoMapper,
    promptRepository,
    voteRepository,
  );

  const searchPromptsUseCase = new SearchPromptsUseCase(
    promptDtoMapper,
    promptRepository,
    voteRepository,
  );

  const getPromptUseCase = new GetPromptUseCase(
    promptDtoMapper,
    promptRepository,
    voteRepository,
  );

  const listUserPromptsUseCase = new ListUserPromptsUseCase(
    promptDtoMapper,
    promptRepository,
    voteRepository,
  );

  // Browse use cases (use repository's aggregation with $lookup for aura)
  const listTrendingUseCase = new ListTrendingUseCase(
    promptDtoMapper,
    promptRepository,
  );

  const listRecentUseCase = new ListRecentUseCase(
    promptDtoMapper,
    promptRepository,
  );

  const searchPromptsBrowseUseCase = new SearchPromptsBrowseUseCase(
    promptDtoMapper,
    promptRepository,
  );

  // Routers
  const promptRouter = new PromptRouter(
    createPromptUseCase,
    listPromptsUseCase,
    searchPromptsUseCase,
    archivePromptUseCase,
    getPromptUseCase,
    listTrendingUseCase,
    listRecentUseCase,
    searchPromptsBrowseUseCase,
  );

  const userPromptsRouter = new UserPromptsRouter(listUserPromptsUseCase);

  return {
    promptRouter,
    userPromptsRouter,
    listPromptsUseCase,
    searchPromptsUseCase,
    getPromptUseCase,
    listUserPromptsUseCase,
    listTrendingUseCase,
    listRecentUseCase,
    searchPromptsBrowseUseCase,
  };
}

// Export promptRepository for use by other modules (e.g., Vote module)
export { promptRepository };
