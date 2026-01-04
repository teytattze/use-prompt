import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { OutboxEvent } from "@/lib/outbox/domain/outbox-event";

export interface EventHandlerPort {
  handle(ctx: AppContext, event: OutboxEvent): Promise<Result<void, AppError>>;
}
