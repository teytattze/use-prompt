import { type Result, err } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { UseCaseDtoMapper } from "@/lib/mapper/use-case-dto-mapper";
import type { OutboxEventRepositoryPort } from "@/lib/outbox/port/outbound/persistence/outbox-event-repository-port";
import type { UnitOfWorkPort } from "@/lib/unit-of-work/port/unit-of-work-port";
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
  #unitOfWork: UnitOfWorkPort;
  #outboxRepository: OutboxEventRepositoryPort;

  constructor(
    promptDtoMapper: UseCaseDtoMapper<PromptAggregate, PromptUseCaseDto>,
    promptRepositoryPort: PromptRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    outboxRepository: OutboxEventRepositoryPort,
  ) {
    this.#promptDtoMapper = promptDtoMapper;
    this.#promptRepositoryPort = promptRepositoryPort;
    this.#unitOfWork = unitOfWork;
    this.#outboxRepository = outboxRepository;
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
      const outboxResult = await this.#outboxRepository.insertMany(
        ctx,
        promptAggregate.pullEvents(),
      );

      if (outboxResult.isErr()) {
        return err(outboxResult.error);
      }
      return saveResult.map(this.#promptDtoMapper.toDto);
    });
  }
}
