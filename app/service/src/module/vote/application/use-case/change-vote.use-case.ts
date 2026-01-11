import { type Result, err, ok } from "neverthrow";
import type { VoteDto } from "@/module/vote/application/dto/vote.dto";
import type { VoteDtoMapper } from "@/module/vote/application/mapper/vote-dto.mapper";
import type {
  ChangeVoteInput,
  ChangeVoteUseCasePort,
} from "@/module/vote/port/change-vote-use-case.port";
import type { VoteRepositoryPort } from "@/module/vote/port/vote-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type { DomainEventBusPort } from "@/shared/port/domain-event-bus.port";
import type { UnitOfWorkPort } from "@/shared/port/unit-of-work.port";

export class ChangeVoteUseCase implements ChangeVoteUseCasePort {
  #voteDtoMapper: VoteDtoMapper;
  #voteRepository: VoteRepositoryPort;
  #unitOfWork: UnitOfWorkPort;
  #eventBus: DomainEventBusPort;

  constructor(
    voteDtoMapper: VoteDtoMapper,
    voteRepository: VoteRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    eventBus: DomainEventBusPort,
  ) {
    this.#voteDtoMapper = voteDtoMapper;
    this.#voteRepository = voteRepository;
    this.#unitOfWork = unitOfWork;
    this.#eventBus = eventBus;
  }

  async execute(
    ctx: AppContext,
    input: ChangeVoteInput,
  ): Promise<Result<VoteDto, AppError>> {
    // Ensure user is authenticated
    if (!ctx.user) {
      return err(AppError.from("unauthorized"));
    }

    const userId = ctx.user.id;

    // 1. Find existing vote
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

    const vote = existingVoteResult.value;
    if (!vote) {
      return err(
        AppError.from("not_found", {
          message: "Vote not found. Cast a vote first.",
        }),
      );
    }

    // 2. Change value (aggregate handles idempotency)
    vote.changeValue(input.value);

    // 3. If no events were added (same value), just return current state
    if (!vote.hasEvents) {
      return ok(this.#voteDtoMapper.toDto(vote));
    }

    // 4. Persist within transaction
    return this.#unitOfWork.execute(ctx, async (ctx) => {
      const updateResult = await this.#voteRepository.updateOne(ctx, vote);

      if (updateResult.isErr()) {
        return err(updateResult.error);
      }

      // 5. Publish domain events
      const publishResult = await this.#eventBus.publish(
        ctx,
        vote.pullEvents(),
      );

      if (publishResult.isErr()) {
        return err(publishResult.error);
      }

      return updateResult.map(this.#voteDtoMapper.toDto);
    });
  }
}
