CREATE TABLE "wedding_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digital_printables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" RENAME COLUMN "thumbnail_variant_photo_id" TO "thumbnailVariantPhotoId";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_thumbnail_variant_photo_id_variant_photos_id_fk";
--> statement-breakpoint
ALTER TABLE "wedding_invitation" ADD CONSTRAINT "wedding_invitation_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_printables" ADD CONSTRAINT "digital_printables_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_thumbnailVariantPhotoId_variant_photos_id_fk" FOREIGN KEY ("thumbnailVariantPhotoId") REFERENCES "public"."variant_photos"("id") ON DELETE no action ON UPDATE no action;