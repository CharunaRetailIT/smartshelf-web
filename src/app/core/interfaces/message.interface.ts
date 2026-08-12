
export interface Message {
  id: number;
  title: string;
  content_type: number; //'general' | 'image' | 'video' | 'custom_image';
  content_data?: string;
  fabric_js_data?: any;
  file_url?: string;
  thumbnail_url?: string;
  duration: number;
  storeId?: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  contentTypeString?: string;
}

export interface MessageWithUser {
  id: number;
  title: string;
  contentType: number;
  contentTypeName: string;
  contentData?: string;
  fabricJsData?: string;
  fileUrl?: string;
  duration: number;
  screenSizeId?: number;
  storeId?: number;
  isActive: boolean;
  createdUser: number;
  createdByName: string;
  createdDate: string;
}

export interface MessagePagedRequest {
  pageNumber?: number;
  pageSize?: number;
  sortBy?: string;
  sortDescending?: boolean;
  searchTerm?: string;
  title?: string;
  contentType?: number;
  isActive?: boolean;
  createdBy?: number;
  createdFrom?: Date | string;
  createdTo?: Date | string;
  updatedFrom?: Date | string;
  updatedTo?: Date | string;
  storeId?: number
}

export interface MessageComboForm {
  deviceId: number;
  messageId: number;
  displayOrder: number;
  isActive: boolean;
  isDefault?: boolean;
  deviceMessageComboId?: number;
}