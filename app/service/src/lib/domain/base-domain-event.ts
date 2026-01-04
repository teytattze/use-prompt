import type { BaseProps } from "@/lib/domain/base-props";
import { type Id, newId } from "@/lib/id";

export class BaseDomainEvent<T extends BaseProps = BaseProps> {
  id: Id;
  aggregateId: Id;
  name: string;
  createdAt: Date;

  props: T;

  constructor(aggregateId: Id, name: string, props: T) {
    this.id = newId();
    this.aggregateId = aggregateId;
    this.name = name;
    this.createdAt = new Date();
    this.props = props;
  }
}
