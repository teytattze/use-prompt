import { z } from "zod/v4";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt.props";
import { BaseDomainEvent } from "@/shared/domain/base-domain-event";

const promptCreatedEventPropsSchema = z.object({
  authorId: promptAggregatePropsSchema.shape.authorId,
  title: promptAggregatePropsSchema.shape.title,
  description: promptAggregatePropsSchema.shape.description,
  category: promptAggregatePropsSchema.shape.category,
  messages: promptAggregatePropsSchema.shape.messages,
});
type PromptCreatedEventProps = z.output<typeof promptCreatedEventPropsSchema>;

export class PromptCreatedEvent extends BaseDomainEvent<PromptCreatedEventProps> {
  /**
   * Event name constant for event bus routing.
   */
  static readonly eventName = "prompt.created" as const;

  get authorId(): string {
    return this.props.authorId;
  }

  get title(): string {
    return this.props.title;
  }

  get category() {
    return this.props.category;
  }
}
