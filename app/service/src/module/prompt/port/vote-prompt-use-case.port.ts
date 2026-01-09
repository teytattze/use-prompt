import { z } from "zod/v4";
import type { UseCasePort } from "@/shared/port/use-case.port";
import { idSchema } from "@/shared/core/id";
import { VoteType } from "@/module/prompt/domain/aggregate/vote.props";
import type { VoteResultDto } from "@/module/prompt/application/dto/vote-result.dto";

export const votePromptInputSchema = z.object({
  promptId: idSchema,
  voteType: z.enum([VoteType.UP, VoteType.DOWN]),
});
export type VotePromptInput = z.infer<typeof votePromptInputSchema>;

export interface VotePromptUseCasePort
  extends UseCasePort<VotePromptInput, VoteResultDto> {}
