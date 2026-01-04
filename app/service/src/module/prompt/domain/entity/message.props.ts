import { z } from "zod/v4";

export const MessageType = {
  INSTRUCTION: "INSTRUCTION",
  INPUT_TEMPLATE: "INPUT_TEMPLATE",
  OUTPUT_TEMPLATE: "OUTPUT_TEMPLATE",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const messageEntityPropsSchema = z.object({
  type: z
    .enum([
      MessageType.INSTRUCTION,
      MessageType.INPUT_TEMPLATE,
      MessageType.OUTPUT_TEMPLATE,
    ])
    .brand<"type">(),
  content: z.string().min(1).max(10000).brand<"content">(),
  order: z.number().int().nonnegative().brand<"order">(),
});

export type MessageEntityPropsInput = z.input<typeof messageEntityPropsSchema>;
export type MessageEntityProps = z.output<typeof messageEntityPropsSchema>;
