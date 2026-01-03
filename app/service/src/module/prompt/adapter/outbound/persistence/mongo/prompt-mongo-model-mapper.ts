import type { PersistenceModelMapper } from "@/lib/mapper/persistence-model-mapper";
import type { PromptMongoModel } from "@/module/prompt/adapter/outbound/persistence/mongo/prompt-mongo-model";
import { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";

export class PromptMongoModelMapper implements PersistenceModelMapper<
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
