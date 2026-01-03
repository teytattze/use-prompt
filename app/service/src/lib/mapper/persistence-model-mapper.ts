import type { BaseEntity } from "@/lib/domain/base-entity";
import type { BaseProps } from "@/lib/domain/base-props";

export interface PersistenceModelMapper<
  TDomain extends BaseEntity<BaseProps>,
  TModel,
> {
  fromDomain(domain: TDomain): TModel;
  toDomain(model: TModel): TDomain;
}
