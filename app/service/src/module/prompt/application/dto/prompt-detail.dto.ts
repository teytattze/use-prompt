import { z } from "zod/v4";
import { idSchema } from "@/shared/core/id";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt.props";
import { VoteType } from "@/module/prompt/domain/aggregate/vote.props";

export const promptDetailDtoSchema = z.object({
  id: idSchema,
  title: promptAggregatePropsSchema.shape.title,
  description: promptAggregatePropsSchema.shape.description,
  messages: promptAggregatePropsSchema.shape.messages,
  upvotes: z.number().int().nonnegative(),
  downvotes: z.number().int().nonnegative(),
  voteCount: z.number().int(),
  usedCount: z.number().int().nonnegative(),
  userVote: z.enum([VoteType.UP, VoteType.DOWN]).nullable(),
});

export type PromptDetailDto = z.output<typeof promptDetailDtoSchema>;
