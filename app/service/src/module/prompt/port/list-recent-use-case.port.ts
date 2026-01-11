import { z } from "zod/v4";
import type { PaginatedPromptsDto } from "@/module/prompt/application/dto/prompt.dto";
import { categorySchema } from "@/module/prompt/domain/value-object/category.value-object";
import type { UseCasePort } from "@/shared/port/use-case.port";

export const listRecentInputSchema = z.object({
  category: categorySchema.optional(),
  tags: z.array(z.string()).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListRecentInput = z.infer<typeof listRecentInputSchema>;

export type ListRecentOutput = PaginatedPromptsDto;

export interface ListRecentUseCasePort extends UseCasePort<
  ListRecentInput,
  ListRecentOutput
> {}
