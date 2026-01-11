import { z } from "zod/v4";

/**
 * Vote value: +1 for upvote, -1 for downvote
 */
export const voteValueSchema = z.union([z.literal(1), z.literal(-1)]);
export type VoteValue = z.infer<typeof voteValueSchema>;

/**
 * Vote aggregate props schema
 */
export const voteAggregatePropsSchema = z.object({
  promptId: z.string().min(1).brand<"PromptId">(),
  userId: z.string().min(1).brand<"UserId">(), // Clerk user ID
  value: voteValueSchema,
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

type VoteAggregatePropsSchema = typeof voteAggregatePropsSchema;
export type VoteAggregatePropsInput = z.input<VoteAggregatePropsSchema>;
export type VoteAggregateProps = z.output<VoteAggregatePropsSchema>;
