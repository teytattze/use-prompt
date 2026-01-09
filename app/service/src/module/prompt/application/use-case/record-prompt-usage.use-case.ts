import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type {
  RecordPromptUsageInput,
  RecordPromptUsageOutput,
  RecordPromptUsageUseCasePort,
} from "@/module/prompt/port/record-prompt-usage-use-case.port";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";

export class RecordPromptUsageUseCase implements RecordPromptUsageUseCasePort {
  #promptRepository: PromptRepositoryPort;

  constructor(promptRepository: PromptRepositoryPort) {
    this.#promptRepository = promptRepository;
  }

  async execute(
    ctx: AppContext,
    input: RecordPromptUsageInput,
  ): Promise<Result<RecordPromptUsageOutput, AppError>> {
    const promptResult = await this.#promptRepository.findById(
      ctx,
      input.promptId,
    );

    if (promptResult.isErr()) {
      return err(promptResult.error);
    }

    if (!promptResult.value) {
      return err(AppError.from("not_found", { message: "Prompt not found" }));
    }

    const incrementResult = await this.#promptRepository.incrementUsedCount(
      ctx,
      input.promptId,
    );

    if (incrementResult.isErr()) {
      return err(incrementResult.error);
    }

    return ok({ usedCount: incrementResult.value });
  }
}
