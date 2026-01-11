import { attemptAsync, isNil } from "es-toolkit";
import { get } from "es-toolkit/compat";
import type { Collection, Document } from "mongodb";
import { type Result, err, ok } from "neverthrow";
import type { VoteAggregate } from "@/module/vote/domain/aggregate/vote.aggregate";
import type { VoteMongoModel } from "@/module/vote/infra/persistence/vote-mongo.model";
import type { VoteRepositoryPort } from "@/module/vote/port/vote-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type { PersistenceMapperPort } from "@/shared/port/persistence-mapper.port";

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
    vote: VoteAggregate,
  ): Promise<Result<VoteAggregate, AppError>> {
    const model = this.#mapper.fromDomain(vote);

    const [error] = await attemptAsync(
      async () =>
        await this.#collection.insertOne(model, { session: ctx.db.session }),
    );

    if (!isNil(error)) {
      // Handle duplicate key error (unique constraint violation)
      if ((error as { code?: number }).code === 11000) {
        return err(
          AppError.from("conflict", { message: "Vote already exists" }),
        );
      }
      return err(AppError.from(error, { message: get(error, "message") }));
    }

    return ok(vote);
  }

  async findByPromptAndUser(
    ctx: AppContext,
    params: {
      promptId: string;
      userId: string;
    },
  ): Promise<Result<VoteAggregate | null, AppError>> {
    const [error, document] = await attemptAsync(
      async () =>
        await this.#collection.findOne(
          {
            promptId: params.promptId,
            userId: params.userId,
          },
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

  async updateOne(
    ctx: AppContext,
    vote: VoteAggregate,
  ): Promise<Result<VoteAggregate, AppError>> {
    const [error] = await attemptAsync(
      async () =>
        await this.#collection.updateOne(
          { _id: vote.id },
          {
            $set: {
              value: vote.value,
              updatedAt: vote.updatedAt,
            },
          },
          { session: ctx.db.session },
        ),
    );

    if (!isNil(error)) {
      return err(AppError.from(error, { message: get(error, "message") }));
    }

    return ok(vote);
  }

  async deleteOne(
    ctx: AppContext,
    params: {
      promptId: string;
      userId: string;
    },
  ): Promise<Result<void, AppError>> {
    const [error] = await attemptAsync(
      async () =>
        await this.#collection.deleteOne(
          {
            promptId: params.promptId,
            userId: params.userId,
          },
          { session: ctx.db.session },
        ),
    );

    if (!isNil(error)) {
      return err(AppError.from(error, { message: get(error, "message") }));
    }

    return ok(undefined);
  }

  async sumByPromptId(
    ctx: AppContext,
    promptId: string,
  ): Promise<Result<number, AppError>> {
    const pipeline: Document[] = [
      { $match: { promptId } },
      { $group: { _id: null, aura: { $sum: "$value" } } },
    ];

    const [error, result] = await attemptAsync(
      async () =>
        await this.#collection
          .aggregate<{ aura: number }>(pipeline, { session: ctx.db.session })
          .toArray(),
    );

    if (!isNil(error)) {
      return err(AppError.from(error, { message: get(error, "message") }));
    }

    const aura = result?.[0]?.aura ?? 0;
    return ok(aura);
  }

  async sumByAuthorId(
    ctx: AppContext,
    authorId: string,
  ): Promise<Result<number, AppError>> {
    // This requires a $lookup to prompts collection
    const pipeline: Document[] = [
      {
        $lookup: {
          from: "prompt",
          localField: "promptId",
          foreignField: "_id",
          as: "prompt",
        },
      },
      { $unwind: "$prompt" },
      { $match: { "prompt.authorId": authorId } },
      { $group: { _id: null, userAura: { $sum: "$value" } } },
    ];

    const [error, result] = await attemptAsync(
      async () =>
        await this.#collection
          .aggregate<{ userAura: number }>(pipeline, {
            session: ctx.db.session,
          })
          .toArray(),
    );

    if (!isNil(error)) {
      return err(AppError.from(error, { message: get(error, "message") }));
    }

    const userAura = result?.[0]?.userAura ?? 0;
    return ok(userAura);
  }
}
