import { attemptAsync, isNil } from "es-toolkit";
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
    _: AppContext,
    data: PromptAggregate,
  ): Promise<Result<PromptAggregate, AppError>> {
    const model = this.#mapper.fromDomain(data);
    const [error] = await attemptAsync(
      async () => await this.#collection.insertOne(model),
    );
    return !isNil(error) ? err(AppError.from(error)) : ok(data);
  }

  async findMany(_: AppContext): Promise<Result<PromptAggregate[], AppError>> {
    const [error, documents] = await attemptAsync(
      async () => await this.#collection.find({}).toArray(),
    );
    if (!isNil(error) || isNil(documents)) {
      return err(AppError.from(error));
    }
    const aggregates = documents.map((doc) => this.#mapper.toDomain(doc));
    return ok(aggregates);
  }
}
