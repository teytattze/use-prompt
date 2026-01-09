import { Elysia, t } from "elysia";
import { setupAppContextMiddleware } from "@/infra/http/app-context.middleware";
import { setupAuthGuardMiddleware } from "@/infra/http/auth-guard.middleware";
import { idSchema } from "@/shared/core/id";
import { AppError } from "@/shared/core/app-error";
import {
  type CreatePromptUseCasePort,
  createPromptInputSchema,
} from "@/module/prompt/port/create-prompt-use-case.port";
import type { ListPromptsUseCasePort } from "@/module/prompt/port/list-prompts-use-case.port";
import {
  type SearchPromptsUseCasePort,
  searchPromptsInputSchema,
} from "@/module/prompt/port/search-prompts-use-case.port";
import type { GetPromptUseCasePort } from "@/module/prompt/port/get-prompt-use-case.port";
import type { VotePromptUseCasePort } from "@/module/prompt/port/vote-prompt-use-case.port";
import type { RemoveVoteUseCasePort } from "@/module/prompt/port/remove-vote-use-case.port";
import type { RecordPromptUsageUseCasePort } from "@/module/prompt/port/record-prompt-usage-use-case.port";
import { VoteType } from "@/module/prompt/domain/aggregate/vote.props";
import { HttpEnvelope } from "@/shared/http/http-envelope";

export class PromptRouter {
  #createPromptUseCase: CreatePromptUseCasePort;
  #listPromptsUseCase: ListPromptsUseCasePort;
  #searchPromptsUseCase: SearchPromptsUseCasePort;
  #getPromptUseCase: GetPromptUseCasePort;
  #votePromptUseCase: VotePromptUseCasePort;
  #removeVoteUseCase: RemoveVoteUseCasePort;
  #recordPromptUsageUseCase: RecordPromptUsageUseCasePort;

  constructor(
    createPromptUseCase: CreatePromptUseCasePort,
    listPromptsUseCase: ListPromptsUseCasePort,
    searchPromptsUseCase: SearchPromptsUseCasePort,
    getPromptUseCase: GetPromptUseCasePort,
    votePromptUseCase: VotePromptUseCasePort,
    removeVoteUseCase: RemoveVoteUseCasePort,
    recordPromptUsageUseCase: RecordPromptUsageUseCasePort,
  ) {
    this.#createPromptUseCase = createPromptUseCase;
    this.#listPromptsUseCase = listPromptsUseCase;
    this.#searchPromptsUseCase = searchPromptsUseCase;
    this.#getPromptUseCase = getPromptUseCase;
    this.#votePromptUseCase = votePromptUseCase;
    this.#removeVoteUseCase = removeVoteUseCase;
    this.#recordPromptUsageUseCase = recordPromptUsageUseCase;
  }

  make() {
    const authRouter = new Elysia({ name: "prompt-auth-router" })
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
      )
      .post(
        "/:id/vote",
        async ({ params, body, ctx }) => {
          const promptId = idSchema.safeParse(params.id);
          if (!promptId.success) {
            return HttpEnvelope.error(
              AppError.from("unknown", { message: "Invalid prompt ID" }),
            ).toJson();
          }
          const result = await this.#votePromptUseCase.execute(ctx, {
            promptId: promptId.data,
            voteType: body.voteType as VoteType,
          });
          if (result.isErr()) {
            return HttpEnvelope.error(result.error).toJson();
          }
          return HttpEnvelope.ok({ data: result.value }).toJson();
        },
        {
          params: t.Object({ id: t.String() }),
          body: t.Object({
            voteType: t.Union([t.Literal("UP"), t.Literal("DOWN")]),
          }),
        },
      )
      .delete(
        "/:id/vote",
        async ({ params, ctx }) => {
          const promptId = idSchema.safeParse(params.id);
          if (!promptId.success) {
            return HttpEnvelope.error(
              AppError.from("unknown", { message: "Invalid prompt ID" }),
            ).toJson();
          }
          const result = await this.#removeVoteUseCase.execute(ctx, {
            promptId: promptId.data,
          });
          if (result.isErr()) {
            return HttpEnvelope.error(result.error).toJson();
          }
          return HttpEnvelope.ok({ data: result.value }).toJson();
        },
        { params: t.Object({ id: t.String() }) },
      );

    const publicRouter = new Elysia({
      name: "prompt-public-router",
    })
      .use(setupAppContextMiddleware())
      .get(
        "/:id",
        async ({ params, ctx }) => {
          const promptId = idSchema.safeParse(params.id);
          if (!promptId.success) {
            return HttpEnvelope.error(
              AppError.from("unknown", { message: "Invalid prompt ID" }),
            ).toJson();
          }
          const result = await this.#getPromptUseCase.execute(ctx, {
            promptId: promptId.data,
          });
          if (result.isErr()) {
            return HttpEnvelope.error(result.error).toJson();
          }
          return HttpEnvelope.ok({ data: result.value }).toJson();
        },
        { params: t.Object({ id: t.String() }) },
      )
      .post(
        "/:id/use",
        async ({ params, ctx }) => {
          const promptId = idSchema.safeParse(params.id);
          if (!promptId.success) {
            return HttpEnvelope.error(
              AppError.from("unknown", { message: "Invalid prompt ID" }),
            ).toJson();
          }
          const result = await this.#recordPromptUsageUseCase.execute(ctx, {
            promptId: promptId.data,
          });
          if (result.isErr()) {
            return HttpEnvelope.error(result.error).toJson();
          }
          return HttpEnvelope.ok({ data: result.value }).toJson();
        },
        { params: t.Object({ id: t.String() }) },
      );

    return new Elysia({ name: "prompt-router-v1", prefix: "/api/v1/prompt" })
      .use(authRouter)
      .use(publicRouter);
  }
}
