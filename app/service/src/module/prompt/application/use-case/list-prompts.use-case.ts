import { type Result, err, ok } from "neverthrow";
import type { PromptDto } from "@/module/prompt/application/dto/prompt.dto";
import type { PromptDtoMapper } from "@/module/prompt/application/mapper/prompt-dto.mapper";
import type { ListPromptsUseCasePort } from "@/module/prompt/port/list-prompts-use-case.port";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import type { VoteRepositoryPort } from "@/module/vote/port/vote-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";

export class ListPromptsUseCase implements ListPromptsUseCasePort {
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
    _: undefined,
  ): Promise<Result<PromptDto[], AppError>> {
    const result = await this.#promptRepository.findMany(ctx);

    if (result.isErr()) {
      return err(result.error);
    }

    // Fetch aura for each prompt
    const dtos = await Promise.all(
      result.value.map(async (aggregate) => {
        const auraResult = await this.#voteRepository.sumByPromptId(
          ctx,
          aggregate.id,
        );
        const aura = auraResult.isOk() ? auraResult.value : 0;
        return this.#promptDtoMapper.toDto(aggregate, aura);
      }),
    );

    return ok(dtos);
  }
}
