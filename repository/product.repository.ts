import {
  and,
  arrayOverlaps,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  SQL,
} from "drizzle-orm";
import { PgColumn, uuid } from "drizzle-orm/pg-core";
import { SubqueryWithSelection } from "drizzle-orm/pg-core/subquery";
import { GetProductsQueryParams } from "../controllers/products/interfaces.ts";
import db from "../db/index.ts";
import type {
  NewProduct,
  NewProductVariant,
  NewVariantPhoto,
  Product,
  ProductVariant,
  VariantPhoto,
} from "../db/schema.ts";
import {
  assetReferences,
  products,
  productVariants,
  variantPhotos,
} from "../db/schema.ts";
import { EntityEnum } from "../models/asset.model.ts";

type FeaturedVariantSubquery = SubqueryWithSelection<
  {
    // deno-lint-ignore no-explicit-any
    productId: PgColumn<any>;
    // deno-lint-ignore no-explicit-any
    price: PgColumn<any>;
  },
  "featured_variant"
>;
export type DetailedProduct = Product & {
  variants: (ProductVariant & { photos: VariantPhoto[] })[];
};

type CreateProduct = NewProduct & {
  variants: CreateProductVariant[];
  featuredImageId: string;
};

type CreateProductVariant = Omit<NewProductVariant, "productId"> & {
  photos: CreateProductVariantPhoto[];
};

type CreateProductVariantPhoto = Omit<NewVariantPhoto, "variantId"> & {
  sortOrder: number;
};

export abstract class ProductRepository {
  abstract getProduct(
    productId: string,
    isAdmin: boolean
  ): Promise<DetailedProduct | null>;
  abstract getProducts(filters: GetProductsQueryParams): Promise<{
    products: DetailedProduct[];
    nextCursor: number | null;
    totalCount: number;
  }>;

  abstract createProduct(product: CreateProduct): Promise<string>;
}

class ProductRepositoryImpl extends ProductRepository {
  private db;
  private products;
  private productVariants;
  private variantPhotos;

  constructor() {
    super();
    this.db = db;
    this.products = products;
    this.productVariants = productVariants;
    this.variantPhotos = variantPhotos;
  }

  override async getProduct(
    productId: string,
    isAdmin: boolean
  ): Promise<DetailedProduct | null> {
    // Get the product
    const products = await this.getProductsByIds([productId], isAdmin);
    if (products.length === 0) return null;

    // Get all variants and photos using our existing helper methods
    const variants = await this.getVariantsByProductIds([productId], isAdmin);
    const variantIds = variants.map((v) => v.id);
    const photos = await this.getPhotosByVariantIds(variantIds);

    // Build and return the detailed product
    const detailedProducts = this.buildDetailedProductsFromComponents(
      products,
      variants,
      photos
    );

    if (!isAdmin && detailedProducts[0].active === false) {
      console.debug("Product is inactive, returning null");
      return null;
    }

    return detailedProducts[0];
  }

  // Add this new helper method that includes an active check for products

  override getProducts(filters: GetProductsQueryParams): Promise<{
    products: DetailedProduct[];
    nextCursor: number | null;
    totalCount: number;
  }> {
    // Use a dedicated method to build filter conditions for better readability
    const conditions = this.buildProductFilterConditions(filters);

    // Split into two dedicated methods based on whether price filtering/sorting is needed
    if (this.needsPriceFiltering(filters)) {
      return this.getProductsWithPriceFiltering(conditions, filters);
    } else {
      return this.getProductsStandard(conditions, filters);
    }
  }

  private needsPriceFiltering(filters: GetProductsQueryParams): boolean {
    return (
      filters.minPrice !== undefined ||
      filters.maxPrice !== undefined ||
      filters.sortBy === "price"
    );
  }

  private buildProductFilterConditions(filters: GetProductsQueryParams): SQL[] {
    const conditions: SQL[] = [];

    // Basic filters
    if (!filters.isAdmin) {
      conditions.push(eq(this.products.active, true));
    } else {
      console.debug("~~ Admin filter applied");
      if (filters.active !== undefined) {
        console.debug("~~ Active filter applied", filters.active);
        conditions.push(eq(this.products.active, filters.active));
      }
      if (filters.createdAfter) {
        conditions.push(gte(this.products.createdAt, filters.createdAfter));
      }
      if (filters.createdBefore) {
        conditions.push(lte(this.products.createdAt, filters.createdBefore));
      }
      if (filters.updatedAfter) {
        conditions.push(gte(this.products.updatedAt, filters.updatedAfter));
      }
      if (filters.updatedBefore) {
        conditions.push(lte(this.products.updatedAt, filters.updatedBefore));
      }
    }
    conditions.push(eq(this.products.type, filters.productType));

    // Search filter
    if (filters.search) {
      conditions.push(
        or(
          ilike(this.products.title, `%${filters.search!}%`),
          ilike(this.products.description, `%${filters.search!}%`)
        ) as SQL
      );
    }

    if (filters.titleSearch) {
      conditions.push(
        ilike(this.products.title, `%${filters.titleSearch!}%`) as SQL
      );
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      conditions.push(arrayOverlaps(this.products.tags, filters.tags));
    }

    return conditions;
  }

  private async getProductsStandard(
    conditions: SQL[],
    filters: GetProductsQueryParams
  ): Promise<{
    products: DetailedProduct[];
    nextCursor: number | null;
    totalCount: number;
  }> {
    // Get filtered products with count
    const productsResult = await this.db
      .select({
        id: this.products.id,
        count: sql<number>`count(*) OVER()`.as("count"),
      })
      .from(this.products)
      .where(and(...conditions))
      .orderBy(this.getOrderByExpression(filters))
      .limit(filters.limit)
      .offset(filters.cursor);

    return this.processProductResults(productsResult, filters);
  }

  private async getProductsWithPriceFiltering(
    baseConditions: SQL[],
    filters: GetProductsQueryParams
  ): Promise<{
    products: DetailedProduct[];
    nextCursor: number | null;
    totalCount: number;
  }> {
    // Build featured variant subquery
    const featuredVariant = this.buildFeaturedVariantSubquery(filters.isAdmin);

    // Add price range conditions
    const conditions = [...baseConditions];
    this.addPriceRangeConditions(conditions, featuredVariant, filters);

    // Get filtered products with price info for sorting
    const productsResult = await this.db
      .select({
        id: this.products.id,
        price: featuredVariant.price,
        count: sql<number>`count(*) OVER()`.as("count"),
      })
      .from(this.products)
      .innerJoin(
        featuredVariant,
        eq(this.products.id, featuredVariant.productId)
      )
      .where(and(...conditions))
      .orderBy(this.getOrderByExpression(filters, featuredVariant))
      .limit(filters.limit)
      .offset(filters.cursor);

    return this.processProductResults(productsResult, filters);
  }

  private buildFeaturedVariantSubquery(
    isAdmin: boolean
  ): FeaturedVariantSubquery {
    const activeVariantCondition = isAdmin
      ? sql`1=1`
      : eq(this.productVariants.active, true);

    return this.db
      .select({
        productId: this.productVariants.productId,
        price: this.productVariants.price,
      })
      .from(this.productVariants)
      .innerJoin(
        this.variantPhotos,
        eq(this.productVariants.id, this.variantPhotos.variantId)
      )
      .innerJoin(
        this.products,
        and(
          eq(this.productVariants.productId, this.products.id),
          eq(this.variantPhotos.id, this.products.thumbnailVariantPhotoId)
        )
      )
      .where(activeVariantCondition)
      .as("featured_variant");
  }

  private addPriceRangeConditions(
    conditions: SQL[],
    featuredVariant: FeaturedVariantSubquery,
    filters: GetProductsQueryParams
  ): void {
    if (filters.minPrice !== undefined) {
      conditions.push(gte(featuredVariant.price, filters.minPrice));
    }
    if (filters.maxPrice !== undefined) {
      conditions.push(lte(featuredVariant.price, filters.maxPrice));
    }
  }

  private getOrderByExpression(
    filters: GetProductsQueryParams,
    featuredVariant?: FeaturedVariantSubquery
  ): SQL {
    const { sortBy, sortOrder } = filters;
    const direction = sortOrder === "asc" ? asc : desc;

    if (sortBy === "price") {
      if (!featuredVariant)
        throw new Error("Featured variant is required for price sorting");
      return direction(featuredVariant.price);
    } else {
      return direction(this.products[sortBy]);
    }
  }

  private async processProductResults(
    productsResult: { id: string; count: number }[],
    filters: GetProductsQueryParams
  ): Promise<{
    products: DetailedProduct[];
    nextCursor: number | null;
    totalCount: number;
  }> {
    const productIds = productsResult.map((p) => p.id);
    const totalCount =
      productsResult.length > 0 ? Number(productsResult[0].count) : 0;

    // Get detailed products
    const detailedProducts = await this.getDetailedProductsByIds(
      productIds,
      filters.isAdmin
    );

    // Sort to match the original query order
    this.sortProductsToMatchQueryOrder(detailedProducts, productIds);

    // Calculate pagination
    const nextCursor = (filters.cursor || 0) + detailedProducts.length;
    const hasMore = nextCursor < totalCount;

    return {
      products: detailedProducts,
      nextCursor: hasMore ? nextCursor : null,
      totalCount,
    };
  }

  private sortProductsToMatchQueryOrder(
    products: DetailedProduct[],
    orderedIds: string[]
  ): void {
    const productIdOrder = Object.fromEntries(
      orderedIds.map((id, index) => [id, index])
    );

    products.sort((a, b) => {
      return productIdOrder[a.id] - productIdOrder[b.id];
    });
  }

  // Helper method to get detailed products by IDs efficiently
  private async getDetailedProductsByIds(
    productIds: string[],
    isAdmin: boolean = false
  ): Promise<DetailedProduct[]> {
    if (productIds.length === 0) {
      return [];
    }

    // Get all products
    const products = await this.getProductsByIds(productIds, isAdmin);

    // Get all variants with consideration for active status
    const variants = await this.getVariantsByProductIds(productIds, isAdmin);

    // Get all variant IDs
    const variantIds = variants.map((v) => v.id);

    // Get all photos for these variants
    const photos = await this.getPhotosByVariantIds(variantIds);

    // Build the detailed products
    return this.buildDetailedProductsFromComponents(products, variants, photos);
  }

  private getProductsByIds(
    productIds: string[],
    isAdmin: boolean = false
  ): Promise<Product[]> {
    const conditions = [inArray(this.products.id, productIds)];

    // Only filter by active status if not an admin
    if (!isAdmin) {
      conditions.push(eq(this.products.active, true));
    }

    return this.db
      .select()
      .from(this.products)
      .where(and(...conditions));
  }

  private getVariantsByProductIds(
    productIds: string[],
    isAdmin: boolean
  ): Promise<ProductVariant[]> {
    const variantConditions = [
      inArray(this.productVariants.productId, productIds),
    ];
    if (!isAdmin) {
      variantConditions.push(eq(this.productVariants.active, true));
    }

    return this.db
      .select()
      .from(this.productVariants)
      .where(and(...variantConditions));
  }

  private getPhotosByVariantIds(variantIds: string[]): Promise<VariantPhoto[]> {
    if (variantIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.db
      .select()
      .from(this.variantPhotos)
      .where(inArray(this.variantPhotos.variantId, variantIds));
  }

  private buildDetailedProductsFromComponents(
    products: Product[],
    variants: ProductVariant[],
    photos: VariantPhoto[]
  ): DetailedProduct[] {
    return products.map((product) => {
      const productVariants = variants
        .filter((variant) => variant.productId === product.id)
        .map((variant) => ({
          ...variant,
          photos: photos.filter((photo) => photo.variantId === variant.id),
        }));

      return {
        ...product,
        variants: productVariants,
      };
    });
  }

  override async createProduct(product: CreateProduct): Promise<string> {
    return await this.db.transaction(async (tx) => {
      const [insertedProduct] = await tx
        .insert(products)
        .values({
          title: product.title,
          description: product.description,
          thumbnailUrl: product.thumbnailUrl,
          active: product.active ?? true,
          metadata: product.metadata ?? {},
          tags: product.tags,
          type: product.type,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: products.id });

      const productId = insertedProduct.id;

      await tx.insert(assetReferences).values({
        url: product.thumbnailUrl,
        entityType: EntityEnum.ProductThumbnail,
        entityId: productId,
        active: true,
        createdAt: new Date(),
      });

      const newFeaturedImageUuid = crypto.randomUUID();

      for (const variant of product.variants) {
        const [insertedVariant] = await tx
          .insert(productVariants)
          .values({
            productId: productId,
            title: variant.title,
            price: variant.price,
            digitalAssetFileName: variant.digitalAssetFileName,
            digitalAssetSize: variant.digitalAssetSize,
            digitalAssetUrl: variant.digitalAssetUrl,
            active: variant.active ?? true,
            metadata: variant.metadata ?? {},
            sortOrder: variant.sortOrder ?? 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning({ id: productVariants.id });

        const variantId = insertedVariant.id;

        if (variant.digitalAssetUrl) {
          await tx.insert(assetReferences).values({
            url: variant.digitalAssetUrl,
            entityType: EntityEnum.DigitalAsset,
            entityId: variantId,
            active: true,
            createdAt: new Date(),
          });
        }

        const photosToInsert = variant.photos.map((photo) => {
          const featured = photo.id === product.featuredImageId;

          return {
            id: featured ? newFeaturedImageUuid : crypto.randomUUID(),
            variantId: variantId,
            url: photo.url,
            sortOrder: photo.sortOrder,
            createdAt: new Date(),
          };
        });

        const insertedPhotos = await tx
          .insert(variantPhotos)
          .values(photosToInsert)
          .returning({ id: variantPhotos.id, url: variantPhotos.url });

        const photoReferences = insertedPhotos.map((photo) => ({
          id: crypto.randomUUID(),
          url: photo.url,
          entityType: EntityEnum.VariantPhoto,
          entityId: variantId,
          active: true,
          createdAt: new Date(),
        }));

        await tx.insert(assetReferences).values(photoReferences);
      }

      await tx
        .update(products)
        .set({
          thumbnailVariantPhotoId: newFeaturedImageUuid,
        })
        .where(eq(products.id, productId));

      return productId;
    });
  }
}

export default ProductRepositoryImpl;
