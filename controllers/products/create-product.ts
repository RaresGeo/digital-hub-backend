import { Context } from "../../deps.ts";
import ProductRepository from "../../repository/product.ts";
import { FileService } from "../../http/file-manager.ts";

interface CreateProductForm {
  title: string;
  description: string;
  tags: string;
  variants: string; // JSON string
  photos: File[]; // Multiple files
}

interface Variant {}

function createProductHandler(
  productRepository: ProductRepository,
  fileService: FileService
) {
  return async (context: Context) => {
    try {
      const form = await context.request.body.formData();

      // Extract and validate form data
      const title = form.get("title") as string;
      const description = form.get("description") as string;
      const tags = JSON.parse(form.get("tags") as string) as string[];
      const variants = JSON.parse(form.get("variants") as string) as Array<{
        title: string;
        price: number;
        sortOrder: number;
      }>;

      // Get all photos
      const photos = form.getAll("photos") as File[];

      if (!title || !description || !variants.length || !photos.length) {
        context.response.status = 400;
        context.response.body = { error: "Missing required fields" };
        return;
      }

      // Upload photos and get URLs
      const photoUrls = await Promise.all(
        photos.map((photo) => fileService.uploadFile(photo))
      );

      // Create thumbnail from first photo
      const thumbnailUrl = await fileService.createThumbnail(photos[0]);

      // Assign photos to variants sequentially
      let photoIndex = 0;
      const variantsWithPhotos = variants.map((variant) => ({
        ...variant,
        photos: [
          {
            url: photoUrls[photoIndex++],
            sortOrder: 0,
          },
        ],
      }));

      const product = await productRepository.createProduct({
        title,
        description,
        tags,
        thumbnailUrl,
        isDraft: true,
        variants: variantsWithPhotos,
      });

      context.response.status = 201;
      context.response.body = product;
    } catch (error) {
      context.response.status = 500;
      context.response.body = { error: "Failed to create product" };
    }
  };
}

export default createProductHandler;
