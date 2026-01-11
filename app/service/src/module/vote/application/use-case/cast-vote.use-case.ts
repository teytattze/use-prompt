import { type Result, err } from "neverthrow";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import type { VoteDto } from "@/module/vote/application/dto/vote.dto";
import type { VoteDtoMapper } from "@/module/vote/application/mapper/vote-dto.mapper";
import { VoteAggregate } from "@/module/vote/domain/aggregate/vote.aggregate";
import type {
  CastVoteInput,
  CastVoteUseCasePort,
} from "@/module/vote/port/cast-vote-use-case.port";
import type { VoteRepositoryPort } from "@/module/vote/port/vote-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type { DomainEventBusPort } from "@/shared/port/domain-event-bus.port";
import type { UnitOfWorkPort } from "@/shared/port/unit-of-work.port";

export class CastVoteUseCase implements CastVoteUseCasePort {
  #voteDtoMapper: VoteDtoMapper;
  #voteRepository: VoteRepositoryPort;
  #promptRepository: PromptRepositoryPort;
  #unitOfWork: UnitOfWorkPort;
  #eventBus: DomainEventBusPort;

  constructor(
    voteDtoMapper: VoteDtoMapper,
    voteRepository: VoteRepositoryPort,
    promptRepository: PromptRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    eventBus: DomainEventBusPort,
  ) {
    this.#voteDtoMapper = voteDtoMapper;
    this.#voteRepository = voteRepository;
    this.#promptRepository = promptRepository;
    this.#unitOfWork = unitOfWork;
    this.#eventBus = eventBus;
  }

  async execute(
    ctx: AppContext,
    input: CastVoteInput,
  ): Promise<Result<VoteDto, AppError>> {
    // Ensure user is authenticated
    if (!ctx.user) {
      return err(AppError.from("unauthorized"));
    }

    const userId = ctx.user.id;

    // 1. Validate prompt exists and is not archived
    const promptResult = await this.#promptRepository.findById(
      ctx,
      input.promptId,
    );
    if (promptResult.isErr()) {
      return err(promptResult.error);
    }

    const prompt = promptResult.value;
    if (!prompt) {
      return err(AppError.from("not_found", { message: "Prompt not found" }));
    }

    if (prompt.isArchived) {
      return err(
        AppError.from("prompt_archived", {
          message: "Cannot vote on archived prompt",
        }),
      );
    }

    // 2. Check user is not voting on own prompt
    if (prompt.authorId === userId) {
      return err(
        AppError.from("self_vote", {
          message: "Cannot vote on your own prompt",
        }),
      );
    }

    // 3. Check for existing vote (no duplicates)
    const existingVoteResult = await this.#voteRepository.findByPromptAndUser(
      ctx,
      {
        promptId: input.promptId,
        userId,
      },
    );
    if (existingVoteResult.isErr()) {
      return err(existingVoteResult.error);
    }

    if (existingVoteResult.value !== null) {
      return err(
        AppError.from("conflict", {
          message: "Vote already exists. Use change vote instead.",
        }),
      );
    }

    // 4. Create vote aggregate
    const voteAggregate = VoteAggregate.cast({
      promptId: input.promptId,
      userId,
      value: input.value,
    });

    // 5. Persist within transaction
    return this.#unitOfWork.execute(ctx, async (ctx) => {
      const saveResult = await this.#voteRepository.insertOne(
        ctx,
        voteAggregate,
      );

      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      // 6. Publish domain events
      const publishResult = await this.#eventBus.publish(
        ctx,
        voteAggregate.pullEvents(),
      );

      if (publishResult.isErr()) {
        return err(publishResult.error);
      }

      return saveResult.map(this.#voteDtoMapper.toDto);
    });
  }
}
