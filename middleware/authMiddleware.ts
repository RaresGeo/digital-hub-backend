import { Context, Next } from "../deps.ts";
import { verifySessionToken } from "../utils/jwt.ts";
import UserRepository from "../repository/user.ts";
import { Logger } from "../utils/logger.ts";

function authMiddleware(userRepository: UserRepository, logger: Logger) {
  return async (context: Context, next: Next) => {
    const opLogger = logger.child({ operation: "authMiddleware" });
    opLogger.debug("Checking for JWT token");

    const jwt = await context.cookies.get("jwt");

    if (!jwt) {
      context.response.status = 401;
      context.response.body = { message: "Unauthorized" };
      return;
    }

    opLogger.debug("Found JWT token", { jwt });

    try {
      const payload = await verifySessionToken(jwt);
      if (!payload) {
        logger.debug("Invalid token", { jwt });
        throw new Error("Invalid token");
      }

      opLogger.debug("JWT Claims", { payload });

      const user = await userRepository.findByEmail(payload.email);
      if (!user || user.isDeleted) {
        opLogger.warn("Account not found or disabled", {
          email: payload.email,
          isDeleted: user?.isDeleted,
        });
        context.response.status = 403;
        context.response.body = { message: "Account not found or disabled" };
        return;
      }

      opLogger.debug("User found", { email: user.email });

      context.state.user = user;
      await next();
    } catch {
      context.response.status = 401;
      context.response.body = { message: "Invalid token" };
    }
  };
}

export default authMiddleware;
