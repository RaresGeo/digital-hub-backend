import { Context, Next } from "../deps.ts";

const corsMiddleware = async (context: Context, next: Next) => {
  const isProd = Deno.env.get("ENV") === "production";

  const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://127.0.0.1:3000";
  const cmsUrl = Deno.env.get("CMS_URL") || "http://localhost:3001";

  const allowedOrigins = [frontendUrl, cmsUrl];

  const requestOrigin = context.request.headers.get("Origin");

  if (requestOrigin) {
    // If we're not in prod, just allow it anyway
    if (allowedOrigins.includes(requestOrigin) || !isProd) {
      context.response.headers.set(
        "Access-Control-Allow-Origin",
        requestOrigin
      );
      context.response.headers.set("Access-Control-Allow-Credentials", "true");
    } else if (isProd) {
      const matchedOrigin = allowedOrigins.find(
        (origin) =>
          requestOrigin.startsWith(origin) || origin.startsWith(requestOrigin)
      );

      if (matchedOrigin) {
        context.response.headers.set(
          "Access-Control-Allow-Origin",
          matchedOrigin
        );
        context.response.headers.set(
          "Access-Control-Allow-Credentials",
          "true"
        );
      }
    }
  }

  // Common headers for both environments
  context.response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  context.response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  context.response.headers.set("Access-Control-Max-Age", "86400"); // 24 hours

  // Handle preflight requests
  if (context.request.method === "OPTIONS") {
    context.response.status = 204; // No content for preflight
    return;
  }

  await next();
};

export default corsMiddleware;
