import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";
import type { DtoMapperPort } from "@/shared/port/dto-mapper.port";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";
import type { PromptDto } from "@/module/prompt/application/dto/prompt.dto";
import type { ListPromptsUseCasePort } from "@/module/prompt/port/list-prompts-use-case.port";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";

export class ListPromptsUseCase implements ListPromptsUseCasePort {
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
    _: undefined,
  ): Promise<Result<PromptDto[], AppError>> {
    const result = await this.#promptRepository.findMany(ctx);

    if (result.isErr()) {
      return err(result.error);
    }

    const dtos = result.value.map((aggregate) =>
      this.#promptDtoMapper.toDto(aggregate),
    );

    return ok(dtos);
  }
}
