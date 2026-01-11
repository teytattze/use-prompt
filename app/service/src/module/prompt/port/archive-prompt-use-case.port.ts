import { z } from "zod/v4";
import type { UseCasePort } from "@/shared/port/use-case.port";

export const archivePromptInputSchema = z.object({
  promptId: z.string().min(1),
});

export type ArchivePromptInput = z.infer<typeof archivePromptInputSchema>;

export type ArchivePromptOutput = {
  id: string;
  archivedAt: string;
};

export interface ArchivePromptUseCasePort extends UseCasePort<
  ArchivePromptInput,
  ArchivePromptOutput
> {}
