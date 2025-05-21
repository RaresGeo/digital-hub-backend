interface ProductVariantPhoto {
  id: string;
  url: string;
  sortOrder: number;
  featured: boolean;
}

interface ProductVariantAsset {
  url: string | null;
  name: string;
  type: string;
  size: number;
}

interface ProductVariant {
  id: string;
  title: string;
  price: number;
  digitalAsset?: ProductVariantAsset | undefined;
  active?: boolean;
  sortOrder: number;
  photos: ProductVariantPhoto[];
  // metadata: Record<string, any>;
}

interface Product {
  id: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl: string;
  featuredImageId: string;
  variants: ProductVariant[];
  active?: boolean;
}

interface ProductListItem {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnailUrl: string;
  tags: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  active: boolean;
}

export type {
  ProductListItem,
  Product,
  ProductVariant,
  ProductVariantPhoto,
  ProductVariantAsset,
};
