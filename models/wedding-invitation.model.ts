import { pgTable, uuid } from "drizzle-orm/pg-core";
import { products } from "./product.model.ts";

export const weddingInvitation = pgTable("wedding_invitation", {
  id: uuid("id").primaryKey().defaultRandom(),
  product_id: uuid("product_id")
    .notNull()
    .references(() => products.id),
});
