import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { BaseDomainEvent } from "@/lib/domain/base-domain-event";
import type { BaseProps } from "@/lib/domain/base-props";

export interface BaseDomainEventHandlerPort<
  TEvent extends BaseDomainEvent<BaseProps> = BaseDomainEvent<BaseProps>,
> {
  handle(ctx: AppContext, event: TEvent): Promise<Result<void, AppError>>;
}
