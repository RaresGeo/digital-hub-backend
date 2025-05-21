CREATE TYPE "public"."product_type" AS ENUM('digital_printable', 'wedding_invitation');--> statement-breakpoint
ALTER TABLE "digital_printables" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wedding_invitation" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "digital_printables" CASCADE;--> statement-breakpoint
DROP TABLE "wedding_invitation" CASCADE;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "digital_asset_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "type" "product_type" NOT NULL;