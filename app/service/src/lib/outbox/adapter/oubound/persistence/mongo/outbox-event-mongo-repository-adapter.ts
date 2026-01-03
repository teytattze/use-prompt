import { attemptAsync, isNil } from "es-toolkit";
import type { Collection } from "mongodb";
import { type Result, err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";
import type { OutboxModelMapper } from "@/lib/mapper/outbox-model-mapper";
import type { OutboxEventMongoModel } from "@/lib/outbox/adapter/oubound/persistence/mongo/outbox-event-mongo-model";
import type { OutboxEventRepositoryPort } from "@/lib/outbox/port/outbound/persistence/outbox-event-repository-port";

export class OutboxEventMongoRepositoryAdapter implements OutboxEventRepositoryPort {
  #collection: Collection<OutboxEventMongoModel>;
  #mapper: OutboxModelMapper<BaseEvent<BaseProps>, OutboxEventMongoModel>;

  constructor(
    collection: Collection<OutboxEventMongoModel>,
    mapper: OutboxModelMapper<BaseEvent<BaseProps>, OutboxEventMongoModel>,
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
}
