import { type Result, err, ok } from "neverthrow";
import type { PromptWithAuthorDto } from "@/module/prompt/application/dto/prompt.dto";
import type { PromptDtoMapper } from "@/module/prompt/application/mapper/prompt-dto.mapper";
import type {
  GetPromptInput,
  GetPromptUseCasePort,
} from "@/module/prompt/port/get-prompt-use-case.port";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import type { VoteRepositoryPort } from "@/module/vote/port/vote-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";

export class GetPromptUseCase implements GetPromptUseCasePort {
  #promptDtoMapper: PromptDtoMapper;
  #promptRepository: PromptRepositoryPort;
  #voteRepository: VoteRepositoryPort;

  constructor(
    promptDtoMapper: PromptDtoMapper,
    promptRepository: PromptRepositoryPort,
    voteRepository: VoteRepositoryPort,
  ) {
    this.#promptDtoMapper = promptDtoMapper;
    this.#promptRepository = promptRepository;
    this.#voteRepository = voteRepository;
  }

  async execute(
    ctx: AppContext,
    input: GetPromptInput,
  ): Promise<Result<PromptWithAuthorDto, AppError>> {
    const userId = ctx.user?.id ?? null;

    // 1. Find prompt
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

    // 2. Check access to archived prompts (author only)
    if (prompt.isArchived && prompt.authorId !== userId) {
      return err(
        AppError.from("forbidden", { message: "This prompt is archived" }),
      );
    }

    // 3. Get prompt aura (sum of votes)
    const auraResult = await this.#voteRepository.sumByPromptId(
      ctx,
      input.promptId,
    );
    if (auraResult.isErr()) {
      return err(auraResult.error);
    }
    const aura = auraResult.value;

    // 4. Get author's user aura (total reputation)
    const userAuraResult = await this.#voteRepository.sumByAuthorId(
      ctx,
      prompt.authorId,
    );
    if (userAuraResult.isErr()) {
      return err(userAuraResult.error);
    }
    const userAura = userAuraResult.value;

    // 5. Get viewer's vote (if authenticated)
    let viewerVote: { value: 1 | -1 } | null = null;
    if (userId) {
      const voteResult = await this.#voteRepository.findByPromptAndUser(ctx, {
        promptId: input.promptId,
        userId,
      });
      if (voteResult.isErr()) {
        return err(voteResult.error);
      }
      if (voteResult.value) {
        viewerVote = { value: voteResult.value.value };
      }
    }

    // 6. Return DTO
    return ok(
      this.#promptDtoMapper.toWithAuthorDto(prompt, aura, userAura, viewerVote),
    );
  }
}
