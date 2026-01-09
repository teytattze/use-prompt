import { z } from "zod/v4";
import type { UseCasePort } from "@/shared/port/use-case.port";
import { idSchema } from "@/shared/core/id";
import type { VoteResultDto } from "@/module/prompt/application/dto/vote-result.dto";

export const removeVoteInputSchema = z.object({
  promptId: idSchema,
});
export type RemoveVoteInput = z.infer<typeof removeVoteInputSchema>;

export interface RemoveVoteUseCasePort
  extends UseCasePort<RemoveVoteInput, VoteResultDto> {}
