import { MongoClient } from "mongodb";
import { appConfig } from "@/lib/app-config";

export const mongoClient = new MongoClient(appConfig.mongo.uri, {});
