export interface ProductCategory {
  id: number;
  categoryName: string;
  categoryCode: string;
  categoryDescription: string;
  isActive: boolean;
  createdDate?: Date;
  updatedDate?: Date;
  createdUser?: number;
  updatedUser?: number;
  storeId?: number;
}

export interface ProductSubCategory {
  id: number;
  categoryId: number;
  subCategoryName: string;
  subCategoryCode: string;
  subCategoryDescription: string;
  isActive: boolean;
  createdDate?: Date;
  updatedDate?: Date;
  createdUser?: number;
  updatedUser?: number;
  storeId?: number;
}

export interface Product {
  id: number;
  productCode: string;
  barCode?: string;
  productName: string;
  quantity:number;
  unitOfMeasure: string;
  categoryId?: number;
  subCategoryId?: number;
  categoryName: string;
  subCategoryName: string;
  costPrice:number;
  sellingPrice: number;
  discountPrice: number;
  discountedPrice: number;
  discountPercentage:number;
  wholesalePrice: number;
  minimumPrice: number;
  maximumPrice: number;
  description: string;
  isActive: boolean;
  createdDate?: Date;
  updatedDate?: Date;
  createdUser?: number;
  updatedUser?: number;
  isSyncToCloud?: boolean;
  storeId?: number;
}

export interface ProductViewDto {
  id: number;
  productCode: string;
  barCode: string;
  productName: string;
  categoryName: string;
  subCategoryName: string;
  sellingPrice: number;
  discountPrice: number;
  discountedPrice: number;
  isActive: boolean;
}

export interface ImportProductsResult {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}


