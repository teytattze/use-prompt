import type { Result } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";
import type { BaseDomainEvent } from "@/shared/domain/base-domain-event";
import type { BaseProps } from "@/shared/domain/base-props";

export interface DomainEventHandlerPort<
  TEvent extends BaseDomainEvent<BaseProps> = BaseDomainEvent<BaseProps>,
> {
  handle(ctx: AppContext, event: TEvent): Promise<Result<void, AppError>>;
}
