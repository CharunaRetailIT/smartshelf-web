export interface GatewayDto {
  id: number;
  macAddress: string;
  name: string;
  description?: string;
  storeId: number;
  storeName?: string;
  minewGatewayId?: string;
  statusId: number;
  status?: string;
  gatewayType?: string;
  hardwareVersion?: string;
  firmwareVersion?: string;
  battery?: number;
  isOnline: boolean;
  lastSeen?: string;
  lastSyncTime?: string;
  isActive: boolean;
  createdDate: string;
  createdUser?: string;
  updatedUser?: string;
}

export interface CreateGatewayRequest {
  macAddress: string;
  name: string;
  description?: string;
  storeId: number;
  gatewayType?: string;
  hardwareVersion?: string;
  firmwareVersion?: string;
  battery?: number;
  statusId?: number;
  isActive?: boolean;
  createdUser: number;
}

export interface UpdateGatewayRequest {
  id: number;
  name: string;
  description?: string;
  battery?: number;
  isOnline: boolean;
  lastSeen?: string | null;
  isActive: boolean;
  updatedUser: number;
}

export interface GatewayPagedRequest {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  sortBy?: string;
  sortDescending?: boolean;
  storeId?: number;
  isOnline?: boolean;
  minBattery?: number;
  maxBattery?: number;
  lastSeenFrom?: string;
  lastSeenTo?: string;
  status?: string;
  gatewayType?: string;
}

export interface AddGatewayToMinewRequest {
  mac: string;
  name: string;
  storeId: string;
  userId: number;
}