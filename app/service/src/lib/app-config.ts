import { z } from "zod/v4";

export const appConfigSchema = z.object({
  app: z.object({
    env: z.string(),
    version: z.string(),
  }),

  mongo: z.object({
    uri: z.string(),
  }),
});

export type AppConfig = z.output<typeof appConfigSchema>;

export const appConfig = appConfigSchema.decode({
  app: {
    env: "local",
    version: "0.0.0",
  },

  mongo: {
    uri: "mongodb://root:password@localhost:27017",
  },
});
