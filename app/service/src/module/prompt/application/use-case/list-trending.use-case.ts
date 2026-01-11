import { type Result, err, ok } from "neverthrow";
import type { PromptDtoMapper } from "@/module/prompt/application/mapper/prompt-dto.mapper";
import type {
  ListTrendingInput,
  ListTrendingOutput,
  ListTrendingUseCasePort,
} from "@/module/prompt/port/list-trending-use-case.port";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";

export class ListTrendingUseCase implements ListTrendingUseCasePort {
  #promptDtoMapper: PromptDtoMapper;
  #promptRepository: PromptRepositoryPort;

  constructor(
    promptDtoMapper: PromptDtoMapper,
    promptRepository: PromptRepositoryPort,
  ) {
    this.#promptDtoMapper = promptDtoMapper;
    this.#promptRepository = promptRepository;
  }

  async execute(
    ctx: AppContext,
    input: ListTrendingInput,
  ): Promise<Result<ListTrendingOutput, AppError>> {
    const result = await this.#promptRepository.findTrending(ctx, {
      filter: {
        category: input.category,
        tags: input.tags,
      },
      pagination: {
        cursor: input.cursor,
        limit: input.limit,
      },
      gravity: 1.5, // Default gravity for time-decay
    });

    if (result.isErr()) {
      return err(result.error);
    }

    const { items, cursor, hasMore } = result.value;

    return ok({
      items: items.map((item) =>
        this.#promptDtoMapper.toSummaryDto(item.prompt, item.aura),
      ),
      cursor,
      hasMore,
    });
  }
}
