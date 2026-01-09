import { z } from "zod/v4";
import { idSchema } from "@/shared/core/id";
import { VoteType } from "@/module/prompt/domain/aggregate/vote.props";

export const voteResultDtoSchema = z.object({
  promptId: idSchema,
  userVote: z.enum([VoteType.UP, VoteType.DOWN]).nullable(),
  upvotes: z.number().int().nonnegative(),
  downvotes: z.number().int().nonnegative(),
  voteCount: z.number().int(),
});

export type VoteResultDto = z.output<typeof voteResultDtoSchema>;
