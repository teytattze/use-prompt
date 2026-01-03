import { appConfig } from "@/lib/app-config";

export const getMongoPromptDatabase = () => `${appConfig.app.env}_prompt`;
export const getMongoPromptCollection = () => "prompt";
