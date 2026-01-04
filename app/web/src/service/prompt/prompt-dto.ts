import { z } from "zod/v4";

const promptMessageDtoSchema = z.object({
  type: z.string(),
  content: z.string(),
  order: z.number(),
});

export const promptDtoSchema = z.object({
  id: z.string(),

  title: z.string(),
  messages: promptMessageDtoSchema.array(),
});

export type PromptDto = z.infer<typeof promptDtoSchema>;
