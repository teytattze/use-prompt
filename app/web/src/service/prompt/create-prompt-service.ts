import { z } from "zod/v4";
import { httpClient } from "@/lib/http/http-client";
import { httpEnvelopeSchema } from "@/lib/http/http-dto";
import type { ServiceInput } from "@/lib/service";
import { promptDtoSchema } from "@/service/prompt/prompt-dto";

export const createPromptDtoSchema = z.object({
  body: z.string(),
  title: z.string(),
});
export type CreatePromptDto = z.infer<typeof createPromptDtoSchema>;

export const createPromptService = async ({
  data,
}: ServiceInput<CreatePromptDto>) => {
  const response = await httpClient({
    method: "post",
    url: "/v1/prompt",
    data,
  });
  const { data: maybeData, ...rest } = httpEnvelopeSchema.parse(response);
  return { ...rest, data: promptDtoSchema.parse(maybeData) };
};
