import type { Result } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";
import type { BaseDomainEvent } from "@/shared/domain/base-domain-event";
import type { BaseProps } from "@/shared/domain/base-props";
import type { DomainEventHandlerPort } from "@/shared/port/domain-event-handler.port";

export interface DomainEventBusPort {
  subscribe<TEvent extends BaseDomainEvent<BaseProps>>(
    eventName: string,
    handler: DomainEventHandlerPort<TEvent>,
  ): void;

  publish(
    ctx: AppContext,
    events: BaseDomainEvent<BaseProps>[],
  ): Promise<Result<void, AppError>>;
}
