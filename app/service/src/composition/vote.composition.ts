import {
  domainEventBus,
  mongoClient,
  unitOfWork,
} from "@/composition/shared.composition";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import { VoteDtoMapper } from "@/module/vote/application/mapper/vote-dto.mapper";
import { CastVoteUseCase } from "@/module/vote/application/use-case/cast-vote.use-case";
import { ChangeVoteUseCase } from "@/module/vote/application/use-case/change-vote.use-case";
import { GetUserVoteUseCase } from "@/module/vote/application/use-case/get-user-vote.use-case";
import { RemoveVoteUseCase } from "@/module/vote/application/use-case/remove-vote.use-case";
import { VoteRouter } from "@/module/vote/infra/http/vote.router";
import {
  getMongoVoteCollection,
  getMongoVoteDatabase,
} from "@/module/vote/infra/persistence/vote-mongo.details";
import { VoteMongoMapper } from "@/module/vote/infra/persistence/vote-mongo.mapper";
import type { VoteMongoModel } from "@/module/vote/infra/persistence/vote-mongo.model";
import { VoteMongoRepository } from "@/module/vote/infra/persistence/vote-mongo.repository";

export function composeVoteModule(promptRepository: PromptRepositoryPort) {
  // Database
  const voteDatabase = mongoClient.db(getMongoVoteDatabase());
  const voteCollection = voteDatabase.collection<VoteMongoModel>(
    getMongoVoteCollection(),
  );

  // Mappers
  const voteMongoMapper = new VoteMongoMapper();
  const voteDtoMapper = new VoteDtoMapper();

  // Repository
  const voteRepository = new VoteMongoRepository(
    voteCollection,
    voteMongoMapper,
  );

  // Use Cases
  const castVoteUseCase = new CastVoteUseCase(
    voteDtoMapper,
    voteRepository,
    promptRepository,
    unitOfWork,
    domainEventBus,
  );

  const changeVoteUseCase = new ChangeVoteUseCase(
    voteDtoMapper,
    voteRepository,
    unitOfWork,
    domainEventBus,
  );

  const removeVoteUseCase = new RemoveVoteUseCase(
    voteRepository,
    unitOfWork,
    domainEventBus,
  );

  const getUserVoteUseCase = new GetUserVoteUseCase(
    voteDtoMapper,
    voteRepository,
  );

  // Router
  const voteRouter = new VoteRouter(
    castVoteUseCase,
    changeVoteUseCase,
    removeVoteUseCase,
    getUserVoteUseCase,
  );

  return {
    voteRepository,
    castVoteUseCase,
    changeVoteUseCase,
    removeVoteUseCase,
    getUserVoteUseCase,
    voteRouter,
  };
}
