import { isNil, omitBy } from "es-toolkit";
import { AppError } from "@/lib/app-error";

type HttpEnvelopeOkPayload<T> = T extends undefined
  ? {
      status?: number;
      code?: string;
      message?: string;
      data?: undefined;
    }
  : {
      status?: number;
      code?: string;
      message?: string;
      data: T;
    };

export class HttpEnvelope<T> {
  status: number;
  code: string;
  message: string;
  data: T;

  private constructor(status: number, code: string, message: string, data: T) {
    this.status = status;
    this.code = code;
    this.message = message;
    this.data = data;
  }

  static ok<T>({
    status,
    code,
    message,
    data = undefined,
  }: HttpEnvelopeOkPayload<T>): HttpEnvelope<T> {
    return new HttpEnvelope<T>(
      status ?? 200,
      code ?? "ok",
      message ?? "ok",
      data as T,
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
      },
      isNil,
    );
  }
}
