import type { BaseDomainEntity } from "@/shared/domain/base-entity";
import type { BaseProps } from "@/shared/domain/base-props";

export interface PersistenceMapperPort<
  TDomain extends BaseDomainEntity<BaseProps>,
  TModel,
> {
  fromDomain(domain: TDomain): TModel;
  toDomain(model: TModel): TDomain;
}
