export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  searchTerm?: string;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  hasResults: boolean;
}

export interface SearchParams {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  status?: string | number;
  sortBy?: string;
  sortDescending?: boolean;
  storeId?: number;
  brandId?: number;
  deviceId?: number;
  templateId?: string;
  locationType?: string;
  locationId?: number;
  isActive?: boolean;
  categoryId?: number;
  subcategoryId?: number;
}

export interface ComboSearchParams extends SearchParams {
  deviceId?: number;
  templateId?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface AssignmentSearchParams extends SearchParams {
  assignmentType?: 'TEMPLATE' | 'MESSAGE';
  deviceTemplateComboId?: number;
  deviceMessageComboId?: number;
  locationType?: string;
  locationId?: number;
  storeId?: number;
}


export interface BasePagedRequest {
  pageNumber?: number;      // default = 1
  pageSize?: number;        // default = 10
  sortBy?: string;
  sortDescending?: boolean;
  searchTerm?: string;
}