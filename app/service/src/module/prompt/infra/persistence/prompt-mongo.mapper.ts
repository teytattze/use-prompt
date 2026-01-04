import type { PersistenceMapperPort } from "@/shared/port/persistence-mapper.port";
import type { PromptMongoModel } from "@/module/prompt/infra/persistence/prompt-mongo.model";
import { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";

export class PromptMongoMapper implements PersistenceMapperPort<
  PromptAggregate,
  PromptMongoModel
> {
  fromDomain(domain: PromptAggregate): PromptMongoModel {
    return {
      _id: domain.id,
      title: domain.props.title,
      messages: domain.props.messages.map((message) => ({
        type: message.type,
        content: message.content,
        order: message.order,
      })),
    };
  }

  toDomain(model: PromptMongoModel): PromptAggregate {
    return new PromptAggregate(model._id, {
      title: model.title,
      messages: model.messages.map((message) => ({
        type: message.type,
        content: message.content,
        order: message.order,
      })),
    });
  }
}
