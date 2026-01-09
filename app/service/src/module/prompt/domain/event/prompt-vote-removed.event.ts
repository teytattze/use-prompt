import { z } from "zod/v4";
import { BaseDomainEvent } from "@/shared/domain/base-domain-event";
import { idSchema } from "@/shared/core/id";
import { VoteType } from "@/module/prompt/domain/aggregate/vote.props";

const promptVoteRemovedEventPropsSchema = z.object({
  promptId: idSchema,
  userId: z.string(),
  previousVoteType: z.enum([VoteType.UP, VoteType.DOWN]),
});
type PromptVoteRemovedEventProps = z.output<
  typeof promptVoteRemovedEventPropsSchema
>;

export class PromptVoteRemovedEvent extends BaseDomainEvent<PromptVoteRemovedEventProps> {}
