import { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";
import type { PromptMongoModel } from "@/module/prompt/infra/persistence/prompt-mongo.model";
import type { PersistenceMapperPort } from "@/shared/port/persistence-mapper.port";

export class PromptMongoMapper implements PersistenceMapperPort<
  PromptAggregate,
  PromptMongoModel
> {
  fromDomain(domain: PromptAggregate): PromptMongoModel {
    return {
      _id: domain.id,
      title: domain.props.title,
      description: domain.props.description,
      messages: domain.props.messages.map((message) => ({
        type: message.type,
        content: message.content,
        order: message.order,
      })),
      // New fields
      authorId: domain.props.authorId,
      category: domain.props.category,
      tags: domain.props.tags,
      createdAt: domain.props.createdAt,
      archivedAt: domain.props.archivedAt,
    };
  }

  toDomain(model: PromptMongoModel): PromptAggregate {
    return PromptAggregate.reconstitute(model._id, {
      title: model.title,
      description: model.description,
      messages: model.messages.map((message) => ({
        type: message.type,
        content: message.content,
        order: message.order,
      })),
      // New fields
      authorId: model.authorId,
      category: model.category,
      tags: model.tags,
      createdAt: model.createdAt,
      archivedAt: model.archivedAt,
    });
  }
}
