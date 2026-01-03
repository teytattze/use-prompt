import { BaseEntity } from "@/lib/domain/base-entity";
import { type IdInput, idSchema, newId } from "@/lib/id";
import {
  type MessageEntityProps,
  type MessageEntityPropsInput,
  messageEntityPropsSchema,
} from "@/module/prompt/domain/entity/message-entity-props";

export class MessageEntity extends BaseEntity<MessageEntityProps> {
  constructor(id: IdInput, props: MessageEntityPropsInput) {
    super(idSchema.parse(id), messageEntityPropsSchema.parse(props));
  }

  static new(props: MessageEntityPropsInput): MessageEntity {
    return new MessageEntity(newId(), props);
  }
}
