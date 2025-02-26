// routes/index.ts
import { Router } from "../deps.ts";
import { authController, productsController } from "../controllers/index.ts";
import { AppState } from "../server.ts";

const router = new Router<AppState>();

authController.registerRoutes(router);
productsController.registerRoutes(router);

export default router;
