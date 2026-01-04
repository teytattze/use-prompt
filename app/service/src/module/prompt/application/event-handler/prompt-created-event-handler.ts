import { type Result, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import type { AppError } from "@/lib/app-error";
import type { PromptCreatedEvent } from "@/module/prompt/domain/event/prompt-created-event";
import type { PromptCreatedEventHandlerPort } from "@/module/prompt/port/inbound/event-handler/prompt-created-event-handler-port";

export class PromptCreatedEventHandler implements PromptCreatedEventHandlerPort {
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
