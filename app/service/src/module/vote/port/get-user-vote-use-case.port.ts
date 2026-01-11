import { z } from "zod/v4";
import type { VoteDto } from "@/module/vote/application/dto/vote.dto";
import { voteAggregatePropsSchema } from "@/module/vote/domain/aggregate/vote.props";
import type { UseCasePort } from "@/shared/port/use-case.port";

export const getUserVoteInputSchema = z.object({
  promptId: voteAggregatePropsSchema.shape.promptId,
});
export type GetUserVoteInput = z.infer<typeof getUserVoteInputSchema>;

export interface GetUserVoteUseCasePort extends UseCasePort<
  GetUserVoteInput,
  VoteDto | null
> {}
