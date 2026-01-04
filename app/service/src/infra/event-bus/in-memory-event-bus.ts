import { type Result, ok } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";
import type { BaseDomainEvent } from "@/shared/domain/base-domain-event";
import type { BaseProps } from "@/shared/domain/base-props";
import type { DomainEventBusPort } from "@/shared/port/domain-event-bus.port";
import type { DomainEventHandlerPort } from "@/shared/port/domain-event-handler.port";

export class InMemoryEventBus implements DomainEventBusPort {
  #handlers = new Map<
    string,
    DomainEventHandlerPort<BaseDomainEvent<BaseProps>>[]
  >();

  subscribe<TEvent extends BaseDomainEvent<BaseProps>>(
    eventName: string,
    handler: DomainEventHandlerPort<TEvent>,
  ): void {
    const existing = this.#handlers.get(eventName) ?? [];
    this.#handlers.set(eventName, [
      ...existing,
      handler as DomainEventHandlerPort<BaseDomainEvent<BaseProps>>,
    ]);
  }

  async publish(
    ctx: AppContext,
    events: BaseDomainEvent<BaseProps>[],
  ): Promise<Result<void, AppError>> {
    for (const event of events) {
      const handlers = this.#handlers.get(event.name) ?? [];

      for (const handler of handlers) {
        const result = await handler.handle(ctx, event);
        if (result.isErr()) {
          return result;
        }
      }
    }

    return ok(undefined);
  }
}
