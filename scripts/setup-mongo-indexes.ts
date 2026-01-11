/**
 * MongoDB Index Setup Script
 *
 * This script creates the necessary MongoDB indexes for the prompt sharing platform.
 * Run this script after setting up your MongoDB instance.
 *
 * Usage:
 *   bun scripts/setup-mongo-indexes.ts
 *
 * Environment variables:
 *   MONGO_URI - MongoDB connection string (default: mongodb://root:password@localhost:27017)
 *   DB_NAME - Database name (default: dev_prompt for development)
 */
import { MongoClient } from "mongodb";

const MONGO_URI =
  process.env.MONGO_URI ?? "mongodb://root:password@localhost:27017";
const DB_NAME = process.env.DB_NAME ?? "dev_prompt";

async function setupIndexes() {
  const client = new MongoClient(MONGO_URI);

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    const db = client.db(DB_NAME);

    console.log(`Using database: ${DB_NAME}`);

    // --- Prompts Collection Indexes ---
    console.log("\nCreating prompts indexes...");
    const prompts = db.collection("prompt");

    // Author lookup - for listing user's prompts
    await prompts.createIndex(
      { authorId: 1, createdAt: -1 },
      { name: "author_created" },
    );
    console.log("  - Created: author_created");

    // Browse recent (exclude archived)
    await prompts.createIndex(
      { archivedAt: 1, createdAt: -1 },
      { name: "archived_created" },
    );
    console.log("  - Created: archived_created");

    // Browse by category
    await prompts.createIndex(
      { archivedAt: 1, category: 1, createdAt: -1 },
      { name: "archived_category_created" },
    );
    console.log("  - Created: archived_category_created");

    // Browse by tags (multikey)
    await prompts.createIndex(
      { archivedAt: 1, tags: 1, createdAt: -1 },
      { name: "archived_tags_created" },
    );
    console.log("  - Created: archived_tags_created");

    // --- Votes Collection Indexes ---
    console.log("\nCreating votes indexes...");
    const votes = db.collection("vote");

    // Unique: one vote per user per prompt
    await votes.createIndex(
      { promptId: 1, userId: 1 },
      { unique: true, name: "prompt_user_unique" },
    );
    console.log("  - Created: prompt_user_unique (unique)");

    // For aura calculation by prompt
    await votes.createIndex({ promptId: 1 }, { name: "prompt_id" });
    console.log("  - Created: prompt_id");

    // For user vote lookup
    await votes.createIndex(
      { userId: 1, promptId: 1 },
      { name: "user_prompt" },
    );
    console.log("  - Created: user_prompt");

    console.log("\nIndexes created successfully!");

    // List all indexes for verification
    console.log("\n--- Current Indexes ---");
    console.log("\nPrompts collection:");
    const promptIndexes = await prompts.listIndexes().toArray();
    for (const idx of promptIndexes) {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    }

    console.log("\nVotes collection:");
    const voteIndexes = await votes.listIndexes().toArray();
    for (const idx of voteIndexes) {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    }

    // Atlas Search reminder
    console.log("\n" + "=".repeat(60));
    console.log("IMPORTANT: Atlas Search Index Setup");
    console.log("=".repeat(60));
    console.log("\nAtlas Search index must be created manually via:");
    console.log("  1. MongoDB Atlas Dashboard > Database > Search");
    console.log("  2. Create index using JSON definition from:");
    console.log(
      "     app/service/src/module/prompt/infra/persistence/prompt-search.index.json",
    );
    console.log(
      "\nOr via Atlas Admin API / MongoDB CLI with Atlas Search support.",
    );
    console.log("=".repeat(60));
  } catch (error) {
    console.error("Error setting up indexes:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("\nDisconnected from MongoDB.");
  }
}

setupIndexes();
