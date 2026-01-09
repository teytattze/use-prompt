import {
  mongoClient,
  unitOfWork,
  domainEventBus,
} from "@/composition/shared.composition";
import { PromptDtoMapper } from "@/module/prompt/application/mapper/prompt-dto.mapper";
import { PromptCreatedHandler } from "@/module/prompt/application/event-handler/prompt-created.handler";
import { CreatePromptUseCase } from "@/module/prompt/application/use-case/create-prompt.use-case";
import { ListPromptsUseCase } from "@/module/prompt/application/use-case/list-prompts.use-case";
import { SearchPromptsUseCase } from "@/module/prompt/application/use-case/search-prompts.use-case";
import { GetPromptUseCase } from "@/module/prompt/application/use-case/get-prompt.use-case";
import { VotePromptUseCase } from "@/module/prompt/application/use-case/vote-prompt.use-case";
import { RemoveVoteUseCase } from "@/module/prompt/application/use-case/remove-vote.use-case";
import { RecordPromptUsageUseCase } from "@/module/prompt/application/use-case/record-prompt-usage.use-case";
import { PromptCreatedEvent } from "@/module/prompt/domain/event/prompt-created.event";
import { PromptRouter } from "@/module/prompt/infra/http/prompt.router";
import {
  getMongoPromptCollection,
  getMongoPromptDatabase,
} from "@/module/prompt/infra/persistence/prompt-mongo.details";
import { getMongoVoteCollection } from "@/module/prompt/infra/persistence/vote-mongo.details";
import type { PromptMongoModel } from "@/module/prompt/infra/persistence/prompt-mongo.model";
import type { VoteMongoModel } from "@/module/prompt/infra/persistence/vote-mongo.model";
import { PromptMongoMapper } from "@/module/prompt/infra/persistence/prompt-mongo.mapper";
import { VoteMongoMapper } from "@/module/prompt/infra/persistence/vote-mongo.mapper";
import { PromptMongoRepository } from "@/module/prompt/infra/persistence/prompt-mongo.repository";
import { VoteMongoRepository } from "@/module/prompt/infra/persistence/vote-mongo.repository";

const promptDatabase = mongoClient.db(getMongoPromptDatabase());

const promptCollection = promptDatabase.collection<PromptMongoModel>(
  getMongoPromptCollection(),
);

const voteCollection = promptDatabase.collection<VoteMongoModel>(
  getMongoVoteCollection(),
);

const promptMongoMapper = new PromptMongoMapper();
const voteMongoMapper = new VoteMongoMapper();
const promptDtoMapper = new PromptDtoMapper();

const promptRepository = new PromptMongoRepository(
  promptCollection,
  promptMongoMapper,
);

const voteRepository = new VoteMongoRepository(voteCollection, voteMongoMapper);

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

const getPromptUseCase = new GetPromptUseCase(promptRepository, voteRepository);

const votePromptUseCase = new VotePromptUseCase(
  promptRepository,
  voteRepository,
  unitOfWork,
);

const removeVoteUseCase = new RemoveVoteUseCase(
  promptRepository,
  voteRepository,
  unitOfWork,
);

const recordPromptUsageUseCase = new RecordPromptUsageUseCase(promptRepository);

export const promptRouter = new PromptRouter(
  createPromptUseCase,
  listPromptsUseCase,
  searchPromptsUseCase,
  getPromptUseCase,
  votePromptUseCase,
  removeVoteUseCase,
  recordPromptUsageUseCase,
);
