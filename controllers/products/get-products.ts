import { User } from "../../db/schema.ts";
import { Context } from "../../deps.ts";
import { mapToProductListItem } from "../../dto/mappers/product.mapper.ts";
import { ProductRepository } from "../../repository/product.repository.ts";
import { createLogger } from "../../utils/logger.ts";
import type { GetProductsQueryParams } from "./interfaces.ts";

const moduleLogger = createLogger("ProductsGetProducts");

function getProducts(productRepository: ProductRepository) {
  return async (context: Context) => {
    const requestId = crypto.randomUUID();
    const logger = moduleLogger.child({
      requestId,
      ip: context.request.ip,
      path: context.request.url.pathname,
      handler: "getProductsHandler",
    });

    try {
      const { searchParams: queryParams } = context.request.url;

      const user = context.state.user as User | undefined;
      const isAdmin = user?.isAdmin ?? false;
      logger.debug("User getting products", {
        isAuthenticated: !!user,
        isAdmin,
        queryParams: Object.fromEntries(queryParams.entries()),
      });

      const filters: GetProductsQueryParams = {
        productType: queryParams.get(
          "productType"
        ) as GetProductsQueryParams["productType"],
        isAdmin,
        cursor: queryParams.get("cursor")
          ? parseInt(queryParams.get("cursor")!)
          : 0,
        limit: queryParams.get("limit")
          ? parseInt(queryParams.get("limit")!)
          : 20,
        minPrice: queryParams.get("minPrice")
          ? parseInt(queryParams.get("minPrice")!)
          : undefined,
        maxPrice: queryParams.get("maxPrice")
          ? parseInt(queryParams.get("maxPrice")!)
          : undefined,
        tags: queryParams.get("tags")
          ? queryParams.get("tags")!.split(",")
          : undefined,
        search: queryParams.get("search") || undefined,
        ...(isAdmin
          ? {
              titleSearch: queryParams.get("titleSearch") || undefined,
              createdAfter: queryParams.get("createdAfter")
                ? new Date(queryParams.get("createdAfter")!)
                : undefined,
              createdBefore: queryParams.get("createdBefore")
                ? new Date(queryParams.get("createdBefore")!)
                : undefined,
              updatedAfter: queryParams.get("updatedAfter")
                ? new Date(queryParams.get("updatedAfter")!)
                : undefined,
              updatedBefore: queryParams.get("updatedBefore")
                ? new Date(queryParams.get("updatedBefore")!)
                : undefined,
              active: queryParams.get("active") === "true",
            }
          : {}),
        sortBy: (queryParams.get(
          "sortBy"
        ) as GetProductsQueryParams["sortBy"]) || ["createdAt"],
        sortOrder:
          (queryParams.get(
            "sortOrder"
          ) as GetProductsQueryParams["sortOrder"]) || "desc",
      };

      // Validate limit
      if (filters.limit < 1 || filters.limit > 100) {
        logger.debug("Invalid limit, setting to 20", { limit: filters.limit });
        filters.limit = 20;
      }

      logger.debug("Filtering products", { ...filters });
      const {
        products: productsView,
        nextCursor,
        totalCount,
      } = await productRepository.getProducts(filters);

      logger.debug("Fetched products", {
        count: productsView.length,
        nextCursor,
      });

      const products = productsView.map((product) =>
        mapToProductListItem(product, logger)
      );

      context.response.body = {
        products,
        nextCursor,
        count: totalCount,
      };
    } catch (error) {
      logger.logError("Error in getProductsHandler", error);
      context.response.status = 500;
      context.response.body = {
        error: "Internal server error",
      };
    }
  };
}

export default getProducts;
