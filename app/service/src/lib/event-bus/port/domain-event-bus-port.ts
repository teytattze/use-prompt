import type { Result } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { BaseDomainEvent } from "@/lib/domain/base-domain-event";
import type { BaseProps } from "@/lib/domain/base-props";
import type { BaseDomainEventHandlerPort } from "@/lib/event-handler/base-domain-event-handler-port";

export interface DomainEventBusPort {
  subscribe<TEvent extends BaseDomainEvent<BaseProps>>(
    eventName: string,
    handler: BaseDomainEventHandlerPort<TEvent>,
  ): void;

  publish(
    ctx: AppContext,
    events: BaseDomainEvent<BaseProps>[],
  ): Promise<Result<void, AppError>>;
}
