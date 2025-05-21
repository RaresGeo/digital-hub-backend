import { Context, Next } from "../deps.ts";
import { AppState } from "../server.ts";
import { cyan, green, magenta, red, yellow } from "./colors.ts";
import { createLogger } from "./logger.ts";

const moduleLogger = createLogger("ApiLoggerMiddleware");

const apiLoggingMiddleware = async (
  ctx: Context<AppState, AppState>,
  next: Next
) => {
  const requestId = crypto.randomUUID();
  const logger = moduleLogger.child({
    requestId,
    ip: ctx.request.ip,
    path: ctx.request.url.pathname,
    handler: "apiLoggingMiddleware",
  });

  const start = performance.now();
  let coloredMethod;
  switch (ctx.request.method) {
    case "GET":
      coloredMethod = green(`[${ctx.request.method}]`);
      break;
    case "POST":
      coloredMethod = yellow(`[${ctx.request.method}]`);
      break;
    case "PUT":
      coloredMethod = cyan(`[${ctx.request.method}]`);
      break;
    case "DELETE":
      coloredMethod = red(`[${ctx.request.method}]`);
      break;
    default:
      coloredMethod = magenta(`[${ctx.request.method}]`);
  }

  logger.debug(
    `${coloredMethod} ${ctx.request.url.pathname} from ${ctx.request.ip} - started`
  );

  await next();

  const ms = (performance.now() - start).toFixed(2);
  logger.debug(
    `${coloredMethod} ${ctx.request.url.pathname} - ${ms}ms, status: ${ctx.response.status}`
  );
};

export default apiLoggingMiddleware;
