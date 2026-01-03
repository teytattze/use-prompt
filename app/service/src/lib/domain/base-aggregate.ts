import { BaseEntity } from "@/lib/domain/base-entity";
import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";

export class BaseAggregate<T extends BaseProps> extends BaseEntity<T> {
  #events: BaseEvent<BaseProps>[] = [];

  addEvent(event: BaseEvent<BaseProps>) {
    this.#events.push(event);
  }
}
