import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";
import type { Id } from "@/lib/id";
import type { OutboxEvent } from "@/lib/outbox/domain/outbox-event";

export interface OutboxEventRepositoryPort {
  insertMany(
    ctx: AppContext,
    events: BaseEvent<BaseProps>[],
  ): Promise<Result<void, AppError>>;

  findPending(
    ctx: AppContext,
    limit: number,
  ): Promise<Result<OutboxEvent[], AppError>>;

  markProcessed(ctx: AppContext, eventId: Id): Promise<Result<void, AppError>>;

  markFailed(
    ctx: AppContext,
    eventId: Id,
    error: string,
    maxRetries: number,
  ): Promise<Result<void, AppError>>;
}
