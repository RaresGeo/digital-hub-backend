import {
  pgEnum,
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export enum EntityEnum {
  ProductThumbnail = "product_thumbnail",
  VariantPhoto = "variant_photo",
  DigitalAsset = "digital_asset",
}

export const entityEnum = pgEnum(
  "entity_type",
  Object.values(EntityEnum) as [EntityEnum, ...EntityEnum[]]
);

export const assetReferences = pgTable("asset_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  entityType: entityEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  active: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
