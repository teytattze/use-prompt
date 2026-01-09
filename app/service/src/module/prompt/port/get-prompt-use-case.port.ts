import { z } from "zod/v4";
import type { UseCasePort } from "@/shared/port/use-case.port";
import { idSchema } from "@/shared/core/id";
import type { PromptDetailDto } from "@/module/prompt/application/dto/prompt-detail.dto";

export const getPromptInputSchema = z.object({
  promptId: idSchema,
});
export type GetPromptInput = z.infer<typeof getPromptInputSchema>;

export interface GetPromptUseCasePort
  extends UseCasePort<GetPromptInput, PromptDetailDto> {}
