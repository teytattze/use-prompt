import { z } from "zod/v4";
import { messageEntityPropsSchema } from "@/module/prompt/domain/entity/message.props";

export const promptAggregatePropsSchema = z.object({
  title: z.string().min(1).max(100).brand<"title">(),
  messages: z.array(messageEntityPropsSchema.brand<"message">()).min(1),
});

type PromptAggregatePropsSchema = typeof promptAggregatePropsSchema;
export type PromptAggregatePropsInput = z.input<PromptAggregatePropsSchema>;
export type PromptAggregateProps = z.output<PromptAggregatePropsSchema>;
