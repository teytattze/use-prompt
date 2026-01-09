import { z } from "zod/v4";
import type { UseCasePort } from "@/shared/port/use-case.port";
import { idSchema } from "@/shared/core/id";

export const recordPromptUsageInputSchema = z.object({
  promptId: idSchema,
});
export type RecordPromptUsageInput = z.infer<
  typeof recordPromptUsageInputSchema
>;

export type RecordPromptUsageOutput = {
  usedCount: number;
};

export interface RecordPromptUsageUseCasePort
  extends UseCasePort<RecordPromptUsageInput, RecordPromptUsageOutput> {}
