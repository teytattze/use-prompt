import { isNil, omitBy } from "es-toolkit";
import { AppError } from "@/shared/core/app-error";

/**
 * Pagination metadata for list responses.
 */
type PaginationMeta = {
  cursor: string | null;
  hasMore: boolean;
};

type HttpEnvelopeOkPayload<T, M = undefined> = T extends undefined
  ? {
      status?: number;
      code?: string;
      message?: string;
      data?: undefined;
      meta?: M;
    }
  : {
      status?: number;
      code?: string;
      message?: string;
      data: T;
      meta?: M;
    };

export class HttpEnvelope<T, M = undefined> {
  status: number;
  code: string;
  message: string;
  data: T;
  meta: M | undefined;

  private constructor(
    status: number,
    code: string,
    message: string,
    data: T,
    meta?: M,
  ) {
    this.status = status;
    this.code = code;
    this.message = message;
    this.data = data;
    this.meta = meta;
  }

  static ok<T, M = undefined>({
    status,
    code,
    message,
    data = undefined,
    meta,
  }: HttpEnvelopeOkPayload<T, M>): HttpEnvelope<T, M> {
    return new HttpEnvelope<T, M>(
      status ?? 200,
      code ?? "ok",
      message ?? "ok",
      data as T,
      meta,
    );
  }

  static error(error: AppError) {
    return new HttpEnvelope<undefined>(
      error.status,
      error.code,
      error.message,
      undefined,
    );
  }

  toJson() {
    return omitBy(
      {
        status: this.status,
        code: this.code,
        message: this.message,
        data: this.data,
        meta: this.meta,
      },
      isNil,
    );
  }
}

export type { PaginationMeta };
