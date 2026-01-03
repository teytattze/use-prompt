import type { ClientSession } from "mongodb";
import type { AppConfig } from "@/lib/app-config";
import type { AppLogger } from "@/lib/app-logger";

export type AppContext = {
  config: AppConfig;
  logger: AppLogger;
  db: {
    session?: ClientSession;
  };
};

export function withSession(ctx: AppContext, session: ClientSession) {
  return { ...ctx, db: { ...ctx.db, session } } as const satisfies AppContext;
}

export function createAppContext({
  config,
  logger,
}: {
  config: AppConfig;
  logger: AppLogger;
}) {
  return { config, logger, db: {} } as const satisfies AppContext;
}
