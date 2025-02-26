import { Context, Next } from "../deps.ts";
import { verifySessionToken, createSessionToken } from "../utils/jwt.ts";

export async function refreshTokenMiddleware(context: Context, next: Next) {
  await next();

  if (context.response.status === 401) {
    const refreshToken = await context.cookies.get("refreshToken");

    if (!refreshToken) {
      context.response.body = { message: "Refresh token required" };
      return;
    }

    try {
      const refreshPayload = await verifySessionToken(refreshToken);
      if (!refreshPayload || !refreshPayload.email) {
        throw new Error("Invalid refresh token");
      }

      // Create a new access token
      const newJwt = await createSessionToken({
        email: refreshPayload.email,
      });

      context.cookies.set("jwt", newJwt, {
        httpOnly: true,
        secure: Deno.env.get("ENV") === "production",
        sameSite: "strict",
        path: "/",
      });

      context.response.status = 200;
      context.response.body = { message: "Token refreshed" };
    } catch (error) {
      context.cookies.delete("jwt");
      context.cookies.delete("refreshToken");
      context.response.status = 403;
      context.response.body = { message: "Refresh failed, please login again" };
    }
  }
}
