import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type { UnitOfWorkPort } from "@/shared/port/unit-of-work.port";
import { VoteAggregate } from "@/module/prompt/domain/aggregate/vote.aggregate";
import { VoteType } from "@/module/prompt/domain/aggregate/vote.props";
import type { VoteResultDto } from "@/module/prompt/application/dto/vote-result.dto";
import type {
  VotePromptInput,
  VotePromptUseCasePort,
} from "@/module/prompt/port/vote-prompt-use-case.port";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import type { VoteRepositoryPort } from "@/module/prompt/port/vote-repository.port";

export class VotePromptUseCase implements VotePromptUseCasePort {
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
    input: VotePromptInput,
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
      let userVote: VoteType | null = input.voteType;
      let upvotesDelta = 0;
      let downvotesDelta = 0;

      if (!existingVote) {
        const newVote = VoteAggregate.new(
          input.promptId,
          ctx.user!.id,
          input.voteType,
        );

        const insertResult = await this.#voteRepository.insertOne(ctx, newVote);
        if (insertResult.isErr()) {
          return err(insertResult.error);
        }

        if (input.voteType === VoteType.UP) {
          upvotesDelta = 1;
        } else {
          downvotesDelta = 1;
        }
      } else if (existingVote.props.voteType === input.voteType) {
        const deleteResult = await this.#voteRepository.deleteOne(
          ctx,
          existingVote.id,
        );
        if (deleteResult.isErr()) {
          return err(deleteResult.error);
        }

        userVote = null;

        if (input.voteType === VoteType.UP) {
          upvotesDelta = -1;
        } else {
          downvotesDelta = -1;
        }
      } else {
        existingVote.changeVoteType(input.voteType);

        const updateResult = await this.#voteRepository.updateOne(
          ctx,
          existingVote,
        );
        if (updateResult.isErr()) {
          return err(updateResult.error);
        }

        if (input.voteType === VoteType.UP) {
          upvotesDelta = 1;
          downvotesDelta = -1;
        } else {
          upvotesDelta = -1;
          downvotesDelta = 1;
        }
      }

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
        userVote,
        upvotes: newUpvotes,
        downvotes: newDownvotes,
        voteCount: newUpvotes - newDownvotes,
      };

      return ok(dto);
    });
  }
}
