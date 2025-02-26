import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  email: text("email").primaryKey().notNull(),
  name: text("name").notNull(),
  picture: text("picture").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastLogin: timestamp("last_login").notNull().defaultNow(),
  lastIp: text("last_ip").notNull(),
  lastUserAgent: text("last_user_agent").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isDeleted: integer("is_deleted").notNull(),
  googleId: text("google_id").notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
