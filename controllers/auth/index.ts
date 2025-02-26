import { OAuth2Client, Router } from "../../deps.ts";
import callbackHandler from "./callback.ts";
import refreshTokenHandler from "./refresh-token.ts";
import loginHandler from "./login.ts";
import { AppState } from "../../server.ts";
import UserRepository from "../../repository/user.ts";
import getProfileHandler from "./profile.ts";
import authMiddleware from "../../middleware/authMiddleware.ts";
import logoutHandler from "./logout.ts";
import { createLogger, Logger } from "../../utils/logger.ts";

export class AuthController {
  private logger: Logger;

  // Middleware
  private authMiddleware;

  // Handlers
  private login;
  private callback;
  private refreshToken;
  private getProfile;
  private logout;

  constructor(
    private oauth2Client: OAuth2Client,
    private userRepository: UserRepository
  ) {
    // Initialize controller logger
    this.logger = createLogger("AuthController");

    // Middleware
    this.authMiddleware = authMiddleware(this.userRepository, this.logger);

    // Handlers
    this.login = loginHandler(this.oauth2Client);
    this.callback = callbackHandler(this.oauth2Client, userRepository);
    this.refreshToken = refreshTokenHandler(this.oauth2Client);
    this.getProfile = getProfileHandler();
    this.logout = logoutHandler();
  }

  public registerRoutes(router: Router<AppState>) {
    this.logger.info("Registering auth routes");

    const authRouter = new Router<AppState>();

    authRouter.get("/login", this.login);
    this.logger.debug("Registered GET /auth/login");

    authRouter.get("/callback", this.callback);
    this.logger.debug("Registered GET /auth/callback");

    authRouter.post("/refresh-token", this.refreshToken);
    this.logger.debug("Registered POST /auth/refresh-token");

    authRouter.get("/profile", this.authMiddleware, this.getProfile);
    this.logger.debug("Registered GET /auth/profile (with auth middleware)");

    authRouter.post("/logout", this.authMiddleware, this.logout);
    this.logger.debug("Registered POST /auth/logout (with auth middleware)");

    router.use("/auth", authRouter.routes(), authRouter.allowedMethods());
    this.logger.info("Auth routes registered successfully");
  }
}
