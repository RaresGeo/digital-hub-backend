ALTER TABLE "products" RENAME COLUMN "thumbnailVariantPhotoId" TO "thumbnail_variant_photo_id";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_thumbnailVariantPhotoId_variant_photos_id_fk";
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_thumbnail_variant_photo_id_variant_photos_id_fk" FOREIGN KEY ("thumbnail_variant_photo_id") REFERENCES "public"."variant_photos"("id") ON DELETE no action ON UPDATE no action;