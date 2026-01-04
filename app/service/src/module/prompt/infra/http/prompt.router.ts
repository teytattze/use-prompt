import { Elysia } from "elysia";
import { HttpEnvelope } from "@/shared/http/http-envelope";
import { setupAppContextMiddleware } from "@/infra/http/app-context.middleware";
import {
  type CreatePromptUseCasePort,
  createPromptInputSchema,
} from "@/module/prompt/port/create-prompt-use-case.port";
import type { ListPromptsUseCasePort } from "@/module/prompt/port/list-prompts-use-case.port";

export class PromptRouter {
  #createPromptUseCase: CreatePromptUseCasePort;
  #listPromptsUseCase: ListPromptsUseCasePort;

  constructor(
    createPromptUseCase: CreatePromptUseCasePort,
    listPromptsUseCase: ListPromptsUseCasePort,
  ) {
    this.#createPromptUseCase = createPromptUseCase;
    this.#listPromptsUseCase = listPromptsUseCase;
  }

  make() {
    return new Elysia({ name: "prompt-router-v1", prefix: "/api/v1/prompt" })
      .use(setupAppContextMiddleware())
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
      );
  }
}
