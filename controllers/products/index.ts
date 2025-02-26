import { Router } from "../../deps.ts";
import ProductRepository from "../../repository/product.ts";
import { AppState } from "../../server.ts";
import getProductsHandler from "./get-products.ts";
import createProductHandler from "./create-product.ts";

export class ProductsController {
  // Middleware

  // Handlers
  private getProducts;
  private createProduct;

  constructor(private productRepository: ProductRepository) {
    // Middleware
    // Handlers
    this.getProducts = getProductsHandler(this.productRepository);
    this.createProduct = createProductHandler(this.productRepository);
  }

  public registerRoutes(router: Router<AppState>) {
    const productsRouter = new Router<AppState>();
    productsRouter.get("/", this.getProducts);
    productsRouter.post("/", this.createProduct);

    router.use(
      "/products",
      productsRouter.routes(),
      productsRouter.allowedMethods()
    );
  }
}
