import { z } from "zod/v4";
import type { UseCasePort } from "@/lib/use-case/use-case-port";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt-aggregate-props";
import type { PromptUseCaseDto } from "@/module/prompt/port/inbound/use-case/prompt-use-case-dto";

export const createPromptUseCaseDtoSchema = z.object({
  title: promptAggregatePropsSchema.shape.title,
  messages: promptAggregatePropsSchema.shape.messages,
});
export type CreatePromptUseCaseDto = z.infer<
  typeof createPromptUseCaseDtoSchema
>;

export interface CreatePromptUseCasePort extends UseCasePort<
  CreatePromptUseCaseDto,
  PromptUseCaseDto
> {}
