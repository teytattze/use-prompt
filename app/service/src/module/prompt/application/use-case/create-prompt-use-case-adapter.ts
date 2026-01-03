import { type Result, err } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { UseCaseDtoMapper } from "@/lib/mapper/use-case-dto-mapper";
import { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type {
  CreatePromptUseCaseDto,
  CreatePromptUseCasePort,
} from "@/module/prompt/port/inbound/use-case/create-prompt-use-case-port";
import type { PromptUseCaseDto } from "@/module/prompt/port/inbound/use-case/prompt-use-case-dto";
import type { PromptRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-repository-port";

export class CreatePromptUseCaseAdapter implements CreatePromptUseCasePort {
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
    input: CreatePromptUseCaseDto,
  ): Promise<Result<PromptUseCaseDto, AppError>> {
    const promptAggregate = PromptAggregate.new({
      title: input.title,
      messages: input.messages,
    });

    const result = await this.#promptRepositoryPort.insertOne(
      ctx,
      promptAggregate,
    );

    if (result.isErr()) {
      return err(result.error);
    }
    return result.map(this.#promptDtoMapper.toDto);
  }
}
