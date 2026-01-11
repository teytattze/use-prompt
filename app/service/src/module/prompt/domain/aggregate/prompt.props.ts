import { z } from "zod/v4";
import { messageEntityPropsSchema } from "@/module/prompt/domain/entity/message.props";
import { categorySchema } from "@/module/prompt/domain/value-object/category.value-object";
import { tagsArraySchema } from "@/module/prompt/domain/value-object/tag.value-object";

export const promptAggregatePropsSchema = z.object({
  // Existing fields
  title: z.string().min(1).max(200).brand<"title">(),
  description: z.string().min(1).max(500).brand<"description">(),
  messages: z.array(messageEntityPropsSchema.brand<"message">()).min(1),

  // New fields for sharing platform
  authorId: z.string().min(1).brand<"UserId">(),
  category: categorySchema,
  tags: tagsArraySchema,
  createdAt: z.date().default(() => new Date()),
  archivedAt: z.date().nullable().default(null),
});

type PromptAggregatePropsSchema = typeof promptAggregatePropsSchema;
export type PromptAggregatePropsInput = z.input<PromptAggregatePropsSchema>;
export type PromptAggregateProps = z.output<PromptAggregatePropsSchema>;
