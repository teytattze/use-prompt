import type {
  VoteDto,
  VoteValueDto,
} from "@/module/vote/application/dto/vote.dto";
import type { VoteAggregate } from "@/module/vote/domain/aggregate/vote.aggregate";
import type { DtoMapperPort } from "@/shared/port/dto-mapper.port";

export class VoteDtoMapper implements DtoMapperPort<VoteAggregate, VoteDto> {
  toDto(domain: VoteAggregate): VoteDto {
    return {
      promptId: domain.props.promptId,
      value: domain.props.value,
      createdAt: domain.props.createdAt,
      updatedAt: domain.props.updatedAt,
    };
  }

  toValueDto(domain: VoteAggregate): VoteValueDto {
    return {
      value: domain.props.value,
    };
  }
}
