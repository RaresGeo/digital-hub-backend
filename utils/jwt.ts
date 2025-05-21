import { create, getNumericDate, verify } from "../deps.ts";

export type Claims = {
  email: string;
};

const JWT_SECRET_STRING = Deno.env.get("JWT_SECRET");
const encoder = new TextEncoder();
const secretKey = encoder.encode(JWT_SECRET_STRING);

const JWT_SECRET =
  Deno.env.get("ENV") === "production"
    ? await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-512" }, true, [
        "sign",
        "verify",
      ])
    : await crypto.subtle.importKey(
        "raw",
        secretKey,
        { name: "HMAC", hash: "SHA-512" },
        true,
        ["sign", "verify"]
      );

async function createSessionToken(user: Claims): Promise<string> {
  const payload = {
    email: user.email,
    exp: getNumericDate(60 * 60 * 24),
  };

  const token = await create({ alg: "HS512", typ: "JWT" }, payload, JWT_SECRET);

  return token;
}

async function verifySessionToken(token: string): Promise<Claims | null> {
  try {
    const payload = (await verify(token, JWT_SECRET)) as Claims;

    if (!payload.email) {
      return null;
    }

    return { email: payload.email };
  } catch {
    return null;
  }
}

export { createSessionToken, verifySessionToken };
