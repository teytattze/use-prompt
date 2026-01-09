import Elysia from "elysia";
import { memoize } from "es-toolkit";
import { type JWTPayload, createRemoteJWKSet, jwtVerify } from "jose";
import { appConfig } from "@/shared/core/app-config";
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

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function verifyJwt(token: string): Promise<ClerkJwtPayload | null> {
  try {
    const jwks = getJwks();
    const options: Parameters<typeof jwtVerify>[2] = {
      issuer: appConfig.clerk.issuer,
    };
    const { payload } = await jwtVerify(token, jwks, options);

    if (!payload.sub) {
      return null;
    }

    return payload as ClerkJwtPayload;
  } catch {
    return null;
  }
}

export const setupOptionalAuthMiddleware = () =>
  new Elysia({ name: "optional-auth-middleware" }).derive(
    { as: "scoped" },
    async ({ headers }): Promise<{ user: JwtUser | undefined }> => {
      const token = extractBearerToken(headers.authorization);

      if (!token) {
        return { user: undefined };
      }

      const payload = await verifyJwt(token);

      if (!payload) {
        return { user: undefined };
      }

      const user = jwtUserSchema.decode({
        id: payload.id,
        username: payload.username,
        email: payload.email,
        createdAt: new Date(payload.createdAt * 1000),
      });

      return { user };
    },
  );
