import type { HttpClient } from "@/lib/http/http-client";
import { httpEnvelopeSchema } from "@/lib/http/http-dto";
import { promptDtoSchema } from "@/service/prompt/prompt-dto";

export const makeListPromptsService = (httpClient: HttpClient) => async () => {
  const response = await httpClient({
    method: "get",
    url: "/v1/prompt",
  });
  const { data: maybeData, ...rest } = httpEnvelopeSchema.parse(response.data);
  return { ...rest, data: promptDtoSchema.array().parse(maybeData) };
};
