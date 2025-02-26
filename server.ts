// server.ts
import { getCache } from "./cache/index.ts";
import { Application, initializeImageMagick, Session } from "./deps.ts";
import corsMiddleware from "./middleware/cors.ts";
import router from "./routes/index.ts";
import apiLoggingMiddleware from "./utils/api-logger.ts";

export type AppState = {
  session: Session;
};

initializeImageMagick();

const app = new Application<AppState>();

app.use(Session.initMiddleware());
// If not in production, add logging middleware
if (Deno.env.get("DENO_ENV") !== "production") {
  app.use(apiLoggingMiddleware);
}
app.use(router.routes());
app.use(router.allowedMethods());
app.use(corsMiddleware);

getCache().connect();

const PORT = Deno.env.get("PORT") || 8080;
app.listen({ port: +PORT });
console.info(`Server is running on http://localhost:${PORT}`);
