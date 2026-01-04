import type { BaseDomainEntity } from "@/lib/domain/base-domain-entity";
import type { BaseProps } from "@/lib/domain/base-props";

export interface UseCaseDtoMapper<
  TDomain extends BaseDomainEntity<BaseProps>,
  TUseCaseDto,
> {
  toDto(domain: TDomain): TUseCaseDto;
}
