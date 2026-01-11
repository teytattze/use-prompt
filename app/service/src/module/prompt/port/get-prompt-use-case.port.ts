import { z } from "zod/v4";
import type { PromptWithAuthorDto } from "@/module/prompt/application/dto/prompt.dto";
import type { UseCasePort } from "@/shared/port/use-case.port";

export const getPromptInputSchema = z.object({
  promptId: z.string().min(1),
});

export type GetPromptInput = z.infer<typeof getPromptInputSchema>;

export interface GetPromptUseCasePort extends UseCasePort<
  GetPromptInput,
  PromptWithAuthorDto
> {}
