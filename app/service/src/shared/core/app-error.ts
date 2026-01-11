import { isString } from "es-toolkit";

const appErrorDetails = {
  unknown: {
    message: "Internal server error",
    status: 500,
  },
  unauthorized: {
    message: "Unauthorized",
    status: 401,
  },
  forbidden: {
    message: "Forbidden",
    status: 403,
  },
  not_found: {
    message: "Resource not found",
    status: 404,
  },
  conflict: {
    message: "Resource conflict",
    status: 409,
  },
  bad_request: {
    message: "Bad request",
    status: 400,
  },
  self_vote: {
    message: "Cannot vote on own prompt",
    status: 400,
  },
  prompt_archived: {
    message: "Action not allowed on archived prompt",
    status: 400,
  },
} as const satisfies Record<string, { status: number; message: string }>;

type AppErrorDetails = typeof appErrorDetails;
type AppErrorCode = keyof AppErrorDetails;

export class AppError extends Error {
  code: AppErrorCode;

  private constructor(code: AppErrorCode, message: string, cause: unknown) {
    super(message, { cause });
    this.code = code;
  }

  static from(
    error: unknown,
    options: { cause?: unknown; message?: string } = {},
  ) {
    if (isString(error) && Object.hasOwn(appErrorDetails, error)) {
      const code = error as AppErrorCode;
      const details = appErrorDetails[code];

      return new AppError(
        code,
        options.message ?? details.message,
        options.cause,
      );
    }

    if (error instanceof AppError) {
      return error;
    }

    const fallbackCode = "unknown" as const;
    const details = appErrorDetails[fallbackCode];
    return new AppError(
      fallbackCode,
      options.message ?? details.message,
      options.cause,
    );
  }

  get status() {
    return appErrorDetails[this.code].status;
  }
}
