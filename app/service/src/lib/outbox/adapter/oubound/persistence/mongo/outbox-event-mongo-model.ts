import type { BaseMongoModel } from "@/lib/mongo/base-mongo-model";

export type OutboxModelMongoEventStatus = "PENDING" | "PUBLISHED" | "FAILED";

export type OutboxEventMongoModel = BaseMongoModel & {
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  publishedAt: Date | null;
  status: OutboxModelMongoEventStatus;
  retryCount: number;
  lastError: string | null;
};
