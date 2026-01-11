import {
  type PromptAggregateProps,
  type PromptAggregatePropsInput,
  promptAggregatePropsSchema,
} from "@/module/prompt/domain/aggregate/prompt.props";
import { PromptArchivedEvent } from "@/module/prompt/domain/event/prompt-archived.event";
import { PromptCreatedEvent } from "@/module/prompt/domain/event/prompt-created.event";
import type { Category } from "@/module/prompt/domain/value-object/category.value-object";
import type { Tag } from "@/module/prompt/domain/value-object/tag.value-object";
import { type IdInput, idSchema, newId } from "@/shared/core/id";
import { BaseDomainAggregate } from "@/shared/domain/base-aggregate";

export class PromptAggregate extends BaseDomainAggregate<PromptAggregateProps> {
  constructor(id: IdInput, props: PromptAggregatePropsInput) {
    super(idSchema.parse(id), promptAggregatePropsSchema.parse(props));
  }

  // Getters for new fields
  get authorId(): string {
    return this.props.authorId;
  }

  get category(): Category {
    return this.props.category;
  }

  get tags(): readonly Tag[] {
    return this.props.tags;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get archivedAt(): Date | null {
    return this.props.archivedAt;
  }

  get isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  // Existing fields getters for convenience
  get title(): string {
    return this.props.title;
  }

  get description(): string {
    return this.props.description;
  }

  /**
   * Archives the prompt by setting the archivedAt timestamp.
   * Emits a PromptArchivedEvent on successful archive.
   * Idempotent: calling archive on an already archived prompt is a no-op.
   */
  archive(): void {
    if (this.isArchived) {
      // Already archived, no-op (idempotent)
      return;
    }

    const archivedAt = new Date();
    this.props.archivedAt = archivedAt;

    const event = new PromptArchivedEvent(this.id, PromptArchivedEvent.name, {
      authorId: this.props.authorId,
      archivedAt,
    });
    this.addEvent(event);
  }

  static new(props: PromptAggregatePropsInput): PromptAggregate {
    const aggregate = new PromptAggregate(newId(), props);
    const event = new PromptCreatedEvent(
      aggregate.id,
      PromptCreatedEvent.name,
      {
        authorId: aggregate.props.authorId,
        title: aggregate.props.title,
        description: aggregate.props.description,
        category: aggregate.props.category,
        messages: aggregate.props.messages,
      },
    );
    aggregate.addEvent(event);
    return aggregate;
  }

  /**
   * Reconstitutes a PromptAggregate from persisted data.
   * Does not emit domain events (already occurred).
   */
  static reconstitute(
    id: IdInput,
    props: PromptAggregatePropsInput,
  ): PromptAggregate {
    return new PromptAggregate(id, props);
  }
}
