import {
  getCache,
  REDIRECT_TO_PREFIX,
  VERIFIER_PREFIX,
  VERIFIER_TTL,
} from "../../cache/index.ts";
import { Context, OAuth2Client } from "../../deps.ts";
import { AppState } from "../../server.ts";
import { createLogger } from "../../utils/logger.ts";

const moduleLogger = createLogger("AuthLogin");

function loginHandler(oauth2Client: OAuth2Client) {
  return async (context: Context<AppState>) => {
    const requestId = crypto.randomUUID();
    const logger = moduleLogger.child({
      requestId,
      ip: context.request.ip,
      path: context.request.url.pathname,
      handler: "loginHandler",
    });

    const redirectTo = context.request.url.searchParams.get("redirectTo");

    const { uri, codeVerifier } = await oauth2Client.code.getAuthorizationUri();
    uri.searchParams.set("access_type", "offline");
    uri.searchParams.set("prompt", "consent");

    const state = crypto.randomUUID();
    uri.searchParams.set("state", state);

    const cache = getCache();
    await cache.set(`${VERIFIER_PREFIX}${state}`, codeVerifier, VERIFIER_TTL);
    if (redirectTo) {
      await cache.set(
        `${REDIRECT_TO_PREFIX}${state}`,
        redirectTo,
        VERIFIER_TTL
      );
    }

    logger.info("Saved code verifier in cache", { state });

    context.response.redirect(uri);
  };
}

export default loginHandler;
