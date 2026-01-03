import type { AppConfig } from "@/lib/app-config";
import type { AppLogger } from "@/lib/app-logger";

export type AppContext = {
  config: AppConfig;
  logger: AppLogger;
};
