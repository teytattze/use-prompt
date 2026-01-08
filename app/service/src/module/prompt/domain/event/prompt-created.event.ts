import { z } from "zod/v4";
import { BaseDomainEvent } from "@/shared/domain/base-domain-event";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt.props";

const promptCreatedEventPropsSchema = z.object({
  title: promptAggregatePropsSchema.shape.title,
  description: promptAggregatePropsSchema.shape.description,
  messages: promptAggregatePropsSchema.shape.messages,
});
type PromptCreatedEventProps = z.output<typeof promptCreatedEventPropsSchema>;

export class PromptCreatedEvent extends BaseDomainEvent<PromptCreatedEventProps> {}
