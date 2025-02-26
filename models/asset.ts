import {
  pgEnum,
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const entityEnum = pgEnum("entity_type", [
  "product_thumbnail",
  "variant_photo",
  "digital_asset",
]);

export const assetReferences = pgTable("asset_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  entityType: entityEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
