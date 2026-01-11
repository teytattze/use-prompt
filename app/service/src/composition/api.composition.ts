import {
  composePromptModule,
  promptRepository,
} from "@/composition/prompt.composition";
import { composeVoteModule } from "@/composition/vote.composition";

// Vote module composition - depends on promptRepository
const voteModule = composeVoteModule(promptRepository);
export const voteHttpRouterV1 = voteModule.voteRouter.make();

// Prompt module composition - depends on voteRepository (cross-module dependency)
const promptModule = composePromptModule(voteModule.voteRepository);
export const promptHttpRouterV1 = promptModule.promptRouter.make();
export const userPromptsHttpRouterV1 = promptModule.userPromptsRouter.make();
