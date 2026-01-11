import type {
  PromptDto,
  PromptSummaryDto,
  PromptWithAuthorDto,
} from "@/module/prompt/application/dto/prompt.dto";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";
import type { DtoMapperPort } from "@/shared/port/dto-mapper.port";

export class PromptDtoMapper implements DtoMapperPort<
  PromptAggregate,
  PromptDto
> {
  /**
   * Basic DTO with computed aura.
   */
  toDto(domain: PromptAggregate, aura = 0): PromptDto {
    return {
      id: domain.id,
      title: domain.props.title,
      description: domain.props.description,
      messages: domain.props.messages,
      // New fields
      authorId: domain.props.authorId,
      category: domain.props.category,
      tags: [...domain.props.tags],
      aura,
      createdAt: domain.props.createdAt.toISOString(),
      archivedAt: domain.props.archivedAt?.toISOString() ?? null,
    };
  }

  /**
   * DTO with author info and viewer's vote.
   */
  toWithAuthorDto(
    domain: PromptAggregate,
    aura: number,
    userAura: number,
    viewerVote: { value: 1 | -1 } | null,
  ): PromptWithAuthorDto {
    return {
      ...this.toDto(domain, aura),
      author: {
        id: domain.props.authorId,
        userAura,
      },
      viewerVote,
    };
  }

  /**
   * Summary DTO for list views.
   */
  toSummaryDto(domain: PromptAggregate, aura = 0): PromptSummaryDto {
    return {
      id: domain.id,
      authorId: domain.props.authorId,
      title: domain.props.title,
      category: domain.props.category,
      tags: [...domain.props.tags],
      aura,
      createdAt: domain.props.createdAt.toISOString(),
    };
  }
}
