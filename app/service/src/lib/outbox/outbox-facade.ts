import type { AppContext } from "@/lib/app-context";
import { EventHandlerRegistryAdapter } from "@/lib/outbox/adapter/inbound/event-handler-registry-adapter";
import { OutboxProcessorAdapter } from "@/lib/outbox/adapter/inbound/outbox-processor-adapter";
import type { OutboxConfig } from "@/lib/outbox/outbox-config";
import type { EventHandlerPort } from "@/lib/outbox/port/inbound/event-handler-port";
import type { EventHandlerRegistryPort } from "@/lib/outbox/port/inbound/event-handler-registry-port";
import type { OutboxProcessorPort } from "@/lib/outbox/port/inbound/outbox-processor-port";
import type { OutboxEventRepositoryPort } from "@/lib/outbox/port/outbound/persistence/outbox-event-repository-port";

export type OutboxFacadeOptions = {
  ctx: AppContext;
  config: OutboxConfig;
  repository: OutboxEventRepositoryPort;
};

export class OutboxFacade {
  #registry: EventHandlerRegistryPort;
  #processor: OutboxProcessorPort;

  constructor(options: OutboxFacadeOptions) {
    this.#registry = new EventHandlerRegistryAdapter();

    this.#processor = new OutboxProcessorAdapter(
      options.ctx,
      options.config,
      options.repository,
      this.#registry,
    );
  }

  registerHandler(eventType: string, handler: EventHandlerPort): void {
    this.#registry.register(eventType, handler);
  }

  start(): void {
    this.#processor.start();
  }

  async stop(): Promise<void> {
    await this.#processor.stop();
  }
}
