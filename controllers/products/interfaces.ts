import { ProductType } from "../../db/schema.ts";

interface GetProductsQueryParams {
  productType: ProductType;
  isAdmin: boolean;
  cursor: number;
  limit: number;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  search?: string;
  titleSearch?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  active?: boolean;
  sortBy: "price" | "createdAt" | "updatedAt" | "title" | "active";
  sortOrder: "asc" | "desc";
}

interface GetProductPathParams {
  productId: string;
  [key: string]: string;
}

export type { GetProductsQueryParams, GetProductPathParams };
