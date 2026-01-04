import { BaseDomainEntity } from "@/lib/domain/base-domain-entity";
import type { BaseDomainEvent } from "@/lib/domain/base-domain-event";
import type { BaseProps } from "@/lib/domain/base-props";

export class BaseDomainAggregate<
  T extends BaseProps,
> extends BaseDomainEntity<T> {
  #events: BaseDomainEvent<BaseProps>[] = [];

  addEvent(event: BaseDomainEvent<BaseProps>) {
    this.#events.push(event);
  }

  pullEvents(): BaseDomainEvent<BaseProps>[] {
    const events = [...this.#events];
    this.#events = [];
    return events;
  }

  get hasEvents(): boolean {
    return this.#events.length > 0;
  }
}
