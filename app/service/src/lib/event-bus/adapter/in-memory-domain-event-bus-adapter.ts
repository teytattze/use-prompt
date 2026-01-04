import { type Result, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { BaseDomainEvent } from "@/lib/domain/base-domain-event";
import type { BaseProps } from "@/lib/domain/base-props";
import type { DomainEventBusPort } from "@/lib/event-bus/port/domain-event-bus-port";
import type { BaseDomainEventHandlerPort } from "@/lib/event-handler/base-domain-event-handler-port";

export class InMemoryDomainEventBusAdapter implements DomainEventBusPort {
  #handlers = new Map<
    string,
    BaseDomainEventHandlerPort<BaseDomainEvent<BaseProps>>[]
  >();

  subscribe<TEvent extends BaseDomainEvent<BaseProps>>(
    eventName: string,
    handler: BaseDomainEventHandlerPort<TEvent>,
  ): void {
    const existing = this.#handlers.get(eventName) ?? [];
    this.#handlers.set(eventName, [
      ...existing,
      handler as BaseDomainEventHandlerPort<BaseDomainEvent<BaseProps>>,
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
