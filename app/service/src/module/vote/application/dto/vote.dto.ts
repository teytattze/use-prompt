import { z } from "zod/v4";
import { voteAggregatePropsSchema } from "@/module/vote/domain/aggregate/vote.props";

export const voteDtoSchema = z.object({
  promptId: voteAggregatePropsSchema.shape.promptId,
  value: voteAggregatePropsSchema.shape.value,
  createdAt: voteAggregatePropsSchema.shape.createdAt,
  updatedAt: voteAggregatePropsSchema.shape.updatedAt,
});

export type VoteDto = z.output<typeof voteDtoSchema>;

/**
 * Simplified DTO containing only the vote value.
 * Used when vote is embedded in prompt response.
 */
export const voteValueDtoSchema = z.object({
  value: voteAggregatePropsSchema.shape.value,
});

export type VoteValueDto = z.output<typeof voteValueDtoSchema>;
