import { z } from "zod/v4";
import type { UseCasePort } from "@/shared/port/use-case.port";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt.props";
import type { PromptDto } from "@/module/prompt/application/dto/prompt.dto";

export const createPromptInputSchema = z.object({
  title: promptAggregatePropsSchema.shape.title,
  description: promptAggregatePropsSchema.shape.description,
  messages: promptAggregatePropsSchema.shape.messages,
});
export type CreatePromptInput = z.infer<typeof createPromptInputSchema>;

export interface CreatePromptUseCasePort extends UseCasePort<
  CreatePromptInput,
  PromptDto
> {}
