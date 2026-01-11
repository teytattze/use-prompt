import { z } from "zod/v4";
import { promptAggregatePropsSchema } from "@/module/prompt/domain/aggregate/prompt.props";
import { BaseDomainEvent } from "@/shared/domain/base-domain-event";

const promptArchivedEventPropsSchema = z.object({
  authorId: promptAggregatePropsSchema.shape.authorId,
  archivedAt: z.date(),
});
type PromptArchivedEventProps = z.output<typeof promptArchivedEventPropsSchema>;

/**
 * Domain event emitted when a prompt is archived.
 * Used to trigger downstream handlers (e.g., remove from search index).
 */
export class PromptArchivedEvent extends BaseDomainEvent<PromptArchivedEventProps> {
  /**
   * Event name constant for event bus routing.
   */
  static readonly eventName = "prompt.archived" as const;

  get authorId(): string {
    return this.props.authorId;
  }

  get archivedAt(): Date {
    return this.props.archivedAt;
  }
}
