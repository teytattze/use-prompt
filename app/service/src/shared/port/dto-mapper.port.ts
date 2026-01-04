import type { BaseDomainEntity } from "@/shared/domain/base-entity";
import type { BaseProps } from "@/shared/domain/base-props";

export interface DtoMapperPort<
  TDomain extends BaseDomainEntity<BaseProps>,
  TDto,
> {
  toDto(domain: TDomain): TDto;
}
