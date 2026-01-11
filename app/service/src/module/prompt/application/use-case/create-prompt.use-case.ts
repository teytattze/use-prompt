import { type Result, err, ok } from "neverthrow";
import type { PromptDto } from "@/module/prompt/application/dto/prompt.dto";
import type { PromptDtoMapper } from "@/module/prompt/application/mapper/prompt-dto.mapper";
import { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";
import type {
  CreatePromptInput,
  CreatePromptUseCasePort,
} from "@/module/prompt/port/create-prompt-use-case.port";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type { DomainEventBusPort } from "@/shared/port/domain-event-bus.port";
import type { UnitOfWorkPort } from "@/shared/port/unit-of-work.port";

export class CreatePromptUseCase implements CreatePromptUseCasePort {
  #promptDtoMapper: PromptDtoMapper;
  #promptRepository: PromptRepositoryPort;
  #unitOfWork: UnitOfWorkPort;
  #eventBus: DomainEventBusPort;

  constructor(
    promptDtoMapper: PromptDtoMapper,
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
    // Ensure user is authenticated
    if (!ctx.user) {
      return err(AppError.from("unauthorized"));
    }

    const authorId = ctx.user.id;

    return this.#unitOfWork.execute(ctx, async (ctx) => {
      const promptAggregate = PromptAggregate.new({
        authorId,
        title: input.title,
        description: input.description,
        messages: input.messages,
        category: input.category,
        tags: input.tags,
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

      // New prompt has 0 aura
      return ok(this.#promptDtoMapper.toDto(saveResult.value, 0));
    });
  }
}
