interface ProductQueryParams {
  isAdmin: boolean;
  cursor: number;
  limit: number;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  search?: string;
  sortBy: "price" | "createdAt" | "title";
  sortOrder: "asc" | "desc";
}

export type { ProductQueryParams };
