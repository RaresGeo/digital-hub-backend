import { DetailedProduct } from "../../repository/product.repository.ts";
import { Logger } from "../../utils/logger.ts";
import { Product, ProductListItem } from "../product.dto.ts";

function mapToProductListItem(
  product: DetailedProduct,
  logger: Logger
): ProductListItem {
  const variant = product.variants.find(({ photos }) =>
    photos.some(({ id }) => id === product.thumbnailVariantPhotoId)
  );

  if (!variant) {
    logger.debug("No variant found for product", {
      productId: product.id,
      thumbnailVariantPhotoId: product.thumbnailVariantPhotoId,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        photos: variant.photos.map((photo) => ({
          id: photo.id,
        })),
      })),
    });
    throw new Error(
      "Unable to map product to list item, dirty state, can't match variant with thumbnail"
    );
  }

  return {
    id: product.id,
    title: product.title,
    description: product.description,
    price: variant.price,
    thumbnailUrl: variant.photos.find(
      ({ id }) => id === product.thumbnailVariantPhotoId
    )!.url,
    tags: product.tags,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    active: product.active,
  };
}

function getFileTypeFromFileName(fileName: string): string {
  // Find the last dot in the file name, then split from there
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return "unknown";
  }

  const fileExtension = fileName.slice(lastDotIndex + 1).toLowerCase();
  switch (fileExtension) {
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
      return "image";
    case "pdf":
      return "pdf";
    case "zip":
      return "zip";
    case "mp4":
      return "video";
    case "mp3":
      return "audio";
    default:
      return "unknown";
  }
}

function mapToProduct(
  product: DetailedProduct,
  logger: Logger,
  isAdmin: boolean = false
): Product {
  if (!product.thumbnailVariantPhotoId) {
    logger.debug("No thumbnail variant photo id found for product", {
      productId: product.id,
    });
    throw new Error(
      "Unable to map product, missing thumbnail variant photo id"
    );
  }

  const variants = product.variants.map((variant) => {
    const photos = variant.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      sortOrder: photo.sortOrder,
      featured: photo.id === product.thumbnailVariantPhotoId,
    }));

    const digitalAsset = {
      url: variant.digitalAssetUrl,
      name: variant.digitalAssetFileName,
      type: getFileTypeFromFileName(variant.digitalAssetFileName),
      size: variant.digitalAssetSize,
    };

    return {
      id: variant.id,
      title: variant.title,
      price: variant.price,
      ...(isAdmin ? { digitalAsset } : {}),
      ...(isAdmin
        ? {
            active: variant.active,
          }
        : {}),
      sortOrder: variant.sortOrder,
      photos,
    };
  });

  return {
    id: product.id,
    title: product.title,
    description: product.description,
    tags: product.tags ?? [],
    thumbnailUrl: product.thumbnailUrl,
    featuredImageId: product.thumbnailVariantPhotoId,
    variants,
  };
}

export { mapToProductListItem, mapToProduct };
