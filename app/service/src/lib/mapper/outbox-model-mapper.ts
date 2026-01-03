import type { BaseEvent } from "@/lib/domain/base-event";
import type { BaseProps } from "@/lib/domain/base-props";

export interface OutboxModelMapper<
  TDomain extends BaseEvent<BaseProps>,
  TModel,
> {
  fromDomain(domain: TDomain): TModel;
  fromDomains(domains: TDomain[]): TModel[];
}
