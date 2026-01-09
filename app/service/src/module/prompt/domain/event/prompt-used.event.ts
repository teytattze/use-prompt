import { z } from "zod/v4";
import { BaseDomainEvent } from "@/shared/domain/base-domain-event";
import { idSchema } from "@/shared/core/id";

const promptUsedEventPropsSchema = z.object({
  promptId: idSchema,
  userId: z.string().nullable(),
  usedAt: z.date(),
});
type PromptUsedEventProps = z.output<typeof promptUsedEventPropsSchema>;

export class PromptUsedEvent extends BaseDomainEvent<PromptUsedEventProps> {}
