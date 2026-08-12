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

export interface StoreDto {
  id?: number;
  storeName: string;
  storeCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  storeType: 'local' | 'minew';
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
  syncFromCloud: boolean;
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