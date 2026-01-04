export interface OutboxProcessorPort {
  start(): void;
  stop(): Promise<void>;
}
