import openapi, { fromTypes } from "@elysiajs/openapi";
import Elysia from "elysia";
import { z } from "zod/v4";
import {
  promptHttpRouterV1,
  userPromptsHttpRouterV1,
  voteHttpRouterV1,
} from "@/composition/api.composition";
import { setupErrorHandlerMiddleware } from "@/infra/http/error-handler.middleware";
import { appConfig } from "@/shared/core/app-config";

const app = new Elysia();

app
  .use(
    openapi({
      mapJsonSchema: {
        zod: z.toJSONSchema,
      },
      references: fromTypes(
        appConfig.app.env === "production" ? "dist/api.d.ts" : "src/api.ts",
      ),
    }),
  )
  .use(setupErrorHandlerMiddleware)
  .use(promptHttpRouterV1)
  .use(voteHttpRouterV1)
  .use(userPromptsHttpRouterV1)
  .listen(8000);
