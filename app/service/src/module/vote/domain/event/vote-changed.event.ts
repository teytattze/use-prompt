import { z } from "zod/v4";
import { voteAggregatePropsSchema } from "@/module/vote/domain/aggregate/vote.props";
import { BaseDomainEvent } from "@/shared/domain/base-domain-event";

const voteChangedEventPropsSchema = z.object({
  promptId: voteAggregatePropsSchema.shape.promptId,
  userId: voteAggregatePropsSchema.shape.userId,
  oldValue: voteAggregatePropsSchema.shape.value,
  newValue: voteAggregatePropsSchema.shape.value,
});
type VoteChangedEventProps = z.output<typeof voteChangedEventPropsSchema>;

export class VoteChangedEvent extends BaseDomainEvent<VoteChangedEventProps> {
  /**
   * Event name constant for event bus routing.
   */
  static readonly eventName = "vote.changed" as const;

  get promptId(): string {
    return this.props.promptId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get oldValue(): 1 | -1 {
    return this.props.oldValue;
  }

  get newValue(): 1 | -1 {
    return this.props.newValue;
  }
}
