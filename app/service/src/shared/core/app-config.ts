import { z } from "zod/v4";

export const appConfigSchema = z.object({
  app: z.object({
    env: z.string().default("local"),
    version: z.string().default("0.0.0"),
  }),

  mongo: z.object({
    uri: z.string().default("mongodb://localhost:27017/"),
    transactionTimeoutMs: z.coerce.number().min(1000).max(60000).default(30000),
  }),

  clerk: z.object({
    jwksUrl: z
      .string()
      .default(
        "https://united-raptor-76.clerk.accounts.dev/.well-known/jwks.json",
      ),
    issuer: z.string().default("https://united-raptor-76.clerk.accounts.dev"),
  }),
});

export type AppConfig = z.output<typeof appConfigSchema>;

export const appConfig = appConfigSchema.parse({
  app: {
    env: process.env.APP_ENV,
    version: process.env.APP_VERSION,
  },

  mongo: {
    uri: process.env.MONGO_URI,
    transactionTimeoutMs: process.env.MONGO_TRANSACTION_TIMEOUT_MS,
  },

  clerk: {
    jwksUrl: process.env.CLERK_JWKS_URL,
    issuer: process.env.CLERK_ISSUER,
  },
});
