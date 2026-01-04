import type { BaseProps } from "@/shared/domain/base-props";
import { type Id } from "@/shared/core/id";

export class BaseDomainEntity<T extends BaseProps = BaseProps> {
  id: Id;
  props: T;

  protected constructor(id: Id, props: T) {
    this.id = id;
    this.props = props;
  }
}
