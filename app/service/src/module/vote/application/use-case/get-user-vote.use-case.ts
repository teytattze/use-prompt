import { type Result, err, ok } from "neverthrow";
import type { VoteDto } from "@/module/vote/application/dto/vote.dto";
import type { VoteDtoMapper } from "@/module/vote/application/mapper/vote-dto.mapper";
import type {
  GetUserVoteInput,
  GetUserVoteUseCasePort,
} from "@/module/vote/port/get-user-vote-use-case.port";
import type { VoteRepositoryPort } from "@/module/vote/port/vote-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";

export class GetUserVoteUseCase implements GetUserVoteUseCasePort {
  #voteDtoMapper: VoteDtoMapper;
  #voteRepository: VoteRepositoryPort;

  constructor(
    voteDtoMapper: VoteDtoMapper,
    voteRepository: VoteRepositoryPort,
  ) {
    this.#voteDtoMapper = voteDtoMapper;
    this.#voteRepository = voteRepository;
  }

  async execute(
    ctx: AppContext,
    input: GetUserVoteInput,
  ): Promise<Result<VoteDto | null, AppError>> {
    // Ensure user is authenticated
    if (!ctx.user) {
      return err(AppError.from("unauthorized"));
    }

    const userId = ctx.user.id;

    const voteResult = await this.#voteRepository.findByPromptAndUser(ctx, {
      promptId: input.promptId,
      userId,
    });

    if (voteResult.isErr()) {
      return err(voteResult.error);
    }

    const vote = voteResult.value;
    if (!vote) {
      return ok(null);
    }

    return ok(this.#voteDtoMapper.toDto(vote));
  }
}
