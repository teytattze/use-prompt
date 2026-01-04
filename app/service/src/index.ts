import openapi, { fromTypes } from "@elysiajs/openapi";
import Elysia from "elysia";
import { promptHttpRouterV1 } from "@/module/prompt/adapter/inbound/http/api";

const app = new Elysia();

app
  .use(openapi({ references: fromTypes() }))
  .use(promptHttpRouterV1)
  .listen(3000);
