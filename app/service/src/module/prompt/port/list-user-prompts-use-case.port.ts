import { z } from "zod/v4";
import type { PaginatedPromptsDto } from "@/module/prompt/application/dto/prompt.dto";
import type { UseCasePort } from "@/shared/port/use-case.port";

export const listUserPromptsInputSchema = z.object({
  userId: z.string().min(1),
  includeArchived: z.boolean().default(false),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

export type ListUserPromptsInput = z.infer<typeof listUserPromptsInputSchema>;

export interface ListUserPromptsUseCasePort extends UseCasePort<
  ListUserPromptsInput,
  PaginatedPromptsDto
> {}
