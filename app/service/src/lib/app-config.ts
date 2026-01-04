import { z } from "zod/v4";
import { outboxConfigSchema } from "@/lib/outbox/outbox-config";

export const appConfigSchema = z.object({
  app: z.object({
    env: z.string(),
    version: z.string(),
  }),

  mongo: z.object({
    uri: z.string(),
    transactionTimeoutMs: z.number().min(1000).max(60000).default(30000),
  }),

  outbox: outboxConfigSchema,
});

export type AppConfig = z.output<typeof appConfigSchema>;

export const appConfig = appConfigSchema.parse({
  app: {
    env: process.env.APP_ENV ?? "local",
    version: process.env.APP_VERSION ?? "0.0.0",
  },

  mongo: {
    uri: process.env.MONGO_URI,
    transactionTimeoutMs: process.env.MONGO_TRANSACTION_TIMEOUT_MS ?? 30000,
  },

  outbox: {
    pollingIntervalMs: process.env.OUTBOX_POLLING_INTERVAL_MS
      ? parseInt(process.env.OUTBOX_POLLING_INTERVAL_MS, 10)
      : undefined,
    batchSize: process.env.OUTBOX_BATCH_SIZE
      ? parseInt(process.env.OUTBOX_BATCH_SIZE, 10)
      : undefined,
    maxRetries: process.env.OUTBOX_MAX_RETRIES
      ? parseInt(process.env.OUTBOX_MAX_RETRIES, 10)
      : undefined,
  },
});
