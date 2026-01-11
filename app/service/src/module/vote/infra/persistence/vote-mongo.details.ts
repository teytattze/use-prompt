import { appConfig } from "@/shared/core/app-config";

export const getMongoVoteDatabase = () => `${appConfig.app.env}_prompt`;
export const getMongoVoteCollection = () => "vote";

/**
 * Index definitions for vote collection setup.
 * These should be created when setting up the MongoDB database.
 *
 * Indexes:
 * 1. Unique constraint: one vote per user per prompt
 * 2. For aura calculation by prompt
 * 3. For user's vote lookup
 */
export const VOTE_INDEXES = [
  // Unique constraint: one vote per user per prompt
  { key: { promptId: 1, userId: 1 }, options: { unique: true } },
  // For aura calculation by prompt
  { key: { promptId: 1 } },
  // For user's vote lookup
  { key: { userId: 1, promptId: 1 } },
] as const;
