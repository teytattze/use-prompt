import openapi, { fromTypes } from "@elysiajs/openapi";
import Elysia from "elysia";
import {
  outboxFacade,
  promptHttpRouterV1,
} from "@/module/prompt/adapter/inbound/http/api";

const app = new Elysia();

app
  .use(openapi({ references: fromTypes() }))
  .use(promptHttpRouterV1)
  .listen(3000);

outboxFacade.start();

const shutdown = async () => {
  console.log("Shutting down...");
  await outboxFacade.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
