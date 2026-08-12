
export interface Shelf {
  id?: number;
  aisleId?: number;
  name: string;
  location: string;
  coordinates: string;
  storeId?: number;
  description: string;
  isActive: boolean;
  createdDate?: Date;
  updatedDate?: Date;
  createdUser: number;
  updatedUser?: number;
   assignments?: ShelfAssignment[];
}

export interface ShelfAssignmentBase {
  displayOrder: number;
  deviceMac: string;
}

export interface ShelfTemplateAssignment extends ShelfAssignmentBase {
  assignmentType: 'TEMPLATE';
  deviceTemplateComboId: number;
  templateName: string;
}

export interface ShelfMessageAssignment extends ShelfAssignmentBase {
  assignmentType: 'MESSAGE';
  deviceMessageComboId: number;
  messageTitle: string;
}

export type ShelfAssignment =
  | ShelfTemplateAssignment
  | ShelfMessageAssignment;


export interface ShelfImportResult {
  success: boolean;
  importedCount: number;
  errors: string[];
}

export interface ShelfFilter {
  searchTerm?: string;
  status?: 'all' | 'active' | 'inactive';
  location?: string;
}

export interface Category {
  id: number;
  categoryCode: string;
  categoryName: string;
  categoryDescription: string;
  storeId?: number;
  isActive: boolean,
  createdDate?: Date;
  updatedDate?: Date;
  createdUser: number;
  updatedUser?: number;
}

export interface ProductDeviceInfo {
  deviceName?: string;
  ipAddress?: string;
  networkName?: string;
  macAddress?: string;
}