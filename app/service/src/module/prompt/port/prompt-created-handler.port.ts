import type { DomainEventHandlerPort } from "@/shared/port/domain-event-handler.port";
import type { PromptCreatedEvent } from "@/module/prompt/domain/event/prompt-created.event";

export interface PromptCreatedHandlerPort extends DomainEventHandlerPort<PromptCreatedEvent> {}
