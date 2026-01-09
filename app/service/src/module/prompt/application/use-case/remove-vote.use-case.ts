import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type { UnitOfWorkPort } from "@/shared/port/unit-of-work.port";
import { VoteType } from "@/module/prompt/domain/aggregate/vote.props";
import type { VoteResultDto } from "@/module/prompt/application/dto/vote-result.dto";
import type {
  RemoveVoteInput,
  RemoveVoteUseCasePort,
} from "@/module/prompt/port/remove-vote-use-case.port";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import type { VoteRepositoryPort } from "@/module/prompt/port/vote-repository.port";

export class RemoveVoteUseCase implements RemoveVoteUseCasePort {
  #promptRepository: PromptRepositoryPort;
  #voteRepository: VoteRepositoryPort;
  #unitOfWork: UnitOfWorkPort;

  constructor(
    promptRepository: PromptRepositoryPort,
    voteRepository: VoteRepositoryPort,
    unitOfWork: UnitOfWorkPort,
  ) {
    this.#promptRepository = promptRepository;
    this.#voteRepository = voteRepository;
    this.#unitOfWork = unitOfWork;
  }

  async execute(
    ctx: AppContext,
    input: RemoveVoteInput,
  ): Promise<Result<VoteResultDto, AppError>> {
    if (!ctx.user) {
      return err(AppError.from("unauthorized", { message: "User not authenticated" }));
    }

    return this.#unitOfWork.execute(ctx, async (ctx) => {
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

      const existingVoteResult = await this.#voteRepository.findByPromptAndUser(
        ctx,
        input.promptId,
        ctx.user!.id,
      );

      if (existingVoteResult.isErr()) {
        return err(existingVoteResult.error);
      }

      const existingVote = existingVoteResult.value;

      if (!existingVote) {
        const dto: VoteResultDto = {
          promptId: input.promptId,
          userVote: null,
          upvotes: prompt.props.upvotes,
          downvotes: prompt.props.downvotes,
          voteCount: prompt.voteCount,
        };
        return ok(dto);
      }

      const deleteResult = await this.#voteRepository.deleteOne(
        ctx,
        existingVote.id,
      );

      if (deleteResult.isErr()) {
        return err(deleteResult.error);
      }

      const previousVoteType = existingVote.props.voteType;
      const upvotesDelta = previousVoteType === VoteType.UP ? -1 : 0;
      const downvotesDelta = previousVoteType === VoteType.DOWN ? -1 : 0;

      const updateCountersResult = await this.#promptRepository.updateCounters(
        ctx,
        input.promptId,
        {
          upvotes: upvotesDelta,
          downvotes: downvotesDelta,
        },
      );

      if (updateCountersResult.isErr()) {
        return err(updateCountersResult.error);
      }

      const newUpvotes = prompt.props.upvotes + upvotesDelta;
      const newDownvotes = prompt.props.downvotes + downvotesDelta;

      const dto: VoteResultDto = {
        promptId: input.promptId,
        userVote: null,
        upvotes: newUpvotes,
        downvotes: newDownvotes,
        voteCount: newUpvotes - newDownvotes,
      };

      return ok(dto);
    });
  }
}
