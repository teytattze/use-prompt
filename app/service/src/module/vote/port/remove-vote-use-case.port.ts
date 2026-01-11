import { z } from "zod/v4";
import { voteAggregatePropsSchema } from "@/module/vote/domain/aggregate/vote.props";
import type { UseCasePort } from "@/shared/port/use-case.port";

export const removeVoteInputSchema = z.object({
  promptId: voteAggregatePropsSchema.shape.promptId,
});
export type RemoveVoteInput = z.infer<typeof removeVoteInputSchema>;

export interface RemoveVoteUseCasePort extends UseCasePort<
  RemoveVoteInput,
  void
> {}
