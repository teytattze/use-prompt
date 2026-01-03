import type { UseCaseDtoMapper } from "@/lib/mapper/use-case-dto-mapper";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type { PromptUseCaseDto } from "@/module/prompt/port/inbound/use-case/prompt-use-case-dto";

export class PromptUseCaseDtoMapper implements UseCaseDtoMapper<
  PromptAggregate,
  PromptUseCaseDto
> {
  toDto(domain: PromptAggregate): PromptUseCaseDto {
    return {
      id: domain.id,
      title: domain.props.title,
      messages: domain.props.messages,
    };
  }
}
