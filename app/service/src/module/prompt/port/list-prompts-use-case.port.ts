import type { UseCasePort } from "@/shared/port/use-case.port";
import type { PromptDto } from "@/module/prompt/application/dto/prompt.dto";

export interface ListPromptsUseCasePort extends UseCasePort<
  undefined,
  PromptDto[]
> {}
