import { type Result, err } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { DomainEventBusPort } from "@/lib/event-bus/port/domain-event-bus-port";
import type { UseCaseDtoMapper } from "@/lib/mapper/use-case-dto-mapper";
import type { UnitOfWorkPort } from "@/lib/unit-of-work/port/unit-of-work-port";
import { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type {
  CreatePromptUseCaseDto,
  CreatePromptUseCasePort,
} from "@/module/prompt/port/inbound/use-case/create-prompt-use-case-port";
import type { PromptUseCaseDto } from "@/module/prompt/port/inbound/use-case/prompt-use-case-dto";
import type { PromptRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-repository-port";

export class CreatePromptUseCase implements CreatePromptUseCasePort {
  #promptDtoMapper: UseCaseDtoMapper<PromptAggregate, PromptUseCaseDto>;
  #promptRepositoryPort: PromptRepositoryPort;
  #unitOfWork: UnitOfWorkPort;
  #eventBus: DomainEventBusPort;

  constructor(
    promptDtoMapper: UseCaseDtoMapper<PromptAggregate, PromptUseCaseDto>,
    promptRepositoryPort: PromptRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    eventBus: DomainEventBusPort,
  ) {
    this.#promptDtoMapper = promptDtoMapper;
    this.#promptRepositoryPort = promptRepositoryPort;
    this.#unitOfWork = unitOfWork;
    this.#eventBus = eventBus;
  }

  async execute(
    ctx: AppContext,
    input: CreatePromptUseCaseDto,
  ): Promise<Result<PromptUseCaseDto, AppError>> {
    return this.#unitOfWork.execute(ctx, async (ctx) => {
      const promptAggregate = PromptAggregate.new({
        title: input.title,
        messages: input.messages,
      });

      const saveResult = await this.#promptRepositoryPort.insertOne(
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
