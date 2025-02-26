import {
  and,
  arrayOverlaps,
  asc,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { ProductQueryParams } from "../controllers/products/interfaces.ts";
import db from "../db/index.ts";
import type { NewProduct } from "../db/schema.ts";
import { products, productVariants } from "../db/schema.ts";

type ProductListItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnailUrl: string;
  tags: string[] | null;
  createdAt: Date;
};

class ProductRepository {
  private db;
  private products;
  private productVariants;

  constructor() {
    this.db = db;
    this.products = products;
    this.productVariants = productVariants;
  }

  async create(product: NewProduct) {
    return await this.db.insert(this.products).values(product);
  }

  async getProducts(filters: ProductQueryParams): Promise<{
    products: ProductListItem[];
    nextCursor: number | null;
    totalCount: number;
  }> {
    const conditions = [];

    conditions.push(eq(this.products.isActive, true));

    // If not an admin, exclude drafts
    if (!filters.isAdmin) {
      conditions.push(eq(this.products.isDraft, false));
    }

    // Search filter (title and description)
    if (filters.search) {
      conditions.push(
        or(
          ilike(this.products.title, `%${filters.search}%`),
          ilike(this.products.description, `%${filters.search}%`)
        )
      );
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      conditions.push(arrayOverlaps(this.products.tags, filters.tags));
    }

    // Subquery to get the first variant's price for each product
    const firstVariant = this.db
      .select({
        productId: this.productVariants.productId,
        price: this.productVariants.price,
      })
      .from(this.productVariants)
      .where(eq(this.productVariants.isActive, true))
      .groupBy(this.productVariants.productId)
      .as("first_variant");

    // Price range filters using the first variant's price
    if (filters.minPrice !== undefined) {
      conditions.push(gte(firstVariant.price, filters.minPrice));
    }
    if (filters.maxPrice !== undefined) {
      conditions.push(lte(firstVariant.price, filters.maxPrice));
    }

    const query = this.db
      .select({
        id: this.products.id,
        title: this.products.title,
        description: this.products.description,
        price: firstVariant.price,
        thumbnailUrl: this.products.thumbnailUrl,
        tags: this.products.tags,
        createdAt: this.products.createdAt,
      })
      .from(this.products)
      .innerJoin(firstVariant, eq(this.products.id, firstVariant.productId))
      .where(and(...conditions))
      .limit(filters.limit)
      .offset(filters.cursor)
      .orderBy(
        filters.sortOrder === "asc"
          ? asc(
              filters.sortBy === "price"
                ? firstVariant.price
                : this.products[filters.sortBy]
            )
          : desc(
              filters.sortBy === "price"
                ? firstVariant.price
                : this.products[filters.sortBy]
            )
      );

    const products = await query;

    // Get total count for pagination info
    const countQuery = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.products)
      .innerJoin(firstVariant, eq(this.products.id, firstVariant.productId))
      .where(and(...conditions));

    const totalCount = Number(countQuery[0].count);

    // Calculate next cursor
    const nextCursor = (filters.cursor || 0) + products.length;
    const hasMore = nextCursor < totalCount;

    return {
      products,
      nextCursor: hasMore ? nextCursor : null,
      totalCount,
    };
  }
}

export default ProductRepository;
export type { ProductListItem };
