import { attemptAsync } from "es-toolkit";
import { type BSON, Collection } from "mongodb";

export const getOutboxEventMongoCollection = () => "event";

export const withOutboxEventMongoCollectionIndexes = async <
  TSchema extends BSON.Document,
>(
  collection: Collection<TSchema>,
) => {
  const [error] = await attemptAsync(() =>
    collection.createIndex({ status: 1, occurredAt: 1 }),
  );

  if (error) {
    console.error("Failed to create outbox index:", error);
    throw error;
  }

  return collection;
};
