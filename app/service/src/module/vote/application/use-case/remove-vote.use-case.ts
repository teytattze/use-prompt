import { type Result, err, ok } from "neverthrow";
import type {
  RemoveVoteInput,
  RemoveVoteUseCasePort,
} from "@/module/vote/port/remove-vote-use-case.port";
import type { VoteRepositoryPort } from "@/module/vote/port/vote-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type { DomainEventBusPort } from "@/shared/port/domain-event-bus.port";
import type { UnitOfWorkPort } from "@/shared/port/unit-of-work.port";

export class RemoveVoteUseCase implements RemoveVoteUseCasePort {
  #voteRepository: VoteRepositoryPort;
  #unitOfWork: UnitOfWorkPort;
  #eventBus: DomainEventBusPort;

  constructor(
    voteRepository: VoteRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    eventBus: DomainEventBusPort,
  ) {
    this.#voteRepository = voteRepository;
    this.#unitOfWork = unitOfWork;
    this.#eventBus = eventBus;
  }

  async execute(
    ctx: AppContext,
    input: RemoveVoteInput,
  ): Promise<Result<void, AppError>> {
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
          message: "Vote not found",
        }),
      );
    }

    // 2. Mark for removal (emits event)
    vote.markForRemoval();

    // 3. Delete within transaction
    return this.#unitOfWork.execute(ctx, async (ctx) => {
      const deleteResult = await this.#voteRepository.deleteOne(ctx, {
        promptId: input.promptId,
        userId,
      });

      if (deleteResult.isErr()) {
        return err(deleteResult.error);
      }

      // 4. Publish domain events
      const publishResult = await this.#eventBus.publish(
        ctx,
        vote.pullEvents(),
      );

      if (publishResult.isErr()) {
        return err(publishResult.error);
      }

      return ok(undefined);
    });
  }
}
