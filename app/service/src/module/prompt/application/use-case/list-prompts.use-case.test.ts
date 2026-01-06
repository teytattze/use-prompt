import { describe, expect, it } from "bun:test";
import { err, ok } from "neverthrow";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import { ListPromptsUseCase } from "./list-prompts.use-case";

describe("ListPromptsUseCase", () => {
  const mockCtx = {
    config: {},
    logger: { info: () => {}, error: () => {} },
    db: {},
  } as unknown as AppContext;

  const createMockAggregate = (
    id: string,
    title: string,
    messages: Array<{ type: string; content: string; order: number }>,
  ) =>
    ({
      id,
      props: { title, messages },
    }) as unknown as PromptAggregate;

  const mockMapper = {
    toDto: (aggregate: PromptAggregate) => ({
      id: aggregate.id,
      title: aggregate.props.title,
      messages: aggregate.props.messages,
    }),
  };

  describe("execute", () => {
    it("should return array of DTOs when prompts exist", async () => {
      const messages1 = [
        { type: "instruction", content: "Test Content 1", order: 0 },
      ];
      const messages2 = [
        { type: "instruction", content: "Test Content 2", order: 0 },
      ];

      const aggregate1 = createMockAggregate("1", "Test Title 1", messages1);
      const aggregate2 = createMockAggregate("2", "Test Title 2", messages2);

      const mockRepository: PromptRepositoryPort = {
        insertOne: async () => ok(aggregate1),
        findMany: async () => ok([aggregate1, aggregate2]),
        search: async () => ok({ prompts: [], total: 0 }),
      };

      const useCase = new ListPromptsUseCase(mockMapper, mockRepository);
      const result = await useCase.execute(mockCtx, undefined);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        expect(String(result.value[0]?.title)).toBe("Test Title 1");
        expect(String(result.value[1]?.title)).toBe("Test Title 2");
        expect(result.value[0]?.messages).toHaveLength(1);
        expect(result.value[1]?.messages).toHaveLength(1);
      }
    });

    it("should return empty array when no prompts exist", async () => {
      const mockRepository: PromptRepositoryPort = {
        insertOne: async () => ok({} as PromptAggregate),
        findMany: async () => ok([]),
        search: async () => ok({ prompts: [], total: 0 }),
      };

      const useCase = new ListPromptsUseCase(mockMapper, mockRepository);
      const result = await useCase.execute(mockCtx, undefined);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(0);
      }
    });

    it("should return error when repository fails", async () => {
      const mockError = AppError.from("unknown");
      const mockRepository: PromptRepositoryPort = {
        insertOne: async () => err(mockError),
        findMany: async () => err(mockError),
        search: async () => err(mockError),
      };

      const useCase = new ListPromptsUseCase(mockMapper, mockRepository);
      const result = await useCase.execute(mockCtx, undefined);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe(mockError);
      }
    });
  });
});
