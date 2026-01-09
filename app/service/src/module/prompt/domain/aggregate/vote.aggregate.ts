import { BaseDomainAggregate } from "@/shared/domain/base-aggregate";
import { type Id, type IdInput, idSchema, newId } from "@/shared/core/id";
import {
  type VoteAggregateProps,
  type VoteAggregatePropsInput,
  type VoteType,
  voteAggregatePropsSchema,
} from "@/module/prompt/domain/aggregate/vote.props";

export class VoteAggregate extends BaseDomainAggregate<VoteAggregateProps> {
  constructor(id: IdInput, props: VoteAggregatePropsInput) {
    super(idSchema.parse(id), voteAggregatePropsSchema.parse(props));
  }

  static new(promptId: Id, userId: string, voteType: VoteType): VoteAggregate {
    const now = new Date();
    return new VoteAggregate(newId(), {
      promptId,
      userId,
      voteType,
      createdAt: now,
      updatedAt: now,
    });
  }

  changeVoteType(newVoteType: VoteType): void {
    (this.props as { voteType: VoteType }).voteType = newVoteType;
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }
}
