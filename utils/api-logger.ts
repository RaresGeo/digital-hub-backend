import { Context, Next } from "../deps.ts";
import { AppState } from "../server.ts";
import { cyan, green, magenta, red, yellow } from "./colors.ts";

const apiLoggingMiddleware = async (
  ctx: Context<AppState, AppState>,
  next: Next
) => {
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

  console.info(
    `${coloredMethod} ${ctx.request.url.pathname} from ${ctx.request.ip} - started`
  );

  await next();

  const ms = (performance.now() - start).toFixed(2);
  console.info(
    `${coloredMethod} ${ctx.request.url.pathname} - ${ms}ms, status: ${ctx.response.status}`
  );
};

export default apiLoggingMiddleware;
