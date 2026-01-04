import { appConfig } from "@/shared/core/app-config";

export const getMongoPromptDatabase = () => `${appConfig.app.env}_prompt`;
export const getMongoPromptCollection = () => "prompt";
