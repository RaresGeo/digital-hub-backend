ALTER TABLE "variant_photos" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "thumbnail_url";