import { Context, Next } from "../deps.ts";
import { verifySessionToken } from "../utils/jwt.ts";
import UserRepository from "../repository/user.repository.ts";
import { Logger } from "../utils/logger.ts";

/**
 * Middleware that attempts to authenticate a user but doesn't enforce authentication.
 * Populates context.state.user if authentication is successful.
 */
function optionalAuthMiddlewareFactory(
  userRepository: UserRepository,
  logger: Logger
) {
  return async (context: Context, next: Next) => {
    const opLogger = logger.child({ operation: "optionalAuthMiddleware" });
    opLogger.debug("Checking for JWT token");

    const jwt = await context.cookies.get("jwt");
    if (!jwt) {
      opLogger.debug("No JWT token found");
      await next();
      return;
    }

    opLogger.debug("Found JWT token");
    try {
      const payload = await verifySessionToken(jwt);
      if (!payload) {
        opLogger.debug("Invalid token");
        await next();
        return;
      }

      opLogger.debug("JWT Claims", { payload });
      const user = await userRepository.findByEmail(payload.email);

      if (!user || user.isDeleted) {
        opLogger.warn("Account not found or disabled", {
          email: payload.email,
          isDeleted: user?.isDeleted,
        });
        await next();
        return;
      }

      opLogger.debug("User found", { email: user.email });
      context.state.user = user;
      await next();
    } catch (error) {
      opLogger.debug("Authentication error", {
        error: (error as Error).message,
      });
      await next();
    }
  };
}

/**
 * Middleware that enforces authentication.
 * Returns 401/403 status codes if authentication fails.
 * Builds upon optionalAuthMiddleware.
 */
function requireAuthMiddlewareFactory(
  userRepository: UserRepository,
  logger: Logger
) {
  const optionalAuth = optionalAuthMiddlewareFactory(userRepository, logger);

  return async (context: Context, next: Next) => {
    const opLogger = logger.child({ operation: "requireAuthMiddleware" });

    // First run the optional auth to try to populate context.state.user
    await optionalAuth(context, async () => {
      // Check if authentication was successful
      if (!context.state.user) {
        opLogger.debug("Authentication required but no user found");
        context.response.status = 401;
        context.response.body = { message: "Unauthorized" };
        return;
      }

      // Authentication was successful, continue to the next middleware
      await next();
    });
  };
}

export { optionalAuthMiddlewareFactory, requireAuthMiddlewareFactory };
