import { User } from "../../db/schema.ts";
import { RouterContext } from "../../deps.ts";
import { mapToProduct } from "../../dto/mappers/product.mapper.ts";
import { ProductRepository } from "../../repository/product.repository.ts";
import { createLogger } from "../../utils/logger.ts";
import type { GetProductPathParams } from "./interfaces.ts";

const moduleLogger = createLogger("ProductsGetProduct");

function getProduct(productRepository: ProductRepository) {
  return async (context: RouterContext<string, GetProductPathParams>) => {
    const requestId = crypto.randomUUID();
    const logger = moduleLogger.child({
      requestId,
      ip: context.request.ip,
      path: context.request.url.pathname,
      handler: "getProductHandler",
    });

    try {
      const { productId } = context.params as GetProductPathParams;

      const user = context.state.user as User | undefined;
      const isAdmin = user?.isAdmin ?? false;
      logger.debug("User getting product", {
        isAuthenticated: !!user,
        isAdmin,
      });

      const productView = await productRepository.getProduct(
        productId,
        isAdmin
      );

      if (productView === null) {
        logger.debug("Product not found", {
          productId,
        });
        context.response.status = 404;
        context.response.body = {
          error: "Product not found",
        };
        return;
      }

      logger.debug("Fetched product", {
        product: productView,
        keys: Object.keys(productView),
      });

      context.response.body = {
        product: mapToProduct(productView, logger, isAdmin),
      };
    } catch (error) {
      logger.logError("Error in getProductHandler", error);
      context.response.status = 500;
      context.response.body = {
        error: "Internal server error",
      };
    }
  };
}

export default getProduct;
