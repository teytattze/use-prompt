import { z } from "zod/v4";
import type { UseCasePort } from "@/shared/port/use-case.port";
import type { PromptDto } from "@/module/prompt/application/dto/prompt.dto";

export const searchPromptsInputSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type SearchPromptsInput = z.infer<typeof searchPromptsInputSchema>;

export type SearchPromptsOutput = {
  prompts: PromptDto[];
  total: number;
};

export interface SearchPromptsUseCasePort
  extends UseCasePort<SearchPromptsInput, SearchPromptsOutput> {}
