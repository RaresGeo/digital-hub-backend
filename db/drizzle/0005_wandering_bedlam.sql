ALTER TABLE "products" ADD COLUMN "thumbnail_url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "thumbnail_variant_photo_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_thumbnail_variant_photo_id_variant_photos_id_fk" FOREIGN KEY ("thumbnail_variant_photo_id") REFERENCES "public"."variant_photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "is_draft";