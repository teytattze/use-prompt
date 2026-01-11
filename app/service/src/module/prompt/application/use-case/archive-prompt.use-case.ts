import { type Result, err, ok } from "neverthrow";
import type {
  ArchivePromptInput,
  ArchivePromptOutput,
  ArchivePromptUseCasePort,
} from "@/module/prompt/port/archive-prompt-use-case.port";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type { DomainEventBusPort } from "@/shared/port/domain-event-bus.port";
import type { UnitOfWorkPort } from "@/shared/port/unit-of-work.port";

export class ArchivePromptUseCase implements ArchivePromptUseCasePort {
  #promptRepository: PromptRepositoryPort;
  #unitOfWork: UnitOfWorkPort;
  #eventBus: DomainEventBusPort;

  constructor(
    promptRepository: PromptRepositoryPort,
    unitOfWork: UnitOfWorkPort,
    eventBus: DomainEventBusPort,
  ) {
    this.#promptRepository = promptRepository;
    this.#unitOfWork = unitOfWork;
    this.#eventBus = eventBus;
  }

  async execute(
    ctx: AppContext,
    input: ArchivePromptInput,
  ): Promise<Result<ArchivePromptOutput, AppError>> {
    // 1. Ensure user is authenticated
    if (!ctx.user) {
      return err(AppError.from("unauthorized"));
    }

    const userId = ctx.user.id;

    // 2. Find prompt
    const promptResult = await this.#promptRepository.findById(
      ctx,
      input.promptId,
    );
    if (promptResult.isErr()) {
      return err(promptResult.error);
    }

    const prompt = promptResult.value;
    if (!prompt) {
      return err(AppError.from("not_found", { message: "Prompt not found" }));
    }

    // 3. Check authorization (author only)
    if (prompt.authorId !== userId) {
      return err(
        AppError.from("forbidden", {
          message: "Only the author can archive this prompt",
        }),
      );
    }

    // 4. Check if already archived
    if (prompt.isArchived) {
      return err(
        AppError.from("bad_request", { message: "Prompt is already archived" }),
      );
    }

    // 5. Archive the prompt (mutates aggregate, emits event)
    prompt.archive();

    // 6. Persist within transaction
    return this.#unitOfWork.execute(ctx, async (ctx) => {
      const updateResult = await this.#promptRepository.updateArchivedAt(ctx, {
        id: prompt.id,
        archivedAt: prompt.archivedAt!,
      });

      if (updateResult.isErr()) {
        return err(updateResult.error);
      }

      // Publish domain events
      const publishResult = await this.#eventBus.publish(
        ctx,
        prompt.pullEvents(),
      );

      if (publishResult.isErr()) {
        return err(publishResult.error);
      }

      // Return result
      return ok({
        id: prompt.id,
        archivedAt: prompt.archivedAt!.toISOString(),
      });
    });
  }
}
