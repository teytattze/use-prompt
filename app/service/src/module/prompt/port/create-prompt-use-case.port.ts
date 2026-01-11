import { z } from "zod/v4";
import type { PromptDto } from "@/module/prompt/application/dto/prompt.dto";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt.props";
import type { UseCasePort } from "@/shared/port/use-case.port";

export const createPromptInputSchema = z.object({
  title: promptAggregatePropsSchema.shape.title,
  description: promptAggregatePropsSchema.shape.description,
  messages: promptAggregatePropsSchema.shape.messages,
  category: promptAggregatePropsSchema.shape.category,
  tags: promptAggregatePropsSchema.shape.tags,
});
export type CreatePromptInput = z.infer<typeof createPromptInputSchema>;

export interface CreatePromptUseCasePort extends UseCasePort<
  CreatePromptInput,
  PromptDto
> {}
