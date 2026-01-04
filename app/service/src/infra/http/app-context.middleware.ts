import Elysia from "elysia";
import { appConfig } from "@/shared/core/app-config";
import { createAppContext } from "@/shared/core/app-context";
import { appLogger } from "@/shared/core/app-logger";

export const setupAppContextMiddleware = () =>
  new Elysia().decorate(
    "ctx",
    createAppContext({
      config: appConfig,
      logger: appLogger,
    }),
  );
