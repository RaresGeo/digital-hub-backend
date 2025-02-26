import { User } from "../../db/schema.ts";
import { Context } from "../../deps.ts";
import ProductRepository from "../../repository/product.ts";
import type { ProductQueryParams } from "./interfaces.ts";

function getProductsHandler(productRepository: ProductRepository) {
  return async (context: Context) => {
    try {
      const queryParams = context.request.url.searchParams;

      const user = context.state.user as User | undefined;
      const isAdmin = user?.isAdmin ?? false;

      const filters: ProductQueryParams = {
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
        sortBy:
          (queryParams.get("sortBy") as ProductQueryParams["sortBy"]) ||
          "createdAt",
        sortOrder:
          (queryParams.get("sortOrder") as ProductQueryParams["sortOrder"]) ||
          "desc",
      };

      // Validate limit
      if (filters.limit < 1 || filters.limit > 100) {
        filters.limit = 20;
      }

      const { products, nextCursor } = await productRepository.getProducts(
        filters
      );

      context.response.body = {
        data: products,
        nextCursor,
        count: products.length,
      };
    } catch (error) {
      console.error("Error in getProductsHandler:", error);
      context.response.status = 500;
      context.response.body = {
        error: "Internal server error",
      };
    }
  };
}

export default getProductsHandler;
