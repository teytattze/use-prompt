import { z } from "zod/v4";
import { idSchema } from "@/shared/core/id";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt.props";

export const promptDtoSchema = z.object({
  id: idSchema,
  title: promptAggregatePropsSchema.shape.title,
  messages: promptAggregatePropsSchema.shape.messages,
});

export type PromptDto = z.output<typeof promptDtoSchema>;
