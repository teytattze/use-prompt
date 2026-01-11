import { type Result, ok } from "neverthrow";
import type { PromptCreatedEvent } from "@/module/prompt/domain/event/prompt-created.event";
import type { PromptCreatedHandlerPort } from "@/module/prompt/port/prompt-created-handler.port";
import type { AppContext } from "@/shared/core/app-context";
import type { AppError } from "@/shared/core/app-error";

export class PromptCreatedHandler implements PromptCreatedHandlerPort {
  async handle(
    ctx: AppContext,
    event: PromptCreatedEvent,
  ): Promise<Result<void, AppError>> {
    ctx.logger.info({
      msg: "Prompt created event received",
      eventId: event.id,
      aggregateId: event.aggregateId,
      title: event.props.title,
    });
    return ok(undefined);
  }
}
