import Elysia from "elysia";
import { AppError } from "@/shared/core/app-error";
import { HttpEnvelope } from "@/shared/http/http-envelope";

export const setupErrorHandlerMiddleware = () =>
  new Elysia({ name: "error-handler" }).onError(
    { as: "global" },
    ({ error }) => {
      return HttpEnvelope.error(AppError.from(error)).toJson();
    },
  );
