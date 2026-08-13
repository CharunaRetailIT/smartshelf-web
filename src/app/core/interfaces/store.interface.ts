export interface Store {
  id: number;
  storeName: string;
  storeCode: string;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
  storeType: string;
  minewStoreId?: string;
  minewTemplateId?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  isSynced: boolean;
  lastSyncDate?: Date;
  syncStatus: string;
  createdDate: Date;
  updatedDate?: Date;
  deviceCount: number;
}

export interface StoreLookup {
  id: number;
  storeName: string;
  storeCode?: string;
}

export interface StoreDto {
  id?: number;
  storeName: string;
  // Minew rejects a blank number or address on store/add, and every store is
  // published to Minew, so these are mandatory.
  storeCode: string;
  address: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  minewStoreId?: string;
  minewTemplateId?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  isSynced?: boolean;
  createdUser?: number;
}

export interface StoreFilterParams {
  searchTerm?: string;
  storeType?: string;
  isActive?: boolean;
  isSynced?: boolean;
  createdFrom?: Date;
  createdTo?: Date;
  pageNumber: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: string;
}

export interface StoreSyncRequest {
  // Push-only: local stores are published to Minew, never pulled down.
  syncToCloud: boolean;
  storeIds?: number[];
}

export interface StoreSyncResult {
  syncedCount: number;
  failedCount: number;
  messages: string[];
  details: StoreSyncDetail[];
  timestamp: Date;
}

export interface StoreSyncDetail {
  storeId: number;
  storeName: string;
  operation: string;
  message: string;
  timestamp: Date;
}