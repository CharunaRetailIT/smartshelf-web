export interface MinewDeviceDto {
  id: string;
  mac: string;
  deviceName: string;
  screenSize: string;
  firmware: string;
  hardware: string;
  status: string;
  battery: number;
  lastSeen: string;
  storeId: string;
  isOnline: boolean;
  screenInfo?: {
    inch: number;
    width: number;
    height: number;
    color: string;
  };
}

// Template DTOs
export interface MinewTemplateDto {
  id: string;
  name: string;
  description: string;
  screenInch: number;
  screenWidth: number;
  screenHeight: number;
  color: string;
  orientation: number;
  previewImage: string;
  storeId: string;
  isActive: boolean;
}

export type AssignmentDto =
  | TemplateAssignmentDto
  | MessageAssignmentDto;

export interface TemplateAssignmentDto {
  id: number;
  assignmentType: 'TEMPLATE';
  deviceTemplateComboId?: number | null;
  combo: DeviceTemplateComboDto;

  locationType: string;
  locationId: number;
  locationName?: string;
  displayOrder: number;
  isActive: boolean;
  createdDate: string;
  createdUser: string;
}

export interface MessageAssignmentDto {
  id: number;
  assignmentType: 'MESSAGE';
  deviceMessageComboId?: number | null;
  combo: DeviceMessageComboDto;

  locationType: string;
  locationId: number;
  locationName?: string;
  displayOrder: number;
  isActive: boolean;
  createdDate: string;
  createdUser: string;
}

export interface ComboBase {
  deviceId: number;
  deviceName: string;
  deviceMac: string;
  deviceHeight?: number;
  deviceWidth?: number;
  battery?: number;
}


export interface DeviceTemplateCombo extends ComboBase {
  templateId: string;
  templateName: string;
}

export interface DeviceMessageCombo extends ComboBase {
  messageId: number;
  messageTitle: string;
  messageContent: string;
}

export interface BindDataRequest {
  storeId: string;
  labelMac: string;
  goodsMap?: Record<string, string>;
  demoIdMap: {
    A: string;
    B?: string;
  };
  color?: number;
  total?: number;
  period?: number;
  interval?: number;
  brightness?: number;
  opCode?: number;
}

// In your device.interface.ts or create a new one

export interface DeviceTemplateComboDto {
  id: number;
  deviceId: string;
  deviceName: string;
  deviceMac: string;
  deviceHeight: number;
  deviceWidth: number;
  templateId: string;
  templateName: string;
  screenSize: string;
  isDefault: boolean;
  createdAt: Date;
  status: string;
}

export interface CreateComboRequest {
  deviceId: number;
  templateId: string;
  isDefault?: boolean;
}

export interface EslBrandDto {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

export interface LocalDeviceDto {
  id: number;
  mac: string;
  ipAddress: string;
  networkName: string;
  deviceType: string;
  deviceName: string;
  screenSize: string;
  screenInch: number;
  screenWidth: number;
  screenHeight: number;
  screenColor: string;
  status: string;
  battery: number;
  firmware: string;
  hardware: string;
  lastSeen: string;
  storeId: string;
  storeName?: string;
  isOnline: boolean;
  isActive: boolean;
  screenId: number
  statusId: number
  createdDate: string
}

export interface LocalTemplateDto {
  id: string;
  name: string;
  description?: string;
  screenInch?: number;
  screenWidth?: number;
  screenHeight?: number;
  color?: string;
  orientation?: number;
  previewImage?: string;
  storeId?: string;
  isActive: boolean;
  syncDate: string;
  createdDate: string;
}

export interface BindShelfDataRequest {
  comboId: number;
  messageId: number;
  shelfId: number;
  shelfName?: string;
  shelfCode?: string;
  color?: number;
  total?: number;
  period?: number;
  interval?: number;
  brightness?: number;
}

export interface BindShelfResponse {
  message: string;
  response: any;
  goodsMap: any;
  messageTitle: string;
  imageUrl: string;
}

// device.interface.ts
export interface UnifiedBindDataRequest {
  comboId: number;
  // Which table comboId refers to. Defaults to TEMPLATE server-side; send
  // MESSAGE when the id came from a DeviceMessageCombos row, otherwise the
  // server resolves it against DeviceTemplateCombos and can bind the wrong
  // device (both tables have independent identity columns).
  comboType?: 'TEMPLATE' | 'MESSAGE';
  bindingType: 'product' | 'shelf'; // 'product' is default
  productId?: number;
  goodsMap?: { [key: string]: string };
  shelfId?: number;
  shelfName?: string;
  shelfCode?: string;
  messageId: number; // 0 means no image
  color?: number;
  total?: number;
  period?: number;
  interval?: number;
  brightness?: number;
}

interface Combo {
  id: number;
  deviceId: number;
  deviceName: string;
  deviceHeight?: number;
  deviceWidth?: number;
  deviceMac: string;
  templateId: string;
  templateName: string;
  screenWidth: number;
  screenHeight: number;
  screenInch: number;
  battery: number;
  isDefault: boolean;
  priority: number;
  createdDate: string;
  isActive: boolean;
}

export interface BatchAddDeviceRequest {
  storeId: string;
  macAddresses: string[];
  type?: number;
  userId?: number;
}

export interface BatchAddResult {
  success: boolean;
  message: string;
  addedCount: number;
  failedCount: number;
  results: { [key: string]: string };
}

export interface DeviceImportResult {
  macAddress: string;
  success: boolean;
  message: string;
}

export interface ImportPreview {
  macAddresses: string[];
  totalCount: number;
  validCount: number;
  invalidCount: number;
  invalidMacs: string[];
}

export interface BatchWakeResult {
  success: boolean;
  message: string;
  wokeCount: number;
  failedCount: number;
}
export interface BatchWakeDevicesRequest {
  storeId: string;
  macAddresses: string[];
  userId?: number;
}

export interface DelayedSyncRequest {
  storeId: string;
  delaySeconds?: number;
}

export interface EnhancedBatchAddResult extends BatchAddResult {
  wakeUpResult?: BatchWakeResult;
  wokenDevices?: string[];
  failedToWakeDevices?: string[];
  processedAt?: string;
}

export interface DeviceMessageComboDto {
  id: number;
  deviceId: number;
  messageId: number;
  displayOrder?: number;
  isActive: boolean;
  createdBy?: number;
  createdDate?: string;
  updatedBy?: number;
  updatedDate?: string;
  createdAt?: string;
  updatedAt?: string;

  deviceName?: string;
  messageTitle?: string;
  deviceMac?: string;
  messageContentType?: number;
  contentTypeName?: string;
  messageType?: string;
}

export interface DeviceMessageComboPagedRequest {
  pageNumber?: number;
  pageSize?: number;
  sortBy?: string;
  sortDescending?: boolean;
  searchTerm?: string;
  deviceId?: number;
  messageId?: number;
  isActive?: boolean;
  createdFrom?: Date | string;
  createdTo?: Date | string;
}

export interface DeviceAssignmentDto {
  id: number;
  assignmentType: 'TEMPLATE' | 'MESSAGE';

  deviceTemplateComboId?: number | null;
  deviceMessageComboId?: number | null;

  deviceId: number;
  deviceName: string;
  deviceMac: string;
  deviceHeight?: number;
  deviceWidth?: number;
  battery?: number;

  templateId?: string;
  templateName?: string;

  messageId?: number;
  messageTitle?: string;
  messageContent?: string;

  locationType: string;
  locationId: number;
  locationName?: string;

  storeId: number;
  storeName: string;

  displayOrder: number;
  isActive: boolean;

  createdDate: string;
  createdUserId: number;
  createdUser: string;

  updatedDate?: string;
  updatedUserId?: number;
  updatedUser?: string;

  //fields for frontend
  isTemplateAssignment: boolean;
  isMessageAssignment: boolean;
  comboName: string;
  deviceDisplay: string;
  displayName?: string; // for dropdown

}

export interface CreateDeviceRequest {
  macAddress: string;
  name: string;
  deviceType: 'Minew' | 'Standard';
  storeId: number;
  screenId?: number;
  ipAddress?: string;
  networkName?: string;
  firmware?: string;
  hardware?: string;
  battery?: number;
  statusId?: number;
  isActive?: boolean;
  createdUser?: number;
}

export interface UpdateDeviceRequest {
  id: number;
  macAddress?: string;
  name?: string;
  deviceType?: 'Minew' | 'Standard';
  storeId?: number;
  screenId?: number;
  ipAddress?: string;
  networkName?: string;
  firmware?: string;
  hardware?: string;
  battery?: number;
  statusId?: number;
  isActive?: boolean;
  updatedUser?: number;
}

export interface DeviceScreenDto {
  id: number;
  name: string;
  width: number;
  height: number;
  inch: number;
  screenTypeId: number;
  screenTypeName: string;
  aspectRatio: string;
  isActive: boolean;
  createdDate: string;
}