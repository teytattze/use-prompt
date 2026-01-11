import type { BaseMongoModel } from "@/infra/mongo/base-mongo-model";
import type { MessageType } from "@/module/prompt/domain/entity/message.props";
import type { CategoryInput } from "@/module/prompt/domain/value-object/category.value-object";

export type MessageMongoModel = {
  type: MessageType;
  content: string;
  order: number;
};

export type PromptMongoModel = BaseMongoModel & {
  title: string;
  description: string;
  messages: MessageMongoModel[];
  // New fields for sharing platform
  authorId: string;
  category: CategoryInput;
  tags: string[];
  createdAt: Date;
  archivedAt: Date | null;
};
