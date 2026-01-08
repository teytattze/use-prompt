import { BaseDomainAggregate } from "@/shared/domain/base-aggregate";
import { type IdInput, idSchema, newId } from "@/shared/core/id";
import {
  type PromptAggregateProps,
  type PromptAggregatePropsInput,
  promptAggregatePropsSchema,
} from "@/module/prompt/domain/aggregate/prompt.props";
import { PromptCreatedEvent } from "@/module/prompt/domain/event/prompt-created.event";

export class PromptAggregate extends BaseDomainAggregate<PromptAggregateProps> {
  constructor(id: IdInput, props: PromptAggregatePropsInput) {
    super(idSchema.parse(id), promptAggregatePropsSchema.parse(props));
  }

  static new(props: PromptAggregatePropsInput): PromptAggregate {
    const aggregate = new PromptAggregate(newId(), props);
    const event = new PromptCreatedEvent(
      aggregate.id,
      PromptCreatedEvent.name,
      {
        title: aggregate.props.title,
        description: aggregate.props.description,
        messages: aggregate.props.messages,
      },
    );
    aggregate.addEvent(event);
    return aggregate;
  }
}
