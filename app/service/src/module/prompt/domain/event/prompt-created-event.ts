import { z } from "zod/v4";
import { BaseEvent } from "@/lib/domain/base-event";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt-aggregate-props";

const promptCreatedEventPropsSchema = z.object({
  title: promptAggregatePropsSchema.shape.title,
  messages: promptAggregatePropsSchema.shape.messages,
});
type PromptCreatedEventProps = z.output<typeof promptCreatedEventPropsSchema>;

export class PromptCreatedEvent extends BaseEvent<PromptCreatedEventProps> {}
