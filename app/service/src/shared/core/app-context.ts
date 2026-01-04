import type { ClientSession } from "mongodb";
import type { AppConfig } from "@/shared/core/app-config";
import type { AppLogger } from "@/shared/core/app-logger";
import type { JwtUser } from "@/shared/core/jwt-user";

export type AppContext = {
  config: AppConfig;
  logger: AppLogger;
  db: {
    session?: ClientSession;
  };
  user?: JwtUser;
};

export function withSession(ctx: AppContext, session: ClientSession) {
  return { ...ctx, db: { ...ctx.db, session } } as const satisfies AppContext;
}

export function withUser(ctx: AppContext, user: JwtUser) {
  return { ...ctx, user } as const satisfies AppContext;
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
