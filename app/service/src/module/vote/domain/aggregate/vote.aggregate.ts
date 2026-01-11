import {
  type VoteAggregateProps,
  type VoteAggregatePropsInput,
  type VoteValue,
  voteAggregatePropsSchema,
} from "@/module/vote/domain/aggregate/vote.props";
import { VoteCastEvent } from "@/module/vote/domain/event/vote-cast.event";
import { VoteChangedEvent } from "@/module/vote/domain/event/vote-changed.event";
import { VoteRemovedEvent } from "@/module/vote/domain/event/vote-removed.event";
import { type IdInput, idSchema, newId } from "@/shared/core/id";
import { BaseDomainAggregate } from "@/shared/domain/base-aggregate";

export class VoteAggregate extends BaseDomainAggregate<VoteAggregateProps> {
  constructor(id: IdInput, props: VoteAggregatePropsInput) {
    super(idSchema.parse(id), voteAggregatePropsSchema.parse(props));
  }

  // Getters
  get promptId(): string {
    return this.props.promptId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get value(): VoteValue {
    return this.props.value;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Changes the vote value from +1 to -1 or vice versa.
   * Emits a VoteChangedEvent on successful change.
   * Idempotent: calling with the same value is a no-op.
   */
  changeValue(newValue: VoteValue): void {
    if (this.props.value === newValue) {
      // Same value, no-op (idempotent)
      return;
    }

    const oldValue = this.props.value;
    this.props.value = newValue;
    this.props.updatedAt = new Date();

    const event = new VoteChangedEvent(this.id, VoteChangedEvent.eventName, {
      promptId: this.props.promptId,
      userId: this.props.userId,
      oldValue,
      newValue,
    });
    this.addEvent(event);
  }

  /**
   * Marks the vote for removal by emitting a VoteRemovedEvent.
   * Should be called before deleting the vote from persistence.
   */
  markForRemoval(): void {
    const event = new VoteRemovedEvent(this.id, VoteRemovedEvent.eventName, {
      promptId: this.props.promptId,
      userId: this.props.userId,
    });
    this.addEvent(event);
  }

  /**
   * Creates a new vote.
   * Emits a VoteCastEvent.
   */
  static cast(props: {
    promptId: string;
    userId: string;
    value: VoteValue;
  }): VoteAggregate {
    const aggregate = new VoteAggregate(newId(), {
      promptId: props.promptId,
      userId: props.userId,
      value: props.value,
    });

    const event = new VoteCastEvent(aggregate.id, VoteCastEvent.eventName, {
      promptId: aggregate.props.promptId,
      userId: aggregate.props.userId,
      value: aggregate.props.value,
    });
    aggregate.addEvent(event);

    return aggregate;
  }

  /**
   * Reconstitutes a VoteAggregate from persisted data.
   * Does not emit domain events (already occurred).
   */
  static reconstitute(
    id: IdInput,
    props: VoteAggregatePropsInput,
  ): VoteAggregate {
    return new VoteAggregate(id, props);
  }
}
