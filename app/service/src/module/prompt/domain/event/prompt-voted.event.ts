import { z } from "zod/v4";
import { BaseDomainEvent } from "@/shared/domain/base-domain-event";
import { idSchema } from "@/shared/core/id";
import { VoteType } from "@/module/prompt/domain/aggregate/vote.props";

const promptVotedEventPropsSchema = z.object({
  promptId: idSchema,
  userId: z.string(),
  voteType: z.enum([VoteType.UP, VoteType.DOWN]),
  previousVoteType: z.enum([VoteType.UP, VoteType.DOWN]).nullable(),
});
type PromptVotedEventProps = z.output<typeof promptVotedEventPropsSchema>;

export class PromptVotedEvent extends BaseDomainEvent<PromptVotedEventProps> {}
