import Elysia from "elysia";
import { appConfig } from "@/lib/app-config";
import { createAppContext } from "@/lib/app-context";
import { appLogger } from "@/lib/app-logger";

export const setupAppContextMiddleware = () =>
  new Elysia().decorate(
    "ctx",
    createAppContext({
      config: appConfig,
      logger: appLogger,
    }),
  );
