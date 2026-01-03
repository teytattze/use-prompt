import { z } from "zod/v4";

export const promptDtoSchema = z.object({
  id: z.string(),

  body: z.string(),
  title: z.string(),
});

export type PromptDto = z.infer<typeof promptDtoSchema>;
