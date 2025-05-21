ALTER TABLE "public"."products" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."product_type";--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('DIGITAL_PRINTABLE', 'WEDDING_INVITATION');--> statement-breakpoint
ALTER TABLE "public"."products" ALTER COLUMN "type" SET DATA TYPE "public"."product_type" USING "type"::"public"."product_type";