import { Elysia } from "elysia";
import { setupAppContextMiddleware } from "@/infra/http/app-context.middleware";
import { setupAuthGuardMiddleware } from "@/infra/http/auth-guard.middleware";
import {
  type CreatePromptUseCasePort,
  createPromptInputSchema,
} from "@/module/prompt/port/create-prompt-use-case.port";
import type { ListPromptsUseCasePort } from "@/module/prompt/port/list-prompts-use-case.port";
import {
  type SearchPromptsUseCasePort,
  searchPromptsInputSchema,
} from "@/module/prompt/port/search-prompts-use-case.port";
import { HttpEnvelope } from "@/shared/http/http-envelope";

export class PromptRouter {
  #createPromptUseCase: CreatePromptUseCasePort;
  #listPromptsUseCase: ListPromptsUseCasePort;
  #searchPromptsUseCase: SearchPromptsUseCasePort;

  constructor(
    createPromptUseCase: CreatePromptUseCasePort,
    listPromptsUseCase: ListPromptsUseCasePort,
    searchPromptsUseCase: SearchPromptsUseCasePort,
  ) {
    this.#createPromptUseCase = createPromptUseCase;
    this.#listPromptsUseCase = listPromptsUseCase;
    this.#searchPromptsUseCase = searchPromptsUseCase;
  }

  make() {
    return new Elysia({ name: "prompt-router-v1", prefix: "/api/v1/prompt" })
      .use(setupAppContextMiddleware())
      .use(setupAuthGuardMiddleware())
      .get("/", async ({ ctx }) => {
        const result = await this.#listPromptsUseCase.execute(ctx, undefined);
        if (result.isErr()) {
          return HttpEnvelope.error(result.error).toJson();
        }
        return HttpEnvelope.ok({ data: result.value }).toJson();
      })
      .post(
        "/",
        async ({ body, ctx }) => {
          const result = await this.#createPromptUseCase.execute(ctx, body);
          if (result.isErr()) {
            return HttpEnvelope.error(result.error).toJson();
          }
          return HttpEnvelope.ok({ data: result.value }).toJson();
        },
        { body: createPromptInputSchema },
      )
      .get(
        "/search",
        async ({ query, ctx }) => {
          const result = await this.#searchPromptsUseCase.execute(ctx, query);
          if (result.isErr()) {
            return HttpEnvelope.error(result.error).toJson();
          }
          return HttpEnvelope.ok({ data: result.value }).toJson();
        },
        { query: searchPromptsInputSchema },
      );
  }
}
