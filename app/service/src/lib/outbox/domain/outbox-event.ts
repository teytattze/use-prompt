import type { Id } from "@/lib/id";

type OutboxEventStatus = "PENDING" | "PUBLISHED" | "FAILED";

type OutboxEventProps = {
  id: Id;
  aggregateId: Id;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  publishedAt: Date | null;
  status: OutboxEventStatus;
  retryCount: number;
  lastError: string | null;
};

export class OutboxEvent {
  readonly id: Id;
  readonly aggregateId: Id;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly occurredAt: Date;
  readonly publishedAt: Date | null;
  readonly status: OutboxEventStatus;
  readonly retryCount: number;
  readonly lastError: string | null;

  constructor(props: OutboxEventProps) {
    this.id = props.id;
    this.aggregateId = props.aggregateId;
    this.eventType = props.eventType;
    this.payload = props.payload;
    this.occurredAt = props.occurredAt;
    this.publishedAt = props.publishedAt;
    this.status = props.status;
    this.retryCount = props.retryCount;
    this.lastError = props.lastError;
  }
}

export type { OutboxEventStatus, OutboxEventProps };
