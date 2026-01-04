import { type Result, err } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";
import type { DomainEventBusPort } from "@/shared/port/domain-event-bus.port";
import type { DtoMapperPort } from "@/shared/port/dto-mapper.port";
import type { UnitOfWorkPort } from "@/shared/port/unit-of-work.port";
import { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";
import type { PromptDto } from "@/module/prompt/application/dto/prompt.dto";
import type {
  CreatePromptInput,
  CreatePromptUseCasePort,
} from "@/module/prompt/port/create-prompt-use-case.port";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";

export class CreatePromptUseCase implements CreatePromptUseCasePort {
  #promptDtoMapper: DtoMapperPort<PromptAggregate, PromptDto>;
  #promptRepository: PromptRepositoryPort;
  #unitOfWork: UnitOfWorkPort;
  #eventBus: DomainEventBusPort;

  constructor(
    promptDtoMapper: DtoMapperPort<PromptAggregate, PromptDto>,
    promptRepository: PromptRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    eventBus: DomainEventBusPort,
  ) {
    this.#promptDtoMapper = promptDtoMapper;
    this.#promptRepository = promptRepository;
    this.#unitOfWork = unitOfWork;
    this.#eventBus = eventBus;
  }

  async execute(
    ctx: AppContext,
    input: CreatePromptInput,
  ): Promise<Result<PromptDto, AppError>> {
    return this.#unitOfWork.execute(ctx, async (ctx) => {
      const promptAggregate = PromptAggregate.new({
        title: input.title,
        messages: input.messages,
      });

      const saveResult = await this.#promptRepository.insertOne(
        ctx,
        promptAggregate,
      );

      if (saveResult.isErr()) {
        return err(saveResult.error);
      }
      const publishResult = await this.#eventBus.publish(
        ctx,
        promptAggregate.pullEvents(),
      );

      if (publishResult.isErr()) {
        return err(publishResult.error);
      }
      return saveResult.map(this.#promptDtoMapper.toDto);
    });
  }
}
