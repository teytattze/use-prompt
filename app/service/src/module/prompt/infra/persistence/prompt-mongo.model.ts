import type { BaseMongoModel } from "@/infra/mongo/base-mongo-model";
import type { MessageType } from "@/module/prompt/domain/entity/message.props";

export type MessageMongoModel = {
  type: MessageType;
  content: string;
  order: number;
};

export type PromptMongoModel = BaseMongoModel & {
  title: string;
  description: string;
  messages: MessageMongoModel[];
};
