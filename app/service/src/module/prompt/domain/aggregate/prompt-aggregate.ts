import { BaseAggregate } from "@/lib/domain/base-aggregate";
import { type IdInput, idSchema, newId } from "@/lib/id";
import {
  type PromptAggregateProps,
  type PromptAggregatePropsInput,
  promptAggregatePropsSchema,
} from "@/module/prompt/domain/aggregate/prompt-aggregate-props";
import { PromptCreatedEvent } from "@/module/prompt/domain/event/prompt-created-event";

export class PromptAggregate extends BaseAggregate<PromptAggregateProps> {
  constructor(id: IdInput, props: PromptAggregatePropsInput) {
    super(idSchema.parse(id), promptAggregatePropsSchema.parse(props));
  }

  static new(props: PromptAggregatePropsInput): PromptAggregate {
    const aggregate = new PromptAggregate(newId(), props);
    const event = new PromptCreatedEvent(aggregate.id, {
      title: aggregate.props.title,
      messages: aggregate.props.messages,
    });
    aggregate.addEvent(event);
    return aggregate;
  }
}
