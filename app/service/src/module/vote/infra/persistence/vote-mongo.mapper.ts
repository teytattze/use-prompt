import { VoteAggregate } from "@/module/vote/domain/aggregate/vote.aggregate";
import type { VoteMongoModel } from "@/module/vote/infra/persistence/vote-mongo.model";
import type { PersistenceMapperPort } from "@/shared/port/persistence-mapper.port";

export class VoteMongoMapper implements PersistenceMapperPort<
  VoteAggregate,
  VoteMongoModel
> {
  fromDomain(domain: VoteAggregate): VoteMongoModel {
    return {
      _id: domain.id,
      promptId: domain.props.promptId,
      userId: domain.props.userId,
      value: domain.props.value,
      createdAt: domain.props.createdAt,
      updatedAt: domain.props.updatedAt,
    };
  }

  toDomain(model: VoteMongoModel): VoteAggregate {
    return VoteAggregate.reconstitute(model._id, {
      promptId: model.promptId,
      userId: model.userId,
      value: model.value,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });
  }
}
