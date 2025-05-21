import { Router } from "../../deps.ts";
import { ProductRepository } from "../../repository/product.repository.ts";
import { AppState } from "../../server.ts";
import getProductsHandler from "./get-products.ts";
import getProductHandler from "./get-product.ts";
import createProductHandler from "./create-product.ts";
import { createLogger, Logger } from "../../utils/logger.ts";
import { FileService } from "../../http/file-manager.ts";
import { optionalAuthMiddlewareFactory } from "../../middleware/authMiddleware.ts";
import UserRepository from "../../repository/user.repository.ts";

export class ProductsController {
  private logger: Logger;

  // Middleware
  private optionalAuthMiddleware;

  // Handlers
  private getProduct;
  private getProducts;
  private createProduct;

  constructor(
    private productRepository: ProductRepository,
    private fileService: FileService,
    private userRepository: UserRepository
  ) {
    this.logger = createLogger("ProductsController");

    // Middleware
    this.optionalAuthMiddleware = optionalAuthMiddlewareFactory(
      this.userRepository,
      this.logger
    );

    // Handlers
    this.getProduct = getProductHandler(this.productRepository);
    this.getProducts = getProductsHandler(this.productRepository);
    this.createProduct = createProductHandler(
      this.productRepository,
      this.fileService
    );
  }

  public registerRoutes(router: Router<AppState>) {
    this.logger.info("Registering products routes");

    const productsRouter = new Router<AppState>();

    productsRouter.get(
      "/:productId",
      this.optionalAuthMiddleware,
      this.getProduct
    );
    this.logger.debug("Registered GET /products/:productId");

    productsRouter.get("/", this.optionalAuthMiddleware, this.getProducts);
    this.logger.debug("Registered GET /products/");

    productsRouter.post("/", this.createProduct);
    this.logger.debug("Registered POST /products");

    router.use(
      "/products",
      productsRouter.routes(),
      productsRouter.allowedMethods()
    );
    this.logger.info("Registered products routes");
  }
}
