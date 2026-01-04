import pino from "pino";

export const appLogger = pino();

export type AppLogger = typeof appLogger;
