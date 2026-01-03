import type { BaseEntity } from "@/lib/domain/base-entity";
import type { BaseProps } from "@/lib/domain/base-props";

export interface UseCaseDtoMapper<
  TDomain extends BaseEntity<BaseProps>,
  TUseCaseDto,
> {
  toDto(domain: TDomain): TUseCaseDto;
}
