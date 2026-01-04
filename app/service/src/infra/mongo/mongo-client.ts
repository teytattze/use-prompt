import { MongoClient } from "mongodb";
import { appConfig } from "@/shared/core/app-config";

export const mongoClient = new MongoClient(appConfig.mongo.uri, {});
