import { useQuery } from "@tanstack/react-query";
import { useProtectedHttpClient } from "@/hook/http-client/use-protected-http-client";
import { useUnprotectedHttpClient } from "@/hook/http-client/use-unprotected-http-client";
import { makeListPromptsQueryKey } from "@/lib/query/query-key";
import { makeListPromptsService } from "@/service/prompt/list-prompt-service";

export const useListPrompts = () => {
  const httpClient = useUnprotectedHttpClient();
  return useQuery({
    queryKey: makeListPromptsQueryKey(),
    queryFn: makeListPromptsService(httpClient),
  });
};
