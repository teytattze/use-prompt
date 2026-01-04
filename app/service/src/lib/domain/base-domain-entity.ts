import type { BaseProps } from "@/lib/domain/base-props";
import { type Id } from "@/lib/id";

export class BaseDomainEntity<T extends BaseProps = BaseProps> {
  id: Id;
  props: T;

  protected constructor(id: Id, props: T) {
    this.id = id;
    this.props = props;
  }
}
