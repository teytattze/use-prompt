import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";

export interface OutboxEventRepositoryPort {
  insertMany(
    ctx: AppContext,
    events: BaseEvent<BaseProps>[],
  ): Promise<Result<void, AppError>>;
}
