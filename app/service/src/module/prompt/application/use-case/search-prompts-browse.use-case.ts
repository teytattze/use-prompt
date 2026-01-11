import { type Result, err, ok } from "neverthrow";
import type { PromptDtoMapper } from "@/module/prompt/application/mapper/prompt-dto.mapper";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import type {
  SearchPromptsBrowseInput,
  SearchPromptsBrowseOutput,
  SearchPromptsBrowseUseCasePort,
} from "@/module/prompt/port/search-prompts-browse-use-case.port";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";

export class SearchPromptsBrowseUseCase implements SearchPromptsBrowseUseCasePort {
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
    input: SearchPromptsBrowseInput,
  ): Promise<Result<SearchPromptsBrowseOutput, AppError>> {
    // Validate query is not empty
    const trimmedQuery = input.query.trim();
    if (!trimmedQuery) {
      return err(
        AppError.from("bad_request", { message: "Search query is required" }),
      );
    }

    const result = await this.#promptRepository.searchByText(ctx, {
      query: trimmedQuery,
      filter: {
        category: input.category,
        tags: input.tags,
      },
      pagination: {
        cursor: input.cursor,
        limit: input.limit,
      },
    });

    if (result.isErr()) {
      return err(result.error);
    }

    const { items, cursor, hasMore, facets } = result.value;

    return ok({
      items: items.map((item) =>
        this.#promptDtoMapper.toSummaryDto(item.prompt, item.aura),
      ),
      cursor,
      hasMore,
      facets,
    });
  }
}
