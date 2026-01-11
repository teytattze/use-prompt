import { z } from "zod/v4";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt.props";
import { idSchema } from "@/shared/core/id";

/**
 * Basic prompt DTO schema.
 */
export const promptDtoSchema = z.object({
  id: idSchema,
  title: promptAggregatePropsSchema.shape.title,
  description: promptAggregatePropsSchema.shape.description,
  messages: promptAggregatePropsSchema.shape.messages,
  // New fields for sharing platform
  authorId: promptAggregatePropsSchema.shape.authorId,
  category: promptAggregatePropsSchema.shape.category,
  tags: promptAggregatePropsSchema.shape.tags,
  aura: z.number().default(0), // Computed from votes
  createdAt: z.string(), // ISO date string
  archivedAt: z.string().nullable(), // ISO date string or null
});

export type PromptDto = z.output<typeof promptDtoSchema>;

/**
 * Prompt DTO with author info and viewer's vote (for detailed view).
 */
export const promptWithAuthorDtoSchema = promptDtoSchema.extend({
  author: z.object({
    id: z.string(),
    userAura: z.number(),
  }),
  viewerVote: z
    .object({
      value: z.union([z.literal(1), z.literal(-1)]),
    })
    .nullable(),
});

export type PromptWithAuthorDto = z.output<typeof promptWithAuthorDtoSchema>;

/**
 * Prompt summary DTO (for list views - excludes full content).
 */
export const promptSummaryDtoSchema = z.object({
  id: idSchema,
  authorId: promptAggregatePropsSchema.shape.authorId,
  title: promptAggregatePropsSchema.shape.title,
  category: promptAggregatePropsSchema.shape.category,
  tags: promptAggregatePropsSchema.shape.tags,
  aura: z.number().default(0),
  createdAt: z.string(), // ISO date string
});

export type PromptSummaryDto = z.output<typeof promptSummaryDtoSchema>;

/**
 * Paginated prompts response.
 */
export type PaginatedPromptsDto = {
  items: PromptSummaryDto[];
  cursor: string | null;
  hasMore: boolean;
};
