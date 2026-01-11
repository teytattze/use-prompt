import {
  type MessageEntityProps,
  type MessageEntityPropsInput,
  messageEntityPropsSchema,
} from "@/module/prompt/domain/entity/message.props";
import { type IdInput, idSchema, newId } from "@/shared/core/id";
import { BaseDomainEntity } from "@/shared/domain/base-entity";

export class MessageEntity extends BaseDomainEntity<MessageEntityProps> {
  constructor(id: IdInput, props: MessageEntityPropsInput) {
    super(idSchema.parse(id), messageEntityPropsSchema.parse(props));
  }

  static new(props: MessageEntityPropsInput): MessageEntity {
    return new MessageEntity(newId(), props);
  }
}
