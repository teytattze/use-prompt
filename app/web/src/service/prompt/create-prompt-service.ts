import { z } from "zod/v4";
import type { HttpClient } from "@/lib/http/http-client";
import { httpEnvelopeSchema } from "@/lib/http/http-dto";
import type { ServiceInput } from "@/lib/service";
import { promptDtoSchema } from "@/service/prompt/prompt-dto";

export const createPromptBodyDtoSchema = z.object({
  body: z.string(),
  title: z.string(),
});
export type CreatePromptBodyDto = z.infer<typeof createPromptBodyDtoSchema>;

export const makeCreatePromptService =
  (httpClient: HttpClient) =>
  async ({ data }: ServiceInput<CreatePromptBodyDto>) => {
    const response = await httpClient({
      method: "post",
      url: "/v1/prompt",
      data,
    });
    const { data: maybeData, ...rest } = httpEnvelopeSchema.parse(response);
    return { ...rest, data: promptDtoSchema.parse(maybeData) };
  };
