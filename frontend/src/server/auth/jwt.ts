import "server-only";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { getEnv } from "../config/env";

export interface TokenPayload {
  sub: string; // user ID
  sid: string; // session ID
}

export interface VerifiedToken extends TokenPayload {
  iat: number;
  exp: number;
  jti: string;
  iss: string;
  aud: string;
}

function getSecretKey(): Uint8Array {
  const env = getEnv();
  return new TextEncoder().encode(env.JWT_SECRET);
}

/**
 * Sign a JWT for the given user and session.
 * Uses HS256, includes sub, sid, iss, aud, iat, exp, jti.
 */
export async function signToken(
  payload: TokenPayload,
  expiresInSeconds: number,
): Promise<string> {
  const env = getEnv();
  const key = getSecretKey();

  return new SignJWT({ sid: payload.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .setJti(randomUUID())
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .sign(key);
}

/**
 * Verify and decode a JWT.
 * Validates signature, algorithm, issuer, audience, and expiration.
 * Returns null on any validation failure — never throws for expected auth issues.
 */
export async function verifyToken(
  token: string,
): Promise<VerifiedToken | null> {
  try {
    const env = getEnv();
    const key = getSecretKey();

    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      clockTolerance: 5,
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      typeof payload.jti !== "string" ||
      typeof payload.iss !== "string"
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      sid: payload.sid,
      iat: payload.iat,
      exp: payload.exp,
      jti: payload.jti,
      iss: payload.iss,
      aud: Array.isArray(payload.aud) ? payload.aud[0] : (payload.aud as string),
    };
  } catch (err) {
    if (
      err instanceof joseErrors.JWTExpired ||
      err instanceof joseErrors.JWTClaimValidationFailed ||
      err instanceof joseErrors.JWSSignatureVerificationFailed ||
      err instanceof joseErrors.JWTInvalid
    ) {
      return null;
    }
    return null;
  }
}
