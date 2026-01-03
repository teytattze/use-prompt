import Elysia from "elysia";
import { appConfig } from "@/lib/app-config";
import type { AppContext } from "@/lib/app-context";
import { appLogger } from "@/lib/app-logger";

export const setupAppContextMiddleware = () =>
  new Elysia().decorate("ctx", {
    config: appConfig,
    logger: appLogger,
  } as const satisfies AppContext);
