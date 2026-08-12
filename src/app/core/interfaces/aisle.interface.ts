import { Shelf } from "./shelf.interface";


export interface AisleMaster {
  id?: number;
  name: string;
  description: string;
  storeId?: number;
  storeName?: string;
  location: string;
  coordinates: string;
  isActive: boolean;
  createdDate?: Date;
  updatedDate?: Date;
  createdUser: number;
  updatedUser?: number;
  shelves?: Shelf[]
}
export interface ShelvesSummary {
  total: number;        // Total number of shelves in the aisle
  active: number;       // Number of active/enabled shelves
  inactive: number;     // Number of inactive/disabled shelves
  lastUpdated: Date;    // When the shelf data was last updated
}


export interface ProductSummaryRequest {
  aisleIds: number[];
  shelfIds: number[];
}

export interface ProductSummaryResponse {
  totalProductCount: number;
  aisles: AisleSummaryDto[];
}

export interface AisleSummaryDto {
  aisleId: number;
  aisleName: string;
  aisleLevelProducts: ProductDto[];
  shelves: ShelfSummaryDto[];
}

export interface ShelfSummaryDto {
  shelfId: number;
  shelfName: string;
  products: ProductDto[];
}

export interface ProductDto {
  productId: number;
  productName: string;
  productCode: string;
  sellingPrice: number;
  discountPrice: number;
}

export interface AssignmentIdsResponse {
  aisleIds: number[];
  shelfIds: number[];
}