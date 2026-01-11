import type { PromptDto } from "@/module/prompt/application/dto/prompt.dto";
import type { UseCasePort } from "@/shared/port/use-case.port";

export interface ListPromptsUseCasePort extends UseCasePort<
  undefined,
  PromptDto[]
> {}
