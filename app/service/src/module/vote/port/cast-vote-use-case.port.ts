import { z } from "zod/v4";
import type { VoteDto } from "@/module/vote/application/dto/vote.dto";
import { voteAggregatePropsSchema } from "@/module/vote/domain/aggregate/vote.props";
import type { UseCasePort } from "@/shared/port/use-case.port";

export const castVoteInputSchema = z.object({
  promptId: voteAggregatePropsSchema.shape.promptId,
  value: voteAggregatePropsSchema.shape.value,
});
export type CastVoteInput = z.infer<typeof castVoteInputSchema>;

export interface CastVoteUseCasePort extends UseCasePort<
  CastVoteInput,
  VoteDto
> {}
