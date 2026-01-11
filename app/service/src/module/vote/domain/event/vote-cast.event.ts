import { z } from "zod/v4";
import { voteAggregatePropsSchema } from "@/module/vote/domain/aggregate/vote.props";
import { BaseDomainEvent } from "@/shared/domain/base-domain-event";

const voteCastEventPropsSchema = z.object({
  promptId: voteAggregatePropsSchema.shape.promptId,
  userId: voteAggregatePropsSchema.shape.userId,
  value: voteAggregatePropsSchema.shape.value,
});
type VoteCastEventProps = z.output<typeof voteCastEventPropsSchema>;

export class VoteCastEvent extends BaseDomainEvent<VoteCastEventProps> {
  /**
   * Event name constant for event bus routing.
   */
  static readonly eventName = "vote.cast" as const;

  get promptId(): string {
    return this.props.promptId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get value(): 1 | -1 {
    return this.props.value;
  }
}
