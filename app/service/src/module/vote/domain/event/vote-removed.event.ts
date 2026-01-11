import { z } from "zod/v4";
import { voteAggregatePropsSchema } from "@/module/vote/domain/aggregate/vote.props";
import { BaseDomainEvent } from "@/shared/domain/base-domain-event";

const voteRemovedEventPropsSchema = z.object({
  promptId: voteAggregatePropsSchema.shape.promptId,
  userId: voteAggregatePropsSchema.shape.userId,
});
type VoteRemovedEventProps = z.output<typeof voteRemovedEventPropsSchema>;

export class VoteRemovedEvent extends BaseDomainEvent<VoteRemovedEventProps> {
  /**
   * Event name constant for event bus routing.
   */
  static readonly eventName = "vote.removed" as const;

  get promptId(): string {
    return this.props.promptId;
  }

  get userId(): string {
    return this.props.userId;
  }
}
