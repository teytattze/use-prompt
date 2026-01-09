import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type { PromptDetailDto } from "@/module/prompt/application/dto/prompt-detail.dto";
import type {
  GetPromptInput,
  GetPromptUseCasePort,
} from "@/module/prompt/port/get-prompt-use-case.port";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import type { VoteRepositoryPort } from "@/module/prompt/port/vote-repository.port";

export class GetPromptUseCase implements GetPromptUseCasePort {
  #promptRepository: PromptRepositoryPort;
  #voteRepository: VoteRepositoryPort;

  constructor(
    promptRepository: PromptRepositoryPort,
    voteRepository: VoteRepositoryPort,
  ) {
    this.#promptRepository = promptRepository;
    this.#voteRepository = voteRepository;
  }

  async execute(
    ctx: AppContext,
    input: GetPromptInput,
  ): Promise<Result<PromptDetailDto, AppError>> {
    const promptResult = await this.#promptRepository.findById(
      ctx,
      input.promptId,
    );

    if (promptResult.isErr()) {
      return err(promptResult.error);
    }

    const prompt = promptResult.value;

    if (!prompt) {
      return err(
        AppError.from("not_found", { message: "Prompt not found" }),
      );
    }

    let userVote: "UP" | "DOWN" | null = null;

    if (ctx.user) {
      const voteResult = await this.#voteRepository.findByPromptAndUser(
        ctx,
        input.promptId,
        ctx.user.id,
      );

      if (voteResult.isOk() && voteResult.value) {
        userVote = voteResult.value.props.voteType;
      }
    }

    const dto: PromptDetailDto = {
      id: prompt.id,
      title: prompt.props.title,
      description: prompt.props.description,
      messages: prompt.props.messages,
      upvotes: prompt.props.upvotes,
      downvotes: prompt.props.downvotes,
      voteCount: prompt.voteCount,
      usedCount: prompt.props.usedCount,
      userVote,
    };

    return ok(dto);
  }
}
