import { z } from "zod/v4";
import type { VoteDto } from "@/module/vote/application/dto/vote.dto";
import { voteAggregatePropsSchema } from "@/module/vote/domain/aggregate/vote.props";
import type { UseCasePort } from "@/shared/port/use-case.port";

export const changeVoteInputSchema = z.object({
  promptId: voteAggregatePropsSchema.shape.promptId,
  value: voteAggregatePropsSchema.shape.value,
});
export type ChangeVoteInput = z.infer<typeof changeVoteInputSchema>;

export interface ChangeVoteUseCasePort extends UseCasePort<
  ChangeVoteInput,
  VoteDto
> {}
