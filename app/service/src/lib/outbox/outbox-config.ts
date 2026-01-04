import { z } from "zod/v4";

export const outboxConfigSchema = z.object({
  pollingIntervalMs: z.number().min(100).max(60000).default(1000),
  batchSize: z.number().min(1).max(100).default(10),
  maxRetries: z.number().min(0).max(10).default(3),
});

export type OutboxConfig = z.output<typeof outboxConfigSchema>;
