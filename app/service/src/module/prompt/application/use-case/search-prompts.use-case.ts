import { type Result, err, ok } from "neverthrow";
import type { PromptDto } from "@/module/prompt/application/dto/prompt.dto";
import type { PromptDtoMapper } from "@/module/prompt/application/mapper/prompt-dto.mapper";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import type {
  SearchPromptsInput,
  SearchPromptsOutput,
  SearchPromptsUseCasePort,
} from "@/module/prompt/port/search-prompts-use-case.port";
import type { VoteRepositoryPort } from "@/module/vote/port/vote-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";

export class SearchPromptsUseCase implements SearchPromptsUseCasePort {
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
    input: SearchPromptsInput,
  ): Promise<Result<SearchPromptsOutput, AppError>> {
    const result = await this.#promptRepository.search(ctx, {
      query: input.query,
      limit: input.limit,
    });

    if (result.isErr()) {
      return err(result.error);
    }

    // Fetch aura for each prompt
    const dtos = await Promise.all(
      result.value.prompts.map(async (aggregate) => {
        const auraResult = await this.#voteRepository.sumByPromptId(
          ctx,
          aggregate.id,
        );
        const aura = auraResult.isOk() ? auraResult.value : 0;
        return this.#promptDtoMapper.toDto(aggregate, aura);
      }),
    );

    return ok({
      prompts: dtos,
      total: result.value.total,
    });
  }
}
