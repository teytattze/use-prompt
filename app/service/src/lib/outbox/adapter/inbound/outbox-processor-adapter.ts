import { isNil } from "es-toolkit";
import type { AppContext } from "@/lib/app-context";
import type { OutboxEvent } from "@/lib/outbox/domain/outbox-event";
import type { OutboxConfig } from "@/lib/outbox/outbox-config";
import type { EventHandlerRegistryPort } from "@/lib/outbox/port/inbound/event-handler-registry-port";
import type { OutboxProcessorPort } from "@/lib/outbox/port/inbound/outbox-processor-port";
import type { OutboxEventRepositoryPort } from "@/lib/outbox/port/outbound/persistence/outbox-event-repository-port";

export class OutboxProcessorAdapter implements OutboxProcessorPort {
  #ctx: AppContext;
  #config: OutboxConfig;
  #repository: OutboxEventRepositoryPort;
  #registry: EventHandlerRegistryPort;
  #isRunning: boolean = false;
  #timeoutId: ReturnType<typeof setTimeout> | null = null;
  #processingPromise: Promise<void> | null = null;

  constructor(
    ctx: AppContext,
    config: OutboxConfig,
    repository: OutboxEventRepositoryPort,
    registry: EventHandlerRegistryPort,
  ) {
    this.#ctx = ctx;
    this.#config = config;
    this.#repository = repository;
    this.#registry = registry;
  }

  start(): void {
    if (this.#isRunning) {
      this.#ctx.logger.warn("OutboxProcessor is already running");
      return;
    }

    this.#isRunning = true;
    this.#ctx.logger.info("OutboxProcessor started");
    this.#schedulePoll();
  }

  async stop(): Promise<void> {
    this.#isRunning = false;

    if (!isNil(this.#timeoutId)) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }

    if (!isNil(this.#processingPromise)) {
      await this.#processingPromise;
    }

    this.#ctx.logger.info("OutboxProcessor stopped");
  }

  #schedulePoll(): void {
    if (!this.#isRunning) {
      return;
    }

    this.#timeoutId = setTimeout(async () => {
      this.#processingPromise = this.#poll();
      await this.#processingPromise;
      this.#processingPromise = null;

      this.#schedulePoll();
    }, this.#config.pollingIntervalMs);
  }

  async #poll(): Promise<void> {
    const findResult = await this.#repository.findPending(
      this.#ctx,
      this.#config.batchSize,
    );

    if (findResult.isErr()) {
      this.#ctx.logger.error(
        { error: findResult.error },
        "Failed to fetch pending outbox events",
      );
      return;
    }

    const events = findResult.value;

    if (events.length === 0) {
      return;
    }

    this.#ctx.logger.debug(
      { count: events.length },
      "Processing outbox events",
    );

    for (const event of events) {
      await this.#processEvent(event);

      if (!this.#isRunning) {
        break;
      }
    }
  }

  async #processEvent(event: OutboxEvent): Promise<void> {
    const handler = this.#registry.getHandler(event.eventType);

    if (isNil(handler)) {
      this.#ctx.logger.warn(
        { eventType: event.eventType, eventId: event.id },
        "No handler registered for event type",
      );

      await this.#repository.markFailed(
        this.#ctx,
        event.id,
        `No handler registered for event type: ${event.eventType}`,
        this.#config.maxRetries,
      );
      return;
    }

    const handleResult = await handler.handle(this.#ctx, event);

    if (handleResult.isOk()) {
      const markResult = await this.#repository.markProcessed(
        this.#ctx,
        event.id,
      );

      if (markResult.isErr()) {
        this.#ctx.logger.error(
          { eventId: event.id, error: markResult.error },
          "Failed to mark event as processed",
        );
      } else {
        this.#ctx.logger.debug(
          { eventId: event.id, eventType: event.eventType },
          "Event processed successfully",
        );
      }
    } else {
      const errorMessage = handleResult.error.message ?? "Unknown error";

      const markResult = await this.#repository.markFailed(
        this.#ctx,
        event.id,
        errorMessage,
        this.#config.maxRetries,
      );

      if (markResult.isErr()) {
        this.#ctx.logger.error(
          { eventId: event.id, error: markResult.error },
          "Failed to mark event as failed",
        );
      } else {
        this.#ctx.logger.warn(
          {
            eventId: event.id,
            eventType: event.eventType,
            error: errorMessage,
          },
          "Event processing failed",
        );
      }
    }
  }
}
