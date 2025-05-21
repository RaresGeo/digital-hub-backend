import { Context } from "../../deps.ts";
import { ProductRepository } from "../../repository/product.repository.ts";
import { FileService } from "../../http/file-manager.ts";
import { createLogger } from "../../utils/logger.ts";
import { ProductType } from "../../db/schema.ts";

interface CreateProductForm {
  type: "DIGITAL_PRINTABLE" | "WEDDING_INVITATION";
  title: string;
  description: string;
  tags?: string[];
  variants: VariantFormData[];
  featuredImageId: string;
  active: boolean;
}

interface VariantFormData {
  id: string;
  title: string;
  price: number;
  sortOrder?: number;
  active: boolean;
  photos: VariantPhotoFormData[];
  digitalAsset: {
    filename: string;
    size: number;
  };
  metadata?: Record<string, unknown>;
}

interface VariantPhotoFormData {
  id: string;
  sortOrder: number;
}

interface VariantWithPhotos extends VariantFormData {
  photos: (VariantPhotoFormData & {
    url: string;
  })[];
  digitalAssetUrl: string;
}

interface VariantPhotoMap {
  [variantId: string]: { id: string; file: File }[];
}

interface VariantDigitalAssetMap {
  [variantId: string]: File;
}

interface UploadedPhotoMap {
  [variantIndex: string]: { id: string; url: string }[];
}

const moduleLogger = createLogger("ProductsCreateProduct");

/**
 * Parse the product data from form submission
 */
function parseProductData(
  form: FormData,
  logger: ReturnType<typeof moduleLogger.child>
): CreateProductForm | null {
  const productDataField = form.get("productData");
  if (!productDataField) {
    logger.warn("Missing productData field");
    return null;
  }

  try {
    const productData = JSON.parse(productDataField.toString());
    logger.debug("Parsed product data", {
      type: productData.type,
      title: productData.title,
      variantsCount: productData.variants?.length,
    });
    return productData;
  } catch (error) {
    logger.warn("Invalid productData JSON", {
      error: (error as Error)?.message,
    });
    return null;
  }
}

/**
 * Validate required fields in product data
 */
function validateRequiredFields(
  productData: CreateProductForm,
  logger: ReturnType<typeof moduleLogger.child>
): boolean {
  const { title, description, type, featuredImageId } = productData;

  const isValid = !!(title && description && type && featuredImageId);

  if (!isValid) {
    logger.debug("Missing required fields", {
      hasTitle: !!title,
      hasDescription: !!description,
      hasType: !!type,
    });
  }

  return isValid;
}

/**
 * Collect photos by variant from form data
 */
function collectVariantPhotos(
  form: FormData,
  variants: VariantFormData[],
  logger: ReturnType<typeof moduleLogger.child>
): VariantPhotoMap {
  const variantPhotos: VariantPhotoMap = {};

  for (const { id, photos } of variants) {
    variantPhotos[id] = [];
    for (const { id: photoId } of photos.sort(
      (a, b) => a.sortOrder - b.sortOrder
    )) {
      const key = `variant_photo_${id}_${photoId}`;
      const value = form.get(key);
      if (value instanceof File) {
        variantPhotos[id].push({ id: photoId, file: value });
      } else {
        logger.warn("Missing photo file", { key });
        throw new Error("Missing photo file");
      }
    }
  }

  logger.debug("Collected variant photos", {
    variantPhotoMap: Object.keys(variantPhotos).map((k) => ({
      variantIndex: k,
      photoCount: variantPhotos[k].length,
    })),
  });

  return variantPhotos;
}

function collectVariantDigitalAssets(
  form: FormData,
  variants: VariantFormData[],
  logger: ReturnType<typeof moduleLogger.child>
): VariantDigitalAssetMap {
  const variantDigitalAssets: VariantDigitalAssetMap = {};

  for (const { id } of variants) {
    const key = `variant_digital_asset_${id}`;
    const value = form.get(key);
    if (value instanceof File) {
      variantDigitalAssets[id] = value;
    } else {
      logger.warn("Missing digital asset file", { key });
      throw new Error("Missing digital asset file");
    }
  }

  logger.debug("Collected variant assets", {
    variantPhotoMap: Object.keys(variantDigitalAssets).map((k) => ({
      variantIndex: k,
      assetSize: variantDigitalAssets[k].size,
    })),
  });

  return variantDigitalAssets;
}

function getFeaturedImage(
  featuredImageId: string,
  variantPhotos: VariantPhotoMap
): File {
  for (const photos of Object.values(variantPhotos)) {
    const photo = photos.find((p) => p.id === featuredImageId);
    if (photo) return photo.file;
  }

  throw new Error("Featured image not found");
}

/**
 * Upload all variant photos to file service
 */
async function uploadVariantPhotos(
  variantPhotos: VariantPhotoMap,
  fileService: FileService,
  logger: ReturnType<typeof moduleLogger.child>
): Promise<UploadedPhotoMap> {
  const uploadedPhotos: UploadedPhotoMap = {};

  for (const [variantIndex, photos] of Object.entries(variantPhotos)) {
    logger.debug("Uploading photos for variant", {
      variantIndex,
      photoCount: photos.length,
    });

    uploadedPhotos[variantIndex] = [];

    for (const { id, file } of photos) {
      const url = await fileService.uploadFile(file);
      uploadedPhotos[variantIndex].push({ id, url });
      logger.debug("Uploaded photo", { variantIndex, url });
    }
  }

  return uploadedPhotos;
}

/**
 * Create digital assets for each variant
 */
async function createDigitalAssets(
  variantDigitalAssets: VariantDigitalAssetMap,
  fileService: FileService,
  logger: ReturnType<typeof moduleLogger.child>
): Promise<Record<string, string>> {
  const digitalAssets: Record<string, string> = {};

  for (const [variantId, asset] of Object.entries(variantDigitalAssets)) {
    const digitalAssetUrl = await fileService.uploadFile(asset);
    digitalAssets[variantId] = digitalAssetUrl;
    logger.debug("Created digital asset", { variantId, digitalAssetUrl });
  }

  return digitalAssets;
}

/**
 * Prepare variants with their photos and digital assets
 */
function prepareVariantsWithPhotos(
  variants: VariantFormData[],
  uploadedPhotos: UploadedPhotoMap,
  digitalAssets: Record<string, string>
): VariantWithPhotos[] {
  return variants.map((variant) => {
    const photos = uploadedPhotos[variant.id].map(({ id, url }) => ({
      id,
      url,
      sortOrder: variant.photos.find((p) => p.id === id)!.sortOrder,
    }));

    return {
      ...variant,
      photos,
      digitalAssetUrl: digitalAssets[variant.id],
    };
  });
}

function createProductHandler(
  productRepository: ProductRepository,
  fileService: FileService
) {
  return async (context: Context) => {
    const requestId = crypto.randomUUID();
    const logger = moduleLogger.child({
      requestId,
      ip: context.request.ip,
      path: context.request.url.pathname,
      handler: "createProductHandler",
    });

    logger.info("Handling product creation request");

    try {
      const form = await context.request.body.formData();
      logger.debug("Received form data", {
        formEntries: [...form.entries()].map((e) => e[0]),
      });

      // Parse product data
      const productData = parseProductData(form, logger);
      if (!productData) {
        context.response.status = 400;
        context.response.body = { error: "Invalid product data" };
        return;
      }

      // Validate required fields
      if (!validateRequiredFields(productData, logger)) {
        context.response.status = 400;
        context.response.body = { error: "Missing required fields" };
        return;
      }

      // Collect photos by variant
      const variantPhotos = collectVariantPhotos(
        form,
        productData.variants,
        logger
      );

      // Collect asset of each variant
      const variantDigitalAssets = collectVariantDigitalAssets(
        form,
        productData.variants,
        logger
      );

      // Get the featured image
      const featuredImage = getFeaturedImage(
        productData.featuredImageId,
        variantPhotos
      );

      // Upload the featured image (resized for thumbnail)
      const thumbnailUrl = await fileService.createThumbnail(featuredImage);

      // Upload all photos
      const uploadedPhotos = await uploadVariantPhotos(
        variantPhotos,
        fileService,
        logger
      );

      // Create digital assets for each variant
      const digitalAssets = await createDigitalAssets(
        variantDigitalAssets,
        fileService,
        logger
      );

      // Prepare variants with photos
      const variantsWithPhotos = prepareVariantsWithPhotos(
        productData.variants,
        uploadedPhotos,
        digitalAssets
      );

      // Create the product
      const productId = await productRepository.createProduct({
        type: productData.type as ProductType,
        title: productData.title,
        description: productData.description,
        thumbnailUrl: thumbnailUrl,
        tags: productData.tags,
        active: productData.active,
        variants: variantsWithPhotos.map((variant) => ({
          ...variant,
          digitalAssetFileName: variant.digitalAsset.filename,
          digitalAssetSize: variant.digitalAsset.size,
        })),
        featuredImageId: productData.featuredImageId,
      });

      logger.info("Successfully created product", { productId: productId });

      context.response.status = 201;
      context.response.body = { productId };
    } catch (error) {
      logger.logError("Error creating product", error);
      context.response.status = 500;
      context.response.body = { error: "Failed to create product" };
    }
  };
}
export default createProductHandler;
