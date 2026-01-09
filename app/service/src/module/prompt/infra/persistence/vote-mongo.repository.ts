import { attemptAsync, isNil } from "es-toolkit";
import { get } from "es-toolkit/compat";
import type { Collection } from "mongodb";
import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type { Id } from "@/shared/core/id";
import type { PersistenceMapperPort } from "@/shared/port/persistence-mapper.port";
import type { VoteMongoModel } from "@/module/prompt/infra/persistence/vote-mongo.model";
import type { VoteAggregate } from "@/module/prompt/domain/aggregate/vote.aggregate";
import type { VoteRepositoryPort } from "@/module/prompt/port/vote-repository.port";

export class VoteMongoRepository implements VoteRepositoryPort {
  #collection: Collection<VoteMongoModel>;
  #mapper: PersistenceMapperPort<VoteAggregate, VoteMongoModel>;

  constructor(
    collection: Collection<VoteMongoModel>,
    mapper: PersistenceMapperPort<VoteAggregate, VoteMongoModel>,
  ) {
    this.#collection = collection;
    this.#mapper = mapper;
  }

  async insertOne(
    ctx: AppContext,
    data: VoteAggregate,
  ): Promise<Result<VoteAggregate, AppError>> {
    const model = this.#mapper.fromDomain(data);

    const [error] = await attemptAsync(
      async () =>
        await this.#collection.insertOne(model, { session: ctx.db.session }),
    );

    return isNil(error)
      ? ok(data)
      : err(AppError.from(error, { message: get(error, "message") }));
  }

  async findByPromptAndUser(
    ctx: AppContext,
    promptId: Id,
    userId: string,
  ): Promise<Result<VoteAggregate | null, AppError>> {
    const [error, document] = await attemptAsync(
      async () =>
        await this.#collection.findOne(
          { promptId, userId },
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

  async updateOne(
    ctx: AppContext,
    data: VoteAggregate,
  ): Promise<Result<void, AppError>> {
    const model = this.#mapper.fromDomain(data);

    const [error] = await attemptAsync(
      async () =>
        await this.#collection.updateOne(
          { _id: data.id },
          {
            $set: {
              voteType: model.voteType,
              updatedAt: model.updatedAt,
            },
          },
          { session: ctx.db.session },
        ),
    );

    return isNil(error)
      ? ok(undefined)
      : err(AppError.from(error, { message: get(error, "message") }));
  }

  async deleteOne(ctx: AppContext, id: Id): Promise<Result<void, AppError>> {
    const [error] = await attemptAsync(
      async () =>
        await this.#collection.deleteOne(
          { _id: id },
          { session: ctx.db.session },
        ),
    );

    return isNil(error)
      ? ok(undefined)
      : err(AppError.from(error, { message: get(error, "message") }));
  }
}
