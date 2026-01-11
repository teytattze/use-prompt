import { Elysia, t } from "elysia";
import { setupAppContextMiddleware } from "@/infra/http/app-context.middleware";
import { setupAuthGuardMiddleware } from "@/infra/http/auth-guard.middleware";
import type {
  CastVoteInput,
  CastVoteUseCasePort,
} from "@/module/vote/port/cast-vote-use-case.port";
import type {
  ChangeVoteInput,
  ChangeVoteUseCasePort,
} from "@/module/vote/port/change-vote-use-case.port";
import type {
  GetUserVoteInput,
  GetUserVoteUseCasePort,
} from "@/module/vote/port/get-user-vote-use-case.port";
import type {
  RemoveVoteInput,
  RemoveVoteUseCasePort,
} from "@/module/vote/port/remove-vote-use-case.port";
import { HttpEnvelope } from "@/shared/http/http-envelope";

export class VoteRouter {
  #castVoteUseCase: CastVoteUseCasePort;
  #changeVoteUseCase: ChangeVoteUseCasePort;
  #removeVoteUseCase: RemoveVoteUseCasePort;
  #getUserVoteUseCase: GetUserVoteUseCasePort;

  constructor(
    castVoteUseCase: CastVoteUseCasePort,
    changeVoteUseCase: ChangeVoteUseCasePort,
    removeVoteUseCase: RemoveVoteUseCasePort,
    getUserVoteUseCase: GetUserVoteUseCasePort,
  ) {
    this.#castVoteUseCase = castVoteUseCase;
    this.#changeVoteUseCase = changeVoteUseCase;
    this.#removeVoteUseCase = removeVoteUseCase;
    this.#getUserVoteUseCase = getUserVoteUseCase;
  }

  make() {
    return (
      new Elysia({ name: "vote-router-v1", prefix: "/api/v1/prompt" })
        .use(setupAppContextMiddleware())
        .use(setupAuthGuardMiddleware())
        // PUT /prompt/:promptId/vote - Cast or change vote (upsert behavior)
        .put(
          "/:promptId/vote",
          async ({ params, body, ctx }) => {
            const input = {
              promptId: params.promptId,
              value: body.value,
            } as ChangeVoteInput;

            // Try to change existing vote first
            const changeResult = await this.#changeVoteUseCase.execute(
              ctx,
              input,
            );

            if (changeResult.isOk()) {
              return HttpEnvelope.ok({ data: changeResult.value }).toJson();
            }

            // If not found, cast new vote
            if (changeResult.error.code === "not_found") {
              const castResult = await this.#castVoteUseCase.execute(
                ctx,
                input as CastVoteInput,
              );

              if (castResult.isErr()) {
                return HttpEnvelope.error(castResult.error).toJson();
              }

              return HttpEnvelope.ok({
                status: 201,
                data: castResult.value,
              }).toJson();
            }

            return HttpEnvelope.error(changeResult.error).toJson();
          },
          {
            body: t.Object({
              value: t.Union([t.Literal(1), t.Literal(-1)]),
            }),
          },
        )
        // DELETE /prompt/:promptId/vote - Remove vote
        .delete("/:promptId/vote", async ({ params, ctx }) => {
          const input = {
            promptId: params.promptId,
          } as RemoveVoteInput;

          const result = await this.#removeVoteUseCase.execute(ctx, input);

          if (result.isErr()) {
            return HttpEnvelope.error(result.error).toJson();
          }

          return HttpEnvelope.ok({ status: 204, data: undefined }).toJson();
        })
        // GET /prompt/:promptId/vote - Get current user's vote
        .get("/:promptId/vote", async ({ params, ctx }) => {
          const input = {
            promptId: params.promptId,
          } as GetUserVoteInput;

          const result = await this.#getUserVoteUseCase.execute(ctx, input);

          if (result.isErr()) {
            return HttpEnvelope.error(result.error).toJson();
          }

          return HttpEnvelope.ok({ data: result.value }).toJson();
        })
    );
  }
}
