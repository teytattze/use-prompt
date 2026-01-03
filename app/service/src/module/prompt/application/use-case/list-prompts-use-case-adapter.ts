import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { UseCaseDtoMapper } from "@/lib/mapper/use-case-dto-mapper";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type { ListPromptsUseCasePort } from "@/module/prompt/port/inbound/use-case/list-prompts-use-case-port";
import type { PromptUseCaseDto } from "@/module/prompt/port/inbound/use-case/prompt-use-case-dto";
import type { PromptRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-repository-port";

export class ListPromptsUseCaseAdapter implements ListPromptsUseCasePort {
  #promptDtoMapper: UseCaseDtoMapper<PromptAggregate, PromptUseCaseDto>;
  #promptRepositoryPort: PromptRepositoryPort;

  constructor(
    promptDtoMapper: UseCaseDtoMapper<PromptAggregate, PromptUseCaseDto>,
    promptRepositoryPort: PromptRepositoryPort,
  ) {
    this.#promptDtoMapper = promptDtoMapper;
    this.#promptRepositoryPort = promptRepositoryPort;
  }

  async execute(
    ctx: AppContext,
    _: undefined,
  ): Promise<Result<PromptUseCaseDto[], AppError>> {
    const result = await this.#promptRepositoryPort.findMany(ctx);

    if (result.isErr()) {
      return err(result.error);
    }

    const dtos = result.value.map((aggregate) =>
      this.#promptDtoMapper.toDto(aggregate),
    );

    return ok(dtos);
  }
}
