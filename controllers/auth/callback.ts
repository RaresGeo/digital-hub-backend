import {
  getCache,
  REDIRECT_TO_PREFIX,
  VERIFIER_PREFIX,
} from "../../cache/index.ts";
import { User } from "../../db/schema.ts";
import { Context, OAuth2Client, Tokens } from "../../deps.ts";
import UserRepository from "../../repository/user.ts";
import { createSessionToken } from "../../utils/jwt.ts";
import { Logger, createLogger } from "../../utils/logger.ts";

interface UserInfo {
  sub: string;
  name: string;
  email: string;
  picture: string;
}

const GOOGLE_USER_INFO_API_URL =
  "https://www.googleapis.com/oauth2/v3/userinfo";

const moduleLogger = createLogger("AuthCallback");

export async function getUserInfo(
  accessToken: string,
  logger: Logger
): Promise<UserInfo> {
  const opLogger = logger.child({ operation: "getUserInfo" });
  opLogger.debug("Fetching user info from Google API");

  try {
    const userInfoResponse = await fetch(GOOGLE_USER_INFO_API_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      opLogger.error("Failed to get user info from Google", {
        status: userInfoResponse.status,
        statusText: userInfoResponse.statusText,
        body: errorText,
      });
      throw new Error(
        `Failed to get user info: ${userInfoResponse.status} ${errorText}`
      );
    }

    const userInfo = await userInfoResponse.json();

    if (!userInfo.email || !userInfo.sub) {
      opLogger.error("Invalid user info received from Google", { userInfo });
      throw new Error("Invalid user info: missing required fields");
    }

    opLogger.debug("Successfully fetched user info", {
      sub: userInfo.sub,
      email: userInfo.email,
    });

    return userInfo;
  } catch (error) {
    logger.logError("Error getting the user info", error);
    throw error;
  }
}

async function handleUserRegistration(
  logger: Logger,
  userRepository: UserRepository,
  userInfo: { sub: string; email: string; name: string; picture: string },
  ip: string,
  userAgent: string
): Promise<User> {
  const opLogger = logger.child({
    operation: "handleUserRegistration",
    email: userInfo.email,
  });

  try {
    opLogger.debug("Looking for existing user");
    let user = await userRepository.findByEmail(userInfo.email);

    if (!user) {
      opLogger.info("Creating new user");
      user = {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        lastIp: ip,
        lastUserAgent: userAgent,
        isAdmin: false,
        isDeleted: 0,
        googleId: userInfo.sub,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date(),
      };

      await userRepository.create(user);
      opLogger.info("User created successfully", { isAdmin: user.isAdmin });
    } else {
      opLogger.info("Updating existing user login data", {
        isAdmin: user.isAdmin,
        email: user.email,
      });
      await userRepository.updateLastLogin(user.email, ip, userAgent);
    }

    return user;
  } catch (error) {
    logger.logError("Error during user registration", error);
    throw error;
  }
}

async function getTokens(
  logger: Logger,
  state: string | null,
  requestUrl: URL,
  oauth2Client: OAuth2Client
): Promise<{
  tokens: Tokens | null;
  errorMessage: string | null;
  statusCode: number | null;
}> {
  const opLogger = logger.child({ operation: "getTokens" });
  opLogger.debug("Getting tokens from OAuth2 client");
  if (!state) {
    logger.warn("Missing state parameter in request");
    return {
      tokens: null,
      errorMessage: "Invalid request: missing state parameter",
      statusCode: 400,
    };
  }

  const cache = getCache();
  const codeVerifier = await cache.get(`${VERIFIER_PREFIX}${state}`);
  if (typeof codeVerifier !== "string") {
    logger.warn("Missing or invalid code_verifier", {
      codeVerifierType: typeof codeVerifier,
    });
    return {
      tokens: null,
      errorMessage: "Invalid request: missing code verifier",
      statusCode: 400,
    };
  }

  // Exchange authorization code for tokens
  logger.debug("Exchanging code for tokens");
  try {
    const tokens = await oauth2Client.code.getToken(requestUrl, {
      codeVerifier,
    });
    logger.debug("Successfully obtained tokens", {
      hasAccessToken: Boolean(tokens.accessToken),
      hasRefreshToken: Boolean(tokens.refreshToken),
      expiresIn: tokens.expiresIn,
    });

    return {
      tokens,
      errorMessage: null,
      statusCode: null,
    };
  } catch (error) {
    logger.logError("Failed to exchange code for tokens", error);
    return {
      tokens: null,
      errorMessage: "Authentication failed: could not exchange code for tokens",
      statusCode: 401,
    };
  }
}

async function setJwtInSession(
  logger: Logger,
  context: Context,
  tokens: Tokens,
  userEmail: string
): Promise<void> {
  const opLogger = logger.child({ operation: "setJwtInCookies" });
  opLogger.debug("Setting JWT in session");
  let jwt;
  try {
    jwt = await createSessionToken({
      email: userEmail,
    });
    opLogger.debug("Created session token", { jwt });
  } catch (error) {
    logger.logError("Failed to create session token", error);
    context.response.status = 500;
    context.response.body = "Authentication failed: could not create session";
    return;
  }

  // Set successful response
  context.response.body = {
    message: "Authentication successful",
  };

  // Configure and set cookies
  const cookieOptions = {
    httpOnly: true,
    secure: Deno.env.get("ENV") === "production",
    sameSite: (Deno.env.get("ENV") === "production" ? "strict" : "lax") as
      | "strict"
      | "lax",
    path: "/",
    maxAge: tokens.expiresIn,
  };

  logger.debug("Setting authentication cookies");
  context.cookies.set("jwt", jwt, cookieOptions);

  if (tokens.refreshToken) {
    logger.debug("Setting refresh token cookie");
    context.cookies.set("refreshToken", tokens.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
  }
}

async function redirectUser(logger: Logger, context: Context, user: User) {
  const opLogger = logger.child({ operation: "redirectUser" });
  opLogger.debug("Redirecting user based on role");

  const state = context.request.url.searchParams.get("state");
  const cache = getCache();
  const redirectTo = await cache.get(`${REDIRECT_TO_PREFIX}${state}`);
  if (redirectTo)
    logger.debug("User wants to be redirected to", {
      redirectTo,
      isAdmin: user.isAdmin,
    });

  if (redirectTo && redirectTo === "admin" && user.isAdmin) {
    const cmsUrl = Deno.env.get("CMS_URL");
    if (!cmsUrl) {
      logger.error("CMS_URL environment variable not set");
    }
    logger.info("Redirecting admin user", { redirectUrl: cmsUrl });
    context.response.redirect(cmsUrl!);
  } else {
    let frontendUrl = Deno.env.get("FRONTEND_URL");
    if (!frontendUrl) {
      logger.error("FRONTEND_URL environment variable not set");
    }
    logger.info("Redirecting regular user", { redirectUrl: frontendUrl });
    if (redirectTo && redirectTo.startsWith("/")) {
      frontendUrl = `${frontendUrl}${redirectTo}`;
    }

    return context.response.redirect(frontendUrl!);
  }
}

function callbackHandler(
  oauth2Client: OAuth2Client,
  userRepository: UserRepository
) {
  return async (context: Context) => {
    const requestId = crypto.randomUUID();
    const logger = moduleLogger.child({
      requestId,
      ip: context.request.ip,
      path: context.request.url.pathname,
      handler: "callbackHandler",
    });

    try {
      logger.info("OAuth callback initiated");

      const state = context.request.url.searchParams.get("state");
      const { tokens, errorMessage, statusCode } = await getTokens(
        logger,
        state,
        context.request.url,
        oauth2Client
      );

      if (!tokens) {
        context.response.status = statusCode || 500;
        context.response.body = errorMessage || "Authentication failed";
      }

      // Get user info from Google
      let userInfo;
      try {
        userInfo = await getUserInfo(tokens!.accessToken, logger);
      } catch (error) {
        logger.logError("Failed to get user info", error);
        context.response.status = 401;
        context.response.body =
          "Authentication failed: could not retrieve user information";
        return;
      }

      // Register or update user
      let user: User;
      try {
        user = await handleUserRegistration(
          logger,
          userRepository,
          userInfo,
          context.request.ip,
          context.request.headers.get("user-agent") || ""
        );
      } catch {
        context.response.status = 500;
        context.response.body = "Authentication failed: internal server error";
        return;
      }

      await setJwtInSession(logger, context, tokens!, user.email);

      return redirectUser(logger, context, user);
    } catch (error) {
      logger.logError("Unhandled error in OAuth callback", error);

      // Provide appropriate error response
      context.response.status = 500;
      context.response.body = {
        message: "Authentication failed: internal server error",
      };

      // Redirect to error page in production
      if (Deno.env.get("ENV") === "production") {
        const frontendUrl = Deno.env.get("FRONTEND_URL");
        logger.info("Redirecting to error page", {
          redirectUrl: `${frontendUrl}/auth-error`,
        });
        context.response.redirect(`${frontendUrl}/auth-error`);
      }
    }
  };
}

export default callbackHandler;
