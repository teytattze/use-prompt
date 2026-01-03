import { attemptAsync, isNil } from "es-toolkit";
import { get } from "es-toolkit/compat";
import type { Collection } from "mongodb";
import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type { PersistenceModelMapper } from "@/lib/mapper/persistence-model-mapper";
import type { PromptMongoModel } from "@/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type { PromptRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-repository-port";

export class PromptMongoRepository implements PromptRepositoryPort {
  #collection: Collection<PromptMongoModel>;
  #mapper: PersistenceModelMapper<PromptAggregate, PromptMongoModel>;

  constructor(
    collection: Collection<PromptMongoModel>,
    mapper: PersistenceModelMapper<PromptAggregate, PromptMongoModel>,
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
}
