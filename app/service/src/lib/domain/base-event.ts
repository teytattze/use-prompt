import type { BaseProps } from "@/lib/domain/base-props";
import { type Id, newId } from "@/lib/id";

export class BaseEvent<T extends BaseProps> {
  id: Id;
  aggregateId: Id;
  occurredAt: Date;
  props: T;

  constructor(aggregateId: Id, props: T) {
    this.id = newId();
    this.aggregateId = aggregateId;
    this.occurredAt = new Date();
    this.props = props;
  }
}
