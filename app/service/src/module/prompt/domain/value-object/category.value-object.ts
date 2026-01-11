import { z } from "zod/v4";

/**
 * Category enum values for prompt classification.
 * Used for filtering and organizing prompts in browse/search.
 */
export const CATEGORY_VALUES = [
  "coding",
  "writing",
  "analysis",
  "creative",
  "productivity",
  "other",
] as const;

/**
 * Zod schema for validating category values.
 * Accepts only the predefined category enum values.
 */
export const categorySchema = z.enum(CATEGORY_VALUES).brand<"Category">();

/**
 * Type-safe Category type derived from the schema.
 */
export type Category = z.infer<typeof categorySchema>;

/**
 * Input type for Category (before branding).
 */
export type CategoryInput = z.input<typeof categorySchema>;
