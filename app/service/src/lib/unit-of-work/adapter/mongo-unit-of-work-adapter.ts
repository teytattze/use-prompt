import { attemptAsync, isNil } from "es-toolkit";
import type { MongoClient } from "mongodb";
import { type Result, err } from "neverthrow";
import type { AppContext } from "@/lib/app-context";
import { withSession } from "@/lib/app-context";
import { AppError } from "@/lib/app-error";
import type {
  UnitOfWorkFn,
  UnitOfWorkPort,
} from "@/lib/unit-of-work/port/unit-of-work-port";

export type MongoUnitOfWorkOptions = {
  transactionTimeoutMs: number;
};

export class MongoUnitOfWorkAdapter implements UnitOfWorkPort {
  #client: MongoClient;
  #options: MongoUnitOfWorkOptions;

  constructor(client: MongoClient, options: MongoUnitOfWorkOptions) {
    this.#client = client;
    this.#options = options;
  }

  async execute<T>(
    ctx: AppContext,
    work: UnitOfWorkFn<T>,
  ): Promise<Result<T, AppError>> {
    const session = this.#client.startSession();

    try {
      session.startTransaction({
        maxCommitTimeMS: this.#options.transactionTimeoutMs,
      });

      const txCtx = withSession(ctx, session);
      const result = await work(txCtx);

      if (result.isOk()) {
        const [commitError] = await attemptAsync(async () => {
          await session.commitTransaction();
        });

        if (!isNil(commitError)) {
          return err(AppError.from(commitError));
        }
      } else {
        const [abortError] = await attemptAsync(async () => {
          await session.abortTransaction();
        });

        if (!isNil(abortError)) {
          console.error("Failed to abort transaction:", abortError);
        }
      }

      return result;
    } catch (error) {
      const [abortError] = await attemptAsync(async () => {
        await session.abortTransaction();
      });

      if (!isNil(abortError)) {
        console.error("Failed to abort transaction after error:", abortError);
      }

      return err(AppError.from(error));
    } finally {
      await session.endSession();
    }
  }
}
