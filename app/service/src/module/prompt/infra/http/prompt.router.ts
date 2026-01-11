import { Elysia, t } from "elysia";
import { setupAppContextMiddleware } from "@/infra/http/app-context.middleware";
import { setupAuthGuardMiddleware } from "@/infra/http/auth-guard.middleware";
import { CATEGORY_VALUES } from "@/module/prompt/domain/value-object/category.value-object";
import type { ArchivePromptUseCasePort } from "@/module/prompt/port/archive-prompt-use-case.port";
import {
  type CreatePromptUseCasePort,
  createPromptInputSchema,
} from "@/module/prompt/port/create-prompt-use-case.port";
import type { GetPromptUseCasePort } from "@/module/prompt/port/get-prompt-use-case.port";
import type { ListPromptsUseCasePort } from "@/module/prompt/port/list-prompts-use-case.port";
import type { ListRecentUseCasePort } from "@/module/prompt/port/list-recent-use-case.port";
import type { ListTrendingUseCasePort } from "@/module/prompt/port/list-trending-use-case.port";
import type { ListUserPromptsUseCasePort } from "@/module/prompt/port/list-user-prompts-use-case.port";
import type { SearchPromptsBrowseUseCasePort } from "@/module/prompt/port/search-prompts-browse-use-case.port";
import {
  type SearchPromptsUseCasePort,
  searchPromptsInputSchema,
} from "@/module/prompt/port/search-prompts-use-case.port";
import { HttpEnvelope } from "@/shared/http/http-envelope";

export class PromptRouter {
  #createPromptUseCase: CreatePromptUseCasePort;
  #listPromptsUseCase: ListPromptsUseCasePort;
  #searchPromptsUseCase: SearchPromptsUseCasePort;
  #archivePromptUseCase: ArchivePromptUseCasePort;
  #getPromptUseCase: GetPromptUseCasePort;
  #listTrendingUseCase: ListTrendingUseCasePort;
  #listRecentUseCase: ListRecentUseCasePort;
  #searchPromptsBrowseUseCase: SearchPromptsBrowseUseCasePort;

  constructor(
    createPromptUseCase: CreatePromptUseCasePort,
    listPromptsUseCase: ListPromptsUseCasePort,
    searchPromptsUseCase: SearchPromptsUseCasePort,
    archivePromptUseCase: ArchivePromptUseCasePort,
    getPromptUseCase: GetPromptUseCasePort,
    listTrendingUseCase: ListTrendingUseCasePort,
    listRecentUseCase: ListRecentUseCasePort,
    searchPromptsBrowseUseCase: SearchPromptsBrowseUseCasePort,
  ) {
    this.#createPromptUseCase = createPromptUseCase;
    this.#listPromptsUseCase = listPromptsUseCase;
    this.#searchPromptsUseCase = searchPromptsUseCase;
    this.#archivePromptUseCase = archivePromptUseCase;
    this.#getPromptUseCase = getPromptUseCase;
    this.#listTrendingUseCase = listTrendingUseCase;
    this.#listRecentUseCase = listRecentUseCase;
    this.#searchPromptsBrowseUseCase = searchPromptsBrowseUseCase;
  }

  make() {
    return (
      new Elysia({ name: "prompt-router-v1", prefix: "/api/v1/prompt" })
        .use(setupAppContextMiddleware())
        .use(setupAuthGuardMiddleware())
        .get("/", async ({ ctx }) => {
          const result = await this.#listPromptsUseCase.execute(ctx, undefined);
          if (result.isErr()) {
            return HttpEnvelope.error(result.error).toJson();
          }
          return HttpEnvelope.ok({ data: result.value }).toJson();
        })
        .post(
          "/",
          async ({ body, ctx }) => {
            const result = await this.#createPromptUseCase.execute(ctx, body);
            if (result.isErr()) {
              return HttpEnvelope.error(result.error).toJson();
            }
            return HttpEnvelope.ok({ data: result.value }).toJson();
          },
          { body: createPromptInputSchema },
        )
        .get(
          "/search",
          async ({ query, ctx }) => {
            const result = await this.#searchPromptsUseCase.execute(ctx, query);
            if (result.isErr()) {
              return HttpEnvelope.error(result.error).toJson();
            }
            return HttpEnvelope.ok({ data: result.value }).toJson();
          },
          { query: searchPromptsInputSchema },
        )
        // GET /prompt/trending - List trending prompts with time-decayed scoring
        .get(
          "/trending",
          async ({ query, ctx }) => {
            // Parse tags from comma-separated string
            const tags = query.tags
              ? query.tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
              : undefined;

            const result = await this.#listTrendingUseCase.execute(ctx, {
              category: query.category,
              tags,
              cursor: query.cursor,
              limit: Math.min(query.limit ?? 20, 100),
            });

            if (result.isErr()) {
              return HttpEnvelope.error(result.error).toJson();
            }

            return HttpEnvelope.ok({
              data: result.value.items,
              meta: {
                cursor: result.value.cursor,
                hasMore: result.value.hasMore,
              },
            }).toJson();
          },
          {
            query: t.Object({
              category: t.Optional(
                t.Union(CATEGORY_VALUES.map((v) => t.Literal(v))),
              ),
              tags: t.Optional(t.String()),
              cursor: t.Optional(t.String()),
              limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
            }),
          },
        )
        // GET /prompt/recent - List recent prompts sorted by creation date
        .get(
          "/recent",
          async ({ query, ctx }) => {
            // Parse tags from comma-separated string
            const tags = query.tags
              ? query.tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
              : undefined;

            const result = await this.#listRecentUseCase.execute(ctx, {
              category: query.category,
              tags,
              cursor: query.cursor,
              limit: Math.min(query.limit ?? 20, 100),
            });

            if (result.isErr()) {
              return HttpEnvelope.error(result.error).toJson();
            }

            return HttpEnvelope.ok({
              data: result.value.items,
              meta: {
                cursor: result.value.cursor,
                hasMore: result.value.hasMore,
              },
            }).toJson();
          },
          {
            query: t.Object({
              category: t.Optional(
                t.Union(CATEGORY_VALUES.map((v) => t.Literal(v))),
              ),
              tags: t.Optional(t.String()),
              cursor: t.Optional(t.String()),
              limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
            }),
          },
        )
        // GET /prompt/browse/search - Full-text search with facets
        .get(
          "/browse/search",
          async ({ query, ctx }) => {
            // Parse tags from comma-separated string
            const tags = query.tags
              ? query.tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
              : undefined;

            const result = await this.#searchPromptsBrowseUseCase.execute(ctx, {
              query: query.q,
              category: query.category,
              tags,
              cursor: query.cursor,
              limit: Math.min(query.limit ?? 20, 100),
            });

            if (result.isErr()) {
              return HttpEnvelope.error(result.error).toJson();
            }

            return HttpEnvelope.ok({
              data: result.value.items,
              meta: {
                cursor: result.value.cursor,
                hasMore: result.value.hasMore,
                facets: result.value.facets,
              },
            }).toJson();
          },
          {
            query: t.Object({
              q: t.String({ minLength: 1 }),
              category: t.Optional(
                t.Union(CATEGORY_VALUES.map((v) => t.Literal(v))),
              ),
              tags: t.Optional(t.String()),
              cursor: t.Optional(t.String()),
              limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
            }),
          },
        )
        // GET /prompt/:id - Get prompt by ID with computed aura
        .get(
          "/:id",
          async ({ params, ctx }) => {
            const result = await this.#getPromptUseCase.execute(ctx, {
              promptId: params.id,
            });
            if (result.isErr()) {
              return HttpEnvelope.error(result.error).toJson();
            }
            return HttpEnvelope.ok({ data: result.value }).toJson();
          },
          {
            params: t.Object({
              id: t.String(),
            }),
          },
        )
        // PATCH /prompt/:id/archive - Archive prompt (author only)
        .patch(
          "/:id/archive",
          async ({ params, ctx }) => {
            const result = await this.#archivePromptUseCase.execute(ctx, {
              promptId: params.id,
            });
            if (result.isErr()) {
              return HttpEnvelope.error(result.error).toJson();
            }
            return HttpEnvelope.ok({ data: result.value }).toJson();
          },
          {
            params: t.Object({
              id: t.String(),
            }),
          },
        )
    );
  }
}

/**
 * User prompts router - handles endpoints under /api/v1/user/:userId/prompt
 */
export class UserPromptsRouter {
  #listUserPromptsUseCase: ListUserPromptsUseCasePort;

  constructor(listUserPromptsUseCase: ListUserPromptsUseCasePort) {
    this.#listUserPromptsUseCase = listUserPromptsUseCase;
  }

  make() {
    return (
      new Elysia({ name: "user-prompts-router-v1", prefix: "/api/v1/user" })
        .use(setupAppContextMiddleware())
        .use(setupAuthGuardMiddleware())
        // GET /user/:userId/prompt - List user's prompts
        .get(
          "/:userId/prompt",
          async ({ params, query, ctx }) => {
            const result = await this.#listUserPromptsUseCase.execute(ctx, {
              userId: params.userId,
              includeArchived: query.includeArchived === "true",
              cursor: query.cursor,
              limit: Math.min(query.limit ?? 20, 100),
            });
            if (result.isErr()) {
              return HttpEnvelope.error(result.error).toJson();
            }
            return HttpEnvelope.ok({
              data: result.value.items,
              meta: {
                cursor: result.value.cursor,
                hasMore: result.value.hasMore,
              },
            }).toJson();
          },
          {
            params: t.Object({
              userId: t.String(),
            }),
            query: t.Object({
              includeArchived: t.Optional(t.String()),
              cursor: t.Optional(t.String()),
              limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
            }),
          },
        )
    );
  }
}
