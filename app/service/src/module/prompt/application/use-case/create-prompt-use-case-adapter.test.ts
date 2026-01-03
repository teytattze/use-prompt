import { describe, expect, it } from "bun:test";
import type { ClientSession } from "mongodb";
import { err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type { OutboxRepositoryPort } from "@/lib/outbox/port/outbound/persistence/outbox-repository-port";
import type {
  UnitOfWorkFn,
  UnitOfWorkPort,
} from "@/lib/unit-of-work/port/unit-of-work-port";
import type { PromptAggregate } from "@/module/prompt/domain/aggregate/prompt-aggregate";
import type { CreatePromptUseCaseDto } from "@/module/prompt/port/inbound/use-case/create-prompt-use-case-port";
import type { PromptRepositoryPort } from "@/module/prompt/port/outbound/persistence/prompt-repository-port";
import { CreatePromptUseCaseAdapter } from "./create-prompt-use-case-adapter";

describe("CreatePromptUseCaseAdapter", () => {
  const mockCtx = {
    config: {},
    logger: { info: () => {}, error: () => {} },
    db: {},
  } as unknown as AppContext;

  const createMockAggregate = (id: string, title: string) =>
    ({
      id,
      props: { title, messages: [] },
      pullEvents: () => [],
    }) as unknown as PromptAggregate;

  const mockMapper = {
    toDto: (aggregate: PromptAggregate) => ({
      id: aggregate.id,
      title: aggregate.props.title,
      messages: aggregate.props.messages,
    }),
  };

  const createMockInput = (): CreatePromptUseCaseDto =>
    ({
      title: "Test",
      messages: [{ type: "INSTRUCTION", content: "Test", order: 0 }],
    }) as unknown as CreatePromptUseCaseDto;

  describe("execute", () => {
    it("should persist aggregate and events when successful", async () => {
      const mockAggregate = createMockAggregate("test-id", "Test");
      let uowExecuteCalled = false;
      let repoInsertCalled = false;
      let outboxInsertCalled = false;

      const mockUow: UnitOfWorkPort = {
        execute: async <T>(ctx: AppContext, work: UnitOfWorkFn<T>) => {
          uowExecuteCalled = true;
          const mockSession = {} as ClientSession;
          const txCtx: AppContext = {
            ...ctx,
            db: { ...ctx.db, session: mockSession },
          };
          return work(txCtx);
        },
      };

      const mockRepo: PromptRepositoryPort = {
        insertOne: async () => {
          repoInsertCalled = true;
          return ok(mockAggregate);
        },
        findMany: async () => ok([]),
      };

      const mockOutbox: OutboxRepositoryPort = {
        insertMany: async () => {
          outboxInsertCalled = true;
          return ok(undefined);
        },
      };

      const useCase = new CreatePromptUseCaseAdapter(
        mockMapper,
        mockRepo,
        mockUow,
        mockOutbox,
      );

      const result = await useCase.execute(mockCtx, createMockInput());

      expect(result.isOk()).toBe(true);
      expect(uowExecuteCalled).toBe(true);
      expect(repoInsertCalled).toBe(true);
      expect(outboxInsertCalled).toBe(true);
    });

    it("should pass context with db.session to repositories", async () => {
      const mockAggregate = createMockAggregate("test-id", "Test");
      let capturedRepoCtx: AppContext | null = null;
      let capturedOutboxCtx: AppContext | null = null;

      const mockUow: UnitOfWorkPort = {
        execute: async <T>(ctx: AppContext, work: UnitOfWorkFn<T>) => {
          const mockSession = {} as ClientSession;
          const txCtx: AppContext = {
            ...ctx,
            db: { ...ctx.db, session: mockSession },
          };
          return work(txCtx);
        },
      };

      const mockRepo: PromptRepositoryPort = {
        insertOne: async (ctx) => {
          capturedRepoCtx = ctx;
          return ok(mockAggregate);
        },
        findMany: async () => ok([]),
      };

      const mockOutbox: OutboxRepositoryPort = {
        insertMany: async (ctx) => {
          capturedOutboxCtx = ctx;
          return ok(undefined);
        },
      };

      const useCase = new CreatePromptUseCaseAdapter(
        mockMapper,
        mockRepo,
        mockUow,
        mockOutbox,
      );

      await useCase.execute(mockCtx, createMockInput());

      expect(capturedRepoCtx).not.toBeNull();
      expect(capturedRepoCtx!.db.session).toBeDefined();
      expect(capturedOutboxCtx).not.toBeNull();
      expect(capturedOutboxCtx!.db.session).toBeDefined();
    });

    it("should not persist events when aggregate save fails", async () => {
      const mockError = AppError.from("unknown");
      let outboxInsertCalled = false;

      const mockUow: UnitOfWorkPort = {
        execute: async <T>(ctx: AppContext, work: UnitOfWorkFn<T>) => {
          const mockSession = {} as ClientSession;
          const txCtx: AppContext = {
            ...ctx,
            db: { ...ctx.db, session: mockSession },
          };
          return work(txCtx);
        },
      };

      const mockRepo: PromptRepositoryPort = {
        insertOne: async () => err(mockError),
        findMany: async () => ok([]),
      };

      const mockOutbox: OutboxRepositoryPort = {
        insertMany: async () => {
          outboxInsertCalled = true;
          return ok(undefined);
        },
      };

      const useCase = new CreatePromptUseCaseAdapter(
        mockMapper,
        mockRepo,
        mockUow,
        mockOutbox,
      );

      const result = await useCase.execute(mockCtx, createMockInput());

      expect(result.isErr()).toBe(true);
      expect(outboxInsertCalled).toBe(false);
    });

    it("should return error when outbox save fails", async () => {
      const mockAggregate = createMockAggregate("test-id", "Test");
      const mockError = AppError.from("unknown");

      const mockUow: UnitOfWorkPort = {
        execute: async <T>(ctx: AppContext, work: UnitOfWorkFn<T>) => {
          const mockSession = {} as ClientSession;
          const txCtx: AppContext = {
            ...ctx,
            db: { ...ctx.db, session: mockSession },
          };
          return work(txCtx);
        },
      };

      const mockRepo: PromptRepositoryPort = {
        insertOne: async () => ok(mockAggregate),
        findMany: async () => ok([]),
      };

      const mockOutbox: OutboxRepositoryPort = {
        insertMany: async () => err(mockError),
      };

      const useCase = new CreatePromptUseCaseAdapter(
        mockMapper,
        mockRepo,
        mockUow,
        mockOutbox,
      );

      const result = await useCase.execute(mockCtx, createMockInput());

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe(mockError);
      }
    });
  });
});
