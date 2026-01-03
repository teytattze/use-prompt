import type { UseCasePort } from "@/lib/use-case/use-case-port";
import type { PromptUseCaseDto } from "@/module/prompt/port/inbound/use-case/prompt-use-case-dto";

export interface ListPromptsUseCasePort extends UseCasePort<
  undefined,
  PromptUseCaseDto[]
> {}
