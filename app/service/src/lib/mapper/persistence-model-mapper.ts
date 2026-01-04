import type { BaseDomainEntity } from "@/lib/domain/base-domain-entity";
import type { BaseProps } from "@/lib/domain/base-props";

export interface PersistenceModelMapper<
  TDomain extends BaseDomainEntity<BaseProps>,
  TModel,
> {
  fromDomain(domain: TDomain): TModel;
  toDomain(model: TModel): TDomain;
}
