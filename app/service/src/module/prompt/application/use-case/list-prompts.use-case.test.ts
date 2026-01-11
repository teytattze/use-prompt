import { describe, expect, it } from "bun:test";
import { err, ok } from "neverthrow";
import type { PromptDtoMapper } from "@/module/prompt/application/mapper/prompt-dto.mapper";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt.aggregate";
import type { PromptRepositoryPort } from "@/module/prompt/port/prompt-repository.port";
import type { VoteRepositoryPort } from "@/module/vote/port/vote-repository.port";
import type { AppContext } from "@/shared/core/app-context";
import { AppError } from "@/shared/core/app-error";
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
    description: string,
    messages: Array<{ type: string; content: string; order: number }>,
  ) =>
    ({
      id,
      props: {
        title,
        description,
        messages,
        authorId: "test-author-id",
        category: "coding",
        tags: [],
        createdAt: new Date(),
        archivedAt: null,
      },
    }) as unknown as PromptAggregate;

  const mockMapper = {
    toDto: (aggregate: PromptAggregate, aura = 0) => ({
      id: aggregate.id,
      title: aggregate.props.title,
      description: aggregate.props.description,
      messages: aggregate.props.messages,
      authorId: aggregate.props.authorId,
      category: aggregate.props.category,
      tags: aggregate.props.tags,
      aura,
      createdAt: aggregate.props.createdAt.toISOString(),
      archivedAt: aggregate.props.archivedAt?.toISOString() ?? null,
    }),
    toWithAuthorDto: () => ({}),
    toSummaryDto: () => ({}),
  } as unknown as PromptDtoMapper;

  const createMockRepository = (
    findManyResult: ReturnType<PromptRepositoryPort["findMany"]>,
  ): PromptRepositoryPort => ({
    insertOne: async () => ok({} as PromptAggregate),
    findById: async () => ok(null),
    findMany: async () => findManyResult,
    search: async () => ok({ prompts: [], total: 0 }),
    findByAuthor: async () => ok({ items: [], cursor: null, hasMore: false }),
    updateArchivedAt: async () => ok(undefined),
    findTrending: async () => ok({ items: [], cursor: null, hasMore: false }),
    findRecent: async () => ok({ items: [], cursor: null, hasMore: false }),
    searchByText: async () =>
      ok({
        items: [],
        cursor: null,
        hasMore: false,
        facets: { categories: {}, tags: {} },
      }),
  });

  const mockVoteRepository: VoteRepositoryPort = {
    insertOne: async () => ok({} as never),
    findByPromptAndUser: async () => ok(null),
    updateOne: async () => ok({} as never),
    deleteOne: async () => ok(undefined),
    sumByPromptId: async () => ok(0),
    sumByAuthorId: async () => ok(0),
  };

  describe("execute", () => {
    it("should return array of DTOs when prompts exist", async () => {
      const messages1 = [
        { type: "instruction", content: "Test Content 1", order: 0 },
      ];
      const messages2 = [
        { type: "instruction", content: "Test Content 2", order: 0 },
      ];

      const aggregate1 = createMockAggregate(
        "1",
        "Test Title 1",
        "Description 1",
        messages1,
      );
      const aggregate2 = createMockAggregate(
        "2",
        "Test Title 2",
        "Description 2",
        messages2,
      );

      const mockRepository = createMockRepository(
        Promise.resolve(ok([aggregate1, aggregate2])),
      );

      const useCase = new ListPromptsUseCase(
        mockMapper,
        mockRepository,
        mockVoteRepository,
      );
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
      const mockRepository = createMockRepository(Promise.resolve(ok([])));

      const useCase = new ListPromptsUseCase(
        mockMapper,
        mockRepository,
        mockVoteRepository,
      );
      const result = await useCase.execute(mockCtx, undefined);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(0);
      }
    });

    it("should return error when repository fails", async () => {
      const mockError = AppError.from("unknown");
      const mockRepository = createMockRepository(
        Promise.resolve(err(mockError)),
      );

      const useCase = new ListPromptsUseCase(
        mockMapper,
        mockRepository,
        mockVoteRepository,
      );
      const result = await useCase.execute(mockCtx, undefined);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe(mockError);
      }
    });
  });
});
