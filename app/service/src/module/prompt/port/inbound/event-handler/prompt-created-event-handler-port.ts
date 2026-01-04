import type { BaseDomainEventHandlerPort } from "@/lib/event-handler/base-domain-event-handler-port";
import type { PromptCreatedEvent } from "@/module/prompt/domain/event/prompt-created-event";

export interface PromptCreatedEventHandlerPort extends BaseDomainEventHandlerPort<PromptCreatedEvent> {}
