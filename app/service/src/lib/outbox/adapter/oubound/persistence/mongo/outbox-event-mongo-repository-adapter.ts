import { attemptAsync, isNil } from "es-toolkit";
import type { Collection } from "mongodb";
import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";
import type { Id } from "@/lib/id";
import type { OutboxEventMongoModel } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model";
import type { OutboxEventMongoModelMapper } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model-mapper";
import type { OutboxEvent } from "@/lib/outbox/domain/outbox-event";
import type { OutboxEventRepositoryPort } from "@/lib/outbox/port/outbound/persistence/outbox-event-repository-port";

export class OutboxEventMongoRepositoryAdapter implements OutboxEventRepositoryPort {
  #collection: Collection<OutboxEventMongoModel>;
  #mapper: OutboxEventMongoModelMapper;

  constructor(
    collection: Collection<OutboxEventMongoModel>,
    mapper: OutboxEventMongoModelMapper,
  ) {
    this.#collection = collection;
    this.#mapper = mapper;
  }

  async insertMany(
    ctx: AppContext,
    events: BaseEvent<BaseProps>[],
  ): Promise<Result<void, AppError>> {
    if (events.length === 0) {
      return ok();
    }

    const models = this.#mapper.fromDomains(events);
    const [error] = await attemptAsync(async () => {
      await this.#collection.insertMany(models, { session: ctx.db.session });
    });

    if (!isNil(error)) {
      return err(AppError.from(error));
    }

    return ok();
  }

  async findPending(
    ctx: AppContext,
    limit: number,
  ): Promise<Result<OutboxEvent[], AppError>> {
    const [error, models] = await attemptAsync(async () => {
      const cursor = this.#collection
        .find({ status: "PENDING" }, { session: ctx.db.session })
        .sort({ occurredAt: 1 })
        .limit(limit);

      return cursor.toArray();
    });

    if (!isNil(error)) {
      return err(AppError.from(error));
    }

    return ok(this.#mapper.toDomains(models ?? []));
  }

  async markProcessed(
    ctx: AppContext,
    eventId: Id,
  ): Promise<Result<void, AppError>> {
    const [error] = await attemptAsync(async () => {
      await this.#collection.updateOne(
        { _id: eventId },
        {
          $set: {
            status: "PUBLISHED",
            publishedAt: new Date(),
          },
        },
        { session: ctx.db.session },
      );
    });

    if (!isNil(error)) {
      return err(AppError.from(error));
    }

    return ok();
  }

  async markFailed(
    ctx: AppContext,
    eventId: Id,
    errorMessage: string,
    maxRetries: number,
  ): Promise<Result<void, AppError>> {
    const [error] = await attemptAsync(async () => {
      const doc = await this.#collection.findOne(
        { _id: eventId },
        { session: ctx.db.session },
      );

      if (isNil(doc)) {
        throw new Error(`Outbox event not found: ${eventId}`);
      }

      const newRetryCount = doc.retryCount + 1;
      const newStatus = newRetryCount >= maxRetries ? "FAILED" : "PENDING";

      await this.#collection.updateOne(
        { _id: eventId },
        {
          $set: {
            status: newStatus,
            retryCount: newRetryCount,
            lastError: errorMessage,
          },
        },
        { session: ctx.db.session },
      );
    });

    if (!isNil(error)) {
      return err(AppError.from(error));
    }

    return ok();
  }
}
