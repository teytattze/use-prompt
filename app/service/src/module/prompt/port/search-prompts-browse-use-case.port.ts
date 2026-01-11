import { z } from "zod/v4";
import type { PromptSummaryDto } from "@/module/prompt/application/dto/prompt.dto";
import { categorySchema } from "@/module/prompt/domain/value-object/category.value-object";
import type { UseCasePort } from "@/shared/port/use-case.port";

export const searchPromptsBrowseInputSchema = z.object({
  query: z.string().min(1).max(200),
  category: categorySchema.optional(),
  tags: z.array(z.string()).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SearchPromptsBrowseInput = z.infer<
  typeof searchPromptsBrowseInputSchema
>;

export type SearchPromptsBrowseOutput = {
  items: PromptSummaryDto[];
  cursor: string | null;
  hasMore: boolean;
  facets: {
    categories: Record<string, number>;
    tags: Record<string, number>;
  };
};

export interface SearchPromptsBrowseUseCasePort extends UseCasePort<
  SearchPromptsBrowseInput,
  SearchPromptsBrowseOutput
> {}
