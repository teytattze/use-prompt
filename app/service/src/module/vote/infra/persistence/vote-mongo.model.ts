import type { BaseMongoModel } from "@/infra/mongo/base-mongo-model";

export type VoteMongoModel = BaseMongoModel & {
  promptId: string;
  userId: string; // Clerk user ID (string, not ObjectId)
  value: 1 | -1;
  createdAt: Date;
  updatedAt: Date;
};
