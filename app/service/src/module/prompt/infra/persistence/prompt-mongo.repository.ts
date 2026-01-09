import { attemptAsync, isNil } from "es-toolkit";
import { get } from "es-toolkit/compat";
import type { Collection, Document } from "mongodb";
import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type { Id } from "@/shared/core/id";
import type { PersistenceMapperPort } from "@/shared/port/persistence-mapper.port";
import type { PromptMongoModel } from "@/module/prompt/infra/persistence/prompt-mongo.model";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";
import type {
  CounterUpdates,
  PromptRepositoryPort,
  SearchPromptsQuery,
  SearchPromptsResult,
} from "@/module/prompt/port/prompt-repository.port";

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
    id: Id,
  ): Promise<Result<PromptAggregate | null, AppError>> {
    const [error, document] = await attemptAsync(
      async () =>
        await this.#collection.findOne(
          { _id: id },
          { session: ctx.db.session },
        ),
    );

    if (!isNil(error)) {
      return err(AppError.from(error, { message: get(error, "message") }));
    }

    if (isNil(document)) {
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

  async updateCounters(
    ctx: AppContext,
    id: Id,
    updates: CounterUpdates,
  ): Promise<Result<void, AppError>> {
    const $inc: Record<string, number> = {};

    if (updates.upvotes !== undefined) {
      $inc.upvotes = updates.upvotes;
    }
    if (updates.downvotes !== undefined) {
      $inc.downvotes = updates.downvotes;
    }
    if (updates.usedCount !== undefined) {
      $inc.usedCount = updates.usedCount;
    }

    if (Object.keys($inc).length === 0) {
      return ok(undefined);
    }

    const [error] = await attemptAsync(
      async () =>
        await this.#collection.updateOne(
          { _id: id },
          { $inc },
          { session: ctx.db.session },
        ),
    );

    return isNil(error)
      ? ok(undefined)
      : err(AppError.from(error, { message: get(error, "message") }));
  }

  async incrementUsedCount(
    ctx: AppContext,
    id: Id,
  ): Promise<Result<number, AppError>> {
    const [error, result] = await attemptAsync(
      async () =>
        await this.#collection.findOneAndUpdate(
          { _id: id },
          { $inc: { usedCount: 1 } },
          { session: ctx.db.session, returnDocument: "after" },
        ),
    );

    if (!isNil(error)) {
      return err(AppError.from(error, { message: get(error, "message") }));
    }

    return ok(result?.usedCount ?? 1);
  }
}
