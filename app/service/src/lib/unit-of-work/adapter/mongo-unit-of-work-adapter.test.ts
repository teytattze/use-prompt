import { describe, expect, it, mock } from "bun:test";
import type { ClientSession, MongoClient } from "mongodb";
import { err, ok } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import { MongoUnitOfWorkAdapter } from "./mongo-unit-of-work-adapter";

describe("MongoUnitOfWorkAdapter", () => {
  const createMockSession = (options?: {
    commitError?: Error;
    abortError?: Error;
  }) => {
    const session = {
      startTransaction: mock(() => {}),
      commitTransaction: mock(async () => {
        if (options?.commitError) throw options.commitError;
      }),
      abortTransaction: mock(async () => {
        if (options?.abortError) throw options.abortError;
      }),
      endSession: mock(async () => {}),
    } as unknown as ClientSession;
    return session;
  };

  const createMockClient = (session: ClientSession) =>
    ({
      startSession: mock(() => session),
    }) as unknown as MongoClient;

  const createBaseContext = (): AppContext => ({
    config: {} as AppContext["config"],
    logger: {} as AppContext["logger"],
    db: {},
  });

  describe("execute", () => {
    it("should commit transaction when work returns ok", async () => {
      const mockSession = createMockSession();
      const mockClient = createMockClient(mockSession);
      const unitOfWork = new MongoUnitOfWorkAdapter(mockClient, {
        transactionTimeoutMs: 30000,
      });
      const ctx = createBaseContext();

      const result = await unitOfWork.execute(ctx, async () => {
        return ok("success");
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe("success");
      expect(mockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(0);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it("should pass context with db.session populated to work function", async () => {
      const mockSession = createMockSession();
      const mockClient = createMockClient(mockSession);
      const unitOfWork = new MongoUnitOfWorkAdapter(mockClient, {
        transactionTimeoutMs: 30000,
      });
      const ctx = createBaseContext();
      let receivedCtx: AppContext | null = null;

      await unitOfWork.execute(ctx, async (txCtx) => {
        receivedCtx = txCtx;
        return ok("success");
      });

      expect(receivedCtx).not.toBeNull();
      expect(receivedCtx!.db.session).toBe(mockSession);
      expect(receivedCtx!.config).toBe(ctx.config);
      expect(receivedCtx!.logger).toBe(ctx.logger);
    });

    it("should abort transaction when work returns err", async () => {
      const mockSession = createMockSession();
      const mockClient = createMockClient(mockSession);
      const unitOfWork = new MongoUnitOfWorkAdapter(mockClient, {
        transactionTimeoutMs: 30000,
      });
      const ctx = createBaseContext();
      const mockError = AppError.from("unknown");

      const result = await unitOfWork.execute(ctx, async () => {
        return err(mockError);
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(mockError);
      expect(mockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.commitTransaction).toHaveBeenCalledTimes(0);
      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it("should return error when commit fails", async () => {
      const commitError = new Error("Commit failed");
      const mockSession = createMockSession({ commitError });
      const mockClient = createMockClient(mockSession);
      const unitOfWork = new MongoUnitOfWorkAdapter(mockClient, {
        transactionTimeoutMs: 30000,
      });
      const ctx = createBaseContext();

      const result = await unitOfWork.execute(ctx, async () => {
        return ok("success");
      });

      expect(result.isErr()).toBe(true);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it("should end session even when work throws exception", async () => {
      const mockSession = createMockSession();
      const mockClient = createMockClient(mockSession);
      const unitOfWork = new MongoUnitOfWorkAdapter(mockClient, {
        transactionTimeoutMs: 30000,
      });
      const ctx = createBaseContext();

      const result = await unitOfWork.execute(ctx, async () => {
        throw new Error("Unexpected error");
      });

      expect(result.isErr()).toBe(true);
      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it("should pass transaction options with timeout", async () => {
      const mockSession = createMockSession();
      const mockClient = createMockClient(mockSession);
      const unitOfWork = new MongoUnitOfWorkAdapter(mockClient, {
        transactionTimeoutMs: 15000,
      });
      const ctx = createBaseContext();

      await unitOfWork.execute(ctx, async () => ok("success"));

      expect(mockSession.startTransaction).toHaveBeenCalledWith({
        maxCommitTimeMS: 15000,
      });
    });
  });
});
