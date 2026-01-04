import { BaseDomainEntity } from "@/shared/domain/base-entity";
import { type IdInput, idSchema, newId } from "@/shared/core/id";
import {
  type MessageEntityProps,
  type MessageEntityPropsInput,
  messageEntityPropsSchema,
} from "@/module/prompt/domain/entity/message.props";

export class MessageEntity extends BaseDomainEntity<MessageEntityProps> {
  constructor(id: IdInput, props: MessageEntityPropsInput) {
    super(idSchema.parse(id), messageEntityPropsSchema.parse(props));
  }

  static new(props: MessageEntityPropsInput): MessageEntity {
    return new MessageEntity(newId(), props);
  }
}
