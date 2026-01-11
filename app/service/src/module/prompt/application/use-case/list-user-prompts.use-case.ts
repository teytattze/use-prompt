import { type Result, err, ok } from "neverthrow";
import type { PaginatedPromptsDto } from "@/module/prompt/application/dto/prompt.dto";
import type { PromptDtoMapper } from "@/module/prompt/application/mapper/prompt-dto.mapper";
import type {
  ListUserPromptsInput,
  ListUserPromptsUseCasePort,
} from "@/module/prompt/port/list-user-prompts-use-case.port";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import type { VoteRepositoryPort } from "@/module/vote/port/vote-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";

export class ListUserPromptsUseCase implements ListUserPromptsUseCasePort {
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
    input: ListUserPromptsInput,
  ): Promise<Result<PaginatedPromptsDto, AppError>> {
    const requesterId = ctx.user?.id ?? null;

    // 1. Determine if requester can see archived prompts (owner only)
    const isOwner = requesterId === input.userId;
    const includeArchived = isOwner && input.includeArchived;

    // 2. Fetch prompts
    const promptsResult = await this.#promptRepository.findByAuthor(ctx, {
      authorId: input.userId,
      includeArchived,
      pagination: {
        cursor: input.cursor,
        limit: input.limit,
      },
    });

    if (promptsResult.isErr()) {
      return err(promptsResult.error);
    }

    const { items: prompts, cursor, hasMore } = promptsResult.value;

    // 3. Fetch aura for each prompt
    const summaries = await Promise.all(
      prompts.map(async (prompt) => {
        const auraResult = await this.#voteRepository.sumByPromptId(
          ctx,
          prompt.id,
        );
        const aura = auraResult.isOk() ? auraResult.value : 0;
        return this.#promptDtoMapper.toSummaryDto(prompt, aura);
      }),
    );

    // 4. Return paginated result
    return ok({
      items: summaries,
      cursor,
      hasMore,
    });
  }
}
