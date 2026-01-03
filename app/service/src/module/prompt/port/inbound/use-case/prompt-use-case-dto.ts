import { z } from "zod/v4";
import { idSchema } from "@/lib/id";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt-aggregate-props";

export const promptUseCaseDtoSchema = z.object({
  id: idSchema,
  title: promptAggregatePropsSchema.shape.title,
  messages: promptAggregatePropsSchema.shape.messages,
});

export type PromptUseCaseDto = z.output<typeof promptUseCaseDtoSchema>;
