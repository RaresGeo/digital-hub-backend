import { Context } from "../../deps.ts";
import { OAuth2Client } from "../../deps.ts";
import { createSessionToken } from "../../utils/jwt.ts";
import { createLogger } from "../../utils/logger.ts";
import { getUserInfo } from "./callback.ts";

const moduleLogger = createLogger("AuthRefreshToken");

function refreshTokenHandler(oauth2Client: OAuth2Client) {
  return async (context: Context) => {
    const requestId = crypto.randomUUID();
    const logger = moduleLogger.child({
      requestId,
      ip: context.request.ip,
      path: context.request.url.pathname,
      handler: "refreshTokenHandler",
    });
    try {
      const refreshToken = await context.cookies.get("refreshToken");
      if (!refreshToken) {
        context.response.status = 401;
        context.response.body = { error: "Refresh token required" };
        return;
      }

      const tokens = await oauth2Client.refreshToken.refresh(refreshToken);

      if (!tokens.accessToken) {
        context.response.status = 401;
        context.response.body = { error: "Token refresh failed" };
        return;
      }

      const userInfo = await getUserInfo(tokens.accessToken, logger);
      if (!userInfo?.email || !userInfo?.sub) {
        context.response.status = 401;
        context.response.body = { error: "Invalid user info" };
        return;
      }

      const jwt = await createSessionToken({
        email: userInfo.email,
      });

      const cookieOptions = {
        httpOnly: true,
        secure: Deno.env.get("ENV") === "production",
        sameSite: "strict" as const,
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      };

      // Set both tokens
      context.cookies.set("jwt", jwt, cookieOptions);
      if (tokens.refreshToken) {
        context.cookies.set("refreshToken", tokens.refreshToken, cookieOptions);
      }

      // Clear response body for production
      context.response.status = 200;
      context.response.body = { status: "success" };
    } catch (error) {
      logger.logError("Error refreshing token", error);

      context.cookies.delete("jwt");
      context.cookies.delete("refreshToken");

      context.response.status = 401;
      context.response.body = {
        error:
          Deno.env.get("ENV") === "production"
            ? "Authentication failed"
            : (error as unknown as Error)?.message ?? "Unknown error",
      };
    }
  };
}

export default refreshTokenHandler;
