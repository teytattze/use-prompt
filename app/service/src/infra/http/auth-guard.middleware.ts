import Elysia from "elysia";
import { memoize } from "es-toolkit";
import { type JWTPayload, createRemoteJWKSet, jwtVerify } from "jose";
import { type Result, err, ok } from "neverthrow";
import { appConfig } from "@/shared/core/app-config";
import { AppError } from "@/shared/core/app-error";
import { type JwtUser, jwtUserSchema } from "@/shared/core/jwt-user";

interface ClerkJwtPayload extends JWTPayload {
  id: string;
  username: string;
  email: string;
  createdAt: number;
}

const getJwks = memoize(() => {
  return createRemoteJWKSet(new URL(appConfig.clerk.jwksUrl));
});

export function extractBearerToken(
  authHeader: string | undefined,
): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function verifyJwt(
  token: string,
): Promise<Result<ClerkJwtPayload, AppError>> {
  try {
    const jwks = getJwks();
    const options: Parameters<typeof jwtVerify>[2] = {
      issuer: appConfig.clerk.issuer,
    };
    const { payload } = await jwtVerify(token, jwks, options);

    if (!payload.sub) {
      return err(
        AppError.from("unauthorized", {
          message: "Invalid token: missing subject claim",
        }),
      );
    }

    return ok(payload as ClerkJwtPayload);
  } catch (error) {
    console.log(error);
    return err(
      AppError.from("unauthorized", {
        cause: error,
        message: "Invalid or expired token",
      }),
    );
  }
}

export const setupAuthGuardMiddleware = () =>
  new Elysia({ name: "auth-guard-middleware" }).derive(
    { as: "scoped" },
    async ({ headers }): Promise<{ user: JwtUser }> => {
      const token = extractBearerToken(headers.authorization);

      if (!token) {
        throw AppError.from("unauthorized");
      }

      const result = await verifyJwt(token);

      if (result.isErr()) {
        throw AppError.from("unauthorized");
      }

      const user = jwtUserSchema.decode({
        id: result.value.id,
        username: result.value.username,
        email: result.value.email,
        createdAt: new Date(result.value.createdAt * 1000),
      });

      return { user };
    },
  );
