import {
  AnyPgColumn,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export enum ProductType {
  DigitalPrintable = "DIGITAL_PRINTABLE",
  WeddingInvitation = "WEDDING_INVITATION",
}

export const productTypeEnum = pgEnum(
  "product_type",
  Object.values(ProductType) as [ProductType, ...ProductType[]]
);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  thumbnailVariantPhotoId: uuid("thumbnail_variant_photo_id").references(
    (): AnyPgColumn => variantPhotos.id
  ),
  active: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata").default({}).notNull(),
  tags: text("tags").array(),
  type: productTypeEnum("type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  title: text("title").notNull(),
  price: integer("price").notNull(),
  digitalAssetFileName: text("digital_asset_file_name").notNull(),
  digitalAssetSize: integer("digital_asset_size").notNull(),
  digitalAssetUrl: text("digital_asset_url").notNull(),
  active: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata").default({}).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;

export const variantPhotos = pgTable("variant_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => productVariants.id),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type VariantPhoto = typeof variantPhotos.$inferSelect;
export type NewVariantPhoto = typeof variantPhotos.$inferInsert;
