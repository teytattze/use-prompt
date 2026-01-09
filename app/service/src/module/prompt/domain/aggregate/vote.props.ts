import { z } from "zod/v4";
import { idSchema } from "@/shared/core/id";

export const VoteType = {
  UP: "UP",
  DOWN: "DOWN",
} as const;

export type VoteType = (typeof VoteType)[keyof typeof VoteType];

export const voteAggregatePropsSchema = z.object({
  promptId: idSchema,
  userId: z.string().min(1),
  voteType: z.enum([VoteType.UP, VoteType.DOWN]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

type VoteAggregatePropsSchema = typeof voteAggregatePropsSchema;
export type VoteAggregatePropsInput = z.input<VoteAggregatePropsSchema>;
export type VoteAggregateProps = z.output<VoteAggregatePropsSchema>;
