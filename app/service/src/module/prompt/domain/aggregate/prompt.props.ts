import { z } from "zod/v4";
import { messageEntityPropsSchema } from "@/module/prompt/domain/entity/message.props";

export const promptAggregatePropsSchema = z.object({
  title: z.string().min(1).max(100).brand<"title">(),
  description: z.string().max(500).optional().brand<"description">(),
  messages: z.array(messageEntityPropsSchema.brand<"message">()).min(1),
});

type PromptAggregatePropsSchema = typeof promptAggregatePropsSchema;
export type PromptAggregatePropsInput = z.input<PromptAggregatePropsSchema>;
export type PromptAggregateProps = z.output<PromptAggregatePropsSchema>;
