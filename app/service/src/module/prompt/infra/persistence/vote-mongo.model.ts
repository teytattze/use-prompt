import type { BaseMongoModel } from "@/infra/mongo/base-mongo-model";
import type { Id } from "@/shared/core/id";
import type { VoteType } from "@/module/prompt/domain/aggregate/vote.props";

export type VoteMongoModel = BaseMongoModel & {
  promptId: Id;
  userId: string;
  voteType: VoteType;
  createdAt: Date;
  updatedAt: Date;
};
