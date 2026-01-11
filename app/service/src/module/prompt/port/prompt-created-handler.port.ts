import type { PromptCreatedEvent } from "@/module/prompt/domain/event/prompt-created.event";
import type { DomainEventHandlerPort } from "@/shared/port/domain-event-handler.port";

export interface PromptCreatedHandlerPort extends DomainEventHandlerPort<PromptCreatedEvent> {}
