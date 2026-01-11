import { z } from "zod/v4";

/**
 * Tag validation rules:
 * - 1-30 characters
 * - Lowercase alphanumeric and hyphens only
 * - Cannot start or end with hyphen
 * - No consecutive hyphens
 *
 * Pattern: starts with alphanumeric, optionally followed by
 * groups of (hyphen + alphanumeric). This ensures:
 * - No leading/trailing hyphens
 * - No consecutive hyphens (e.g., "tag--name")
 */
export const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TAG_MIN_LENGTH = 1;
export const TAG_MAX_LENGTH = 30;
export const TAGS_MAX_COUNT = 10;

/**
 * Zod schema for a single tag.
 * Validates format and length constraints.
 */
export const tagSchema = z
  .string()
  .min(TAG_MIN_LENGTH, "Tag must be at least 1 character")
  .max(TAG_MAX_LENGTH, "Tag must be at most 30 characters")
  .regex(
    TAG_PATTERN,
    "Tag must be lowercase alphanumeric with single hyphens (no leading/trailing/consecutive hyphens)",
  )
  .brand<"Tag">();

/**
 * Type-safe Tag type derived from the schema.
 */
export type Tag = z.infer<typeof tagSchema>;

/**
 * Input type for Tag (before branding).
 */
export type TagInput = z.input<typeof tagSchema>;

/**
 * Zod schema for an array of tags.
 * - Maximum 10 tags per prompt
 * - Defaults to empty array if not provided
 */
export const tagsArraySchema = z
  .array(tagSchema)
  .max(TAGS_MAX_COUNT, `Maximum ${TAGS_MAX_COUNT} tags allowed`)
  .default([]);

/**
 * Type for an array of tags.
 */
export type TagsArray = z.infer<typeof tagsArraySchema>;

/**
 * Normalizes a tag input by converting to lowercase and trimming whitespace.
 * Use this before validation to ensure consistent tag format.
 *
 * @param input - Raw tag string
 * @returns Normalized tag string (lowercase, trimmed)
 */
export function normalizeTag(input: string): string {
  return input.toLowerCase().trim();
}
