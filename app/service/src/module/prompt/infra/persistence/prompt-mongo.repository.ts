import { attemptAsync, isNil } from "es-toolkit";
import { get } from "es-toolkit/compat";
import type { Collection, Document, Filter } from "mongodb";
import { type Result, err, ok } from "neverthrow";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";
import type { PromptMongoModel } from "@/module/prompt/infra/persistence/prompt-mongo.model";
import type {
  BrowseFilter,
  FindByAuthorParams,
  FindRecentParams,
  FindTrendingParams,
  PaginatedResult,
  PromptRepositoryPort,
  PromptWithAuraResult,
  SearchByTextParams,
  SearchByTextResult,
  SearchPromptsQuery,
  SearchPromptsResult,
  TrendingPromptResult,
} from "@/module/prompt/port/prompt-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type { PersistenceMapperPort } from "@/shared/port/persistence-mapper.port";

export class PromptMongoRepository implements PromptRepositoryPort {
  #collection: Collection<PromptMongoModel>;
  #mapper: PersistenceMapperPort<PromptAggregate, PromptMongoModel>;

  constructor(
    collection: Collection<PromptMongoModel>,
    mapper: PersistenceMapperPort<PromptAggregate, PromptMongoModel>,
  ) {
    this.#collection = collection;
    this.#mapper = mapper;
  }

  async insertOne(
    ctx: AppContext,
    data: PromptAggregate,
  ): Promise<Result<PromptAggregate, AppError>> {
    const model = this.#mapper.fromDomain(data);

    const [error] = await attemptAsync(
      async () =>
        await this.#collection.insertOne(model, { session: ctx.db.session }),
    );

    return isNil(error)
      ? ok(data)
      : err(AppError.from(error, { message: get(error, "message") }));
  }

  async findById(
    ctx: AppContext,
    id: string,
  ): Promise<Result<PromptAggregate | null, AppError>> {
    const [error, document] = await attemptAsync(
      async () =>
        await this.#collection.findOne(
          { _id: id as PromptMongoModel["_id"] },
          { session: ctx.db.session },
        ),
    );

    if (!isNil(error)) {
      return err(AppError.from(error, { message: get(error, "message") }));
    }

    if (!document) {
      return ok(null);
    }

    return ok(this.#mapper.toDomain(document));
  }

  async findMany(
    ctx: AppContext,
  ): Promise<Result<PromptAggregate[], AppError>> {
    const [error, documents] = await attemptAsync(
      async () =>
        await this.#collection.find({}, { session: ctx.db.session }).toArray(),
    );

    if (!isNil(error)) {
      return err(AppError.from(error, { message: get(error, "message") }));
    }
    const aggregates =
      documents?.map((doc) => this.#mapper.toDomain(doc)) ?? [];

    return ok(aggregates);
  }

  async search(
    ctx: AppContext,
    query: SearchPromptsQuery,
  ): Promise<Result<SearchPromptsResult, AppError>> {
    const limit = query.limit ?? 20;

    const pipeline: Document[] = [
      {
        $search: {
          index: "prompt_search",
          text: {
            query: query.query,
            path: ["title", "description", "messages.content"],
            fuzzy: {
              maxEdits: 1,
              prefixLength: 2,
            },
          },
        },
      },
      {
        $facet: {
          results: [{ $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [error, result] = await attemptAsync(async () =>
      this.#collection
        .aggregate<{
          results: PromptMongoModel[];
          total: [{ count: number }] | [];
        }>(pipeline, { session: ctx.db.session })
        .toArray(),
    );

    if (!isNil(error)) {
      return err(AppError.from(error, { message: get(error, "message") }));
    }

    const facetResult = result?.[0];
    const documents = facetResult?.results ?? [];
    const total = facetResult?.total[0]?.count ?? 0;

    const aggregates = documents.map((doc) => this.#mapper.toDomain(doc));

    return ok({ prompts: aggregates, total });
  }

  async findByAuthor(
    ctx: AppContext,
    params: FindByAuthorParams,
  ): Promise<Result<PaginatedResult<PromptAggregate>, AppError>> {
    // Build query filter
    const filter: Filter<PromptMongoModel> = {
      authorId: params.authorId,
    };

    // Exclude archived unless requested
    if (!params.includeArchived) {
      filter.archivedAt = null;
    }

    // Add cursor condition if provided (cursor is the _id for pagination)
    if (params.pagination.cursor) {
      filter._id = {
        $lt: params.pagination.cursor as PromptMongoModel["_id"],
      };
    }

    const [error, documents] = await attemptAsync(async () =>
      this.#collection
        .find(filter, { session: ctx.db.session })
        .sort({ createdAt: -1, _id: -1 })
        .limit(params.pagination.limit + 1) // Fetch one extra to determine hasMore
        .toArray(),
    );

    if (!isNil(error)) {
      return err(AppError.from(error, { message: get(error, "message") }));
    }

    if (!documents) {
      return ok({ items: [], cursor: null, hasMore: false });
    }

    // Check if there are more results
    const hasMore = documents.length > params.pagination.limit;
    const items = hasMore ? documents.slice(0, -1) : documents;
    const lastItem = items[items.length - 1];

    return ok({
      items: items.map((doc) => this.#mapper.toDomain(doc)),
      cursor: lastItem ? lastItem._id : null,
      hasMore,
    });
  }

  async updateArchivedAt(
    ctx: AppContext,
    params: {
      id: string;
      archivedAt: Date;
    },
  ): Promise<Result<void, AppError>> {
    const [error] = await attemptAsync(async () =>
      this.#collection.updateOne(
        { _id: params.id as PromptMongoModel["_id"] },
        { $set: { archivedAt: params.archivedAt } },
        { session: ctx.db.session },
      ),
    );

    if (!isNil(error)) {
      return err(AppError.from(error, { message: get(error, "message") }));
    }

    return ok(undefined);
  }

  async findTrending(
    ctx: AppContext,
    params: FindTrendingParams,
  ): Promise<Result<PaginatedResult<TrendingPromptResult>, AppError>> {
    const gravity = params.gravity ?? 1.5;

    // Build match stage
    const matchStage = this.#buildBrowseMatchStage(params.filter);

    // Apply cursor condition if provided
    // For trending, we use _id as a secondary sort key for pagination
    if (params.pagination.cursor) {
      matchStage._id = { $lt: params.pagination.cursor };
    }

    const pipeline: Document[] = [
      { $match: matchStage },
      // Lookup votes and sum for aura
      {
        $lookup: {
          from: "vote",
          localField: "_id",
          foreignField: "promptId",
          as: "votes",
        },
      },
      // Calculate aura
      {
        $addFields: {
          aura: { $sum: "$votes.value" },
        },
      },
      // Calculate hours since creation
      {
        $addFields: {
          hoursAge: {
            $divide: [{ $subtract: [new Date(), "$createdAt"] }, 3600000],
          },
        },
      },
      // Calculate trending score
      {
        $addFields: {
          score: {
            $divide: ["$aura", { $pow: [{ $add: ["$hoursAge", 2] }, gravity] }],
          },
        },
      },
      // Sort by score descending, then _id for stability
      { $sort: { score: -1, _id: -1 } },
      // Limit results
      { $limit: params.pagination.limit + 1 },
      // Project out votes array and hoursAge
      { $project: { votes: 0, hoursAge: 0 } },
    ];

    const [error, results] = await attemptAsync(async () =>
      this.#collection
        .aggregate<
          PromptMongoModel & { aura: number; score: number }
        >(pipeline, { session: ctx.db.session })
        .toArray(),
    );

    if (!isNil(error)) {
      return err(
        AppError.from(error, { message: "Failed to find trending prompts" }),
      );
    }

    if (!results) {
      return ok({ items: [], cursor: null, hasMore: false });
    }

    // Check for more
    const hasMore = results.length > params.pagination.limit;
    const items = hasMore ? results.slice(0, -1) : results;
    const lastItem = items[items.length - 1];

    return ok({
      items: items.map((doc) => ({
        prompt: this.#mapper.toDomain(doc),
        aura: doc.aura,
        score: doc.score,
      })),
      cursor: lastItem ? lastItem._id : null,
      hasMore,
    });
  }

  async findRecent(
    ctx: AppContext,
    params: FindRecentParams,
  ): Promise<Result<PaginatedResult<PromptWithAuraResult>, AppError>> {
    // Build match stage
    const matchStage = this.#buildBrowseMatchStage(params.filter);

    // Cursor-based pagination on _id (which correlates with createdAt for ObjectId/ULID)
    if (params.pagination.cursor) {
      matchStage._id = { $lt: params.pagination.cursor };
    }

    const pipeline: Document[] = [
      { $match: matchStage },
      // Sort by createdAt descending
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: params.pagination.limit + 1 },
      // Lookup votes for aura
      {
        $lookup: {
          from: "vote",
          localField: "_id",
          foreignField: "promptId",
          as: "votes",
        },
      },
      {
        $addFields: {
          aura: { $sum: "$votes.value" },
        },
      },
      { $project: { votes: 0 } },
    ];

    const [error, results] = await attemptAsync(async () =>
      this.#collection
        .aggregate<PromptMongoModel & { aura: number }>(pipeline, {
          session: ctx.db.session,
        })
        .toArray(),
    );

    if (!isNil(error)) {
      return err(
        AppError.from(error, { message: "Failed to find recent prompts" }),
      );
    }

    if (!results) {
      return ok({ items: [], cursor: null, hasMore: false });
    }

    const hasMore = results.length > params.pagination.limit;
    const items = hasMore ? results.slice(0, -1) : results;
    const lastItem = items[items.length - 1];

    return ok({
      items: items.map((doc) => ({
        prompt: this.#mapper.toDomain(doc),
        aura: doc.aura,
      })),
      cursor: lastItem ? lastItem._id : null,
      hasMore,
    });
  }

  async searchByText(
    ctx: AppContext,
    params: SearchByTextParams,
  ): Promise<Result<SearchByTextResult, AppError>> {
    // Build search compound query
    const mustClauses: Document[] = [
      {
        text: {
          query: params.query,
          path: ["title", "description", "messages.content"],
          fuzzy: {
            maxEdits: 2,
            prefixLength: 2,
          },
        },
      },
    ];

    const filterClauses: Document[] = [
      // Exclude archived prompts
      {
        equals: {
          path: "archivedAt",
          value: null,
        },
      },
    ];

    // Add category filter if provided
    if (params.filter?.category) {
      filterClauses.push({
        text: {
          query: params.filter.category,
          path: "category",
        },
      });
    }

    // Add tags filter if provided
    if (params.filter?.tags && params.filter.tags.length > 0) {
      filterClauses.push({
        text: {
          query: params.filter.tags.join(" "),
          path: "tags",
        },
      });
    }

    const pipeline: Document[] = [
      {
        $search: {
          index: "prompt_search",
          compound: {
            must: mustClauses,
            filter: filterClauses,
          },
        },
      },
      // Get search score
      {
        $addFields: {
          searchScore: { $meta: "searchScore" },
        },
      },
      // Lookup votes for aura
      {
        $lookup: {
          from: "vote",
          localField: "_id",
          foreignField: "promptId",
          as: "votes",
        },
      },
      {
        $addFields: {
          aura: { $sum: "$votes.value" },
        },
      },
      // Calculate final score: textRelevance * 0.7 + normalizedAura * 0.3
      {
        $addFields: {
          normalizedAura: { $min: [{ $divide: ["$aura", 100] }, 1.0] },
          finalScore: {
            $add: [
              { $multiply: ["$searchScore", 0.7] },
              {
                $multiply: [{ $min: [{ $divide: ["$aura", 100] }, 1.0] }, 0.3],
              },
            ],
          },
        },
      },
      { $sort: { finalScore: -1, _id: -1 } },
      // Pagination
      ...(params.pagination.cursor
        ? [{ $match: { _id: { $lt: params.pagination.cursor } } }]
        : []),
      { $limit: params.pagination.limit + 1 },
      { $project: { votes: 0, normalizedAura: 0, finalScore: 0 } },
    ];

    const [error, results] = await attemptAsync(async () =>
      this.#collection
        .aggregate<
          PromptMongoModel & { aura: number; searchScore: number }
        >(pipeline, { session: ctx.db.session })
        .toArray(),
    );

    if (!isNil(error)) {
      // Handle missing search index gracefully (error code 40324)
      const errorCode = get(error, "code");
      if (errorCode === 40324 || errorCode === 31082) {
        return ok({
          items: [],
          cursor: null,
          hasMore: false,
          facets: { categories: {}, tags: {} },
        });
      }
      return err(AppError.from(error, { message: "Failed to search prompts" }));
    }

    if (!results) {
      return ok({
        items: [],
        cursor: null,
        hasMore: false,
        facets: { categories: {}, tags: {} },
      });
    }

    // Get facets (separate query)
    const facetsResult = await this.#getSearchFacets(ctx, params.query);
    const facets = facetsResult.isOk()
      ? facetsResult.value
      : { categories: {}, tags: {} };

    const hasMore = results.length > params.pagination.limit;
    const items = hasMore ? results.slice(0, -1) : results;
    const lastItem = items[items.length - 1];

    return ok({
      items: items.map((doc) => ({
        prompt: this.#mapper.toDomain(doc),
        aura: doc.aura,
        searchScore: doc.searchScore,
      })),
      cursor: lastItem ? lastItem._id : null,
      hasMore,
      facets,
    });
  }

  /**
   * Build match stage for browse queries (shared between trending/recent).
   */
  #buildBrowseMatchStage(filter?: BrowseFilter): Record<string, unknown> {
    const matchStage: Record<string, unknown> = {
      archivedAt: null, // Exclude archived
    };

    if (filter?.category) {
      matchStage.category = filter.category;
    }

    if (filter?.tags && filter.tags.length > 0) {
      matchStage.tags = { $in: filter.tags }; // Match ANY tag
    }

    return matchStage;
  }

  /**
   * Get facet counts for search results.
   */
  async #getSearchFacets(
    ctx: AppContext,
    query: string,
  ): Promise<
    Result<
      { categories: Record<string, number>; tags: Record<string, number> },
      AppError
    >
  > {
    const pipeline: Document[] = [
      {
        $searchMeta: {
          index: "prompt_search",
          facet: {
            operator: {
              compound: {
                must: [
                  {
                    text: {
                      query,
                      path: ["title", "description", "messages.content"],
                    },
                  },
                ],
                filter: [{ equals: { path: "archivedAt", value: null } }],
              },
            },
            facets: {
              categories: { type: "string", path: "category" },
              tags: { type: "string", path: "tags", numBuckets: 20 },
            },
          },
        },
      },
    ];

    const [error, result] = await attemptAsync(async () =>
      this.#collection
        .aggregate<{
          facet: {
            categories?: { buckets: Array<{ _id: string; count: number }> };
            tags?: { buckets: Array<{ _id: string; count: number }> };
          };
        }>(pipeline, { session: ctx.db.session })
        .toArray(),
    );

    if (!isNil(error)) {
      // Graceful fallback on error
      return ok({ categories: {}, tags: {} });
    }

    const meta = result?.[0];
    if (!meta?.facet) {
      return ok({ categories: {}, tags: {} });
    }

    const categories: Record<string, number> = {};
    for (const bucket of meta.facet.categories?.buckets ?? []) {
      categories[bucket._id] = bucket.count;
    }

    const tags: Record<string, number> = {};
    for (const bucket of meta.facet.tags?.buckets ?? []) {
      tags[bucket._id] = bucket.count;
    }

    return ok({ categories, tags });
  }
}
