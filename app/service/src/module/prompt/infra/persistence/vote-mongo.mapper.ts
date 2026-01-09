import type { PersistenceMapperPort } from "@/shared/port/persistence-mapper.port";
import type { VoteMongoModel } from "@/module/prompt/infra/persistence/vote-mongo.model";
import { VoteAggregate } from "@/module/prompt/domain/aggregate/vote.aggregate";

export class VoteMongoMapper
  implements PersistenceMapperPort<VoteAggregate, VoteMongoModel>
{
  fromDomain(domain: VoteAggregate): VoteMongoModel {
    return {
      _id: domain.id,
      promptId: domain.props.promptId,
      userId: domain.props.userId,
      voteType: domain.props.voteType,
      createdAt: domain.props.createdAt,
      updatedAt: domain.props.updatedAt,
    };
  }

  toDomain(model: VoteMongoModel): VoteAggregate {
    return new VoteAggregate(model._id, {
      promptId: model.promptId,
      userId: model.userId,
      voteType: model.voteType,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });
  }
}
