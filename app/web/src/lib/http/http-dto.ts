import { z } from "zod/v4";

export const httpEnvelopeSchema = z.object({
  status: z.number(),
  code: z.string(),
  message: z.string(),
  data: z.any(),
});

export type HttpEnvelope<T> = Omit<
  z.infer<typeof httpEnvelopeSchema>,
  "data"
> & { data: T };
