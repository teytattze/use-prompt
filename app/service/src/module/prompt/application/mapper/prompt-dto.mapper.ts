import type { DtoMapperPort } from "@/shared/port/dto-mapper.port";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";
import type { PromptDto } from "@/module/prompt/application/dto/prompt.dto";

export class PromptDtoMapper implements DtoMapperPort<PromptAggregate, PromptDto> {
  toDto(domain: PromptAggregate): PromptDto {
    return {
      id: domain.id,
      title: domain.props.title,
      messages: domain.props.messages,
    };
  }
}
