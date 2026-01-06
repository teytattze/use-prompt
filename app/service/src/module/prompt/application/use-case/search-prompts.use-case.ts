import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";
import type { DtoMapperPort } from "@/shared/port/dto-mapper.port";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";
import type { PromptDto } from "@/module/prompt/application/dto/prompt.dto";
import type {
  SearchPromptsInput,
  SearchPromptsOutput,
  SearchPromptsUseCasePort,
} from "@/module/prompt/port/search-prompts-use-case.port";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";

export class SearchPromptsUseCase implements SearchPromptsUseCasePort {
  #promptDtoMapper: DtoMapperPort<PromptAggregate, PromptDto>;
  #promptRepository: PromptRepositoryPort;

  constructor(
    promptDtoMapper: DtoMapperPort<PromptAggregate, PromptDto>,
    promptRepository: PromptRepositoryPort,
  ) {
    this.#promptDtoMapper = promptDtoMapper;
    this.#promptRepository = promptRepository;
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

    const dtos = result.value.prompts.map((aggregate) =>
      this.#promptDtoMapper.toDto(aggregate),
    );

    return ok({
      prompts: dtos,
      total: result.value.total,
    });
  }
}
