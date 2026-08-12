import { BasePagedRequest } from "./pagination-result.interface";

export interface QueueItem {
  id: number;
  aisle_id?: number;
  shelf_id?: number;
  product_id?: string;
  msg_id: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  display_order: number;
  message_title?: string;
  content_type?: string;
  aisle_name?: string;
  shelf_name?: string;
  product_name?: string;
}

// export interface CreateQueueRequest {
//   aisle_id?: number;
//   shelf_id?: number;
//   product_id?: string;
//   msg_id: number;
//   start_date: string;
//   end_date: string;
//   display_order: number;
// }


export interface QueueDto {
  id: number;
  queueType: string;
  deviceName: string;
  deviceType: string;
  locationType: string;
  locationName: string;

  productId?: number | null;
  productName?: string | null;

  shelfId?: number | null;
  shelfName?: string | null;

  templateName: string;
  messageTitle: string;

  startDate: Date;
  endDate?: Date | null;

  status: string;
  priority: string;

  isActive: boolean;
  isRecurring: boolean;
  recurrencePattern?: string | null;

  displayOrder: number;
  createdDate: Date;

  storeId: number;
  storeName: string;
}


export interface QueueDetailDto extends QueueDto {
  deviceMac: string;
  templateId: string;
  messageId?: number | null;

  contentData?: string | null;
  fileUrl?: string | null;
  duration?: number | null;

  bindingData?: string | null;
  errorMessage?: string | null;

  retryCount: number;
  lastAttempt?: Date | null;

  createdBy: string;
  updatedDate?: Date | null;
  updatedBy?: string | null;
}


export interface CreateQueueRequest {
  assignmentId?: number | null;   // From existing assignment
  deviceId?: number | null;       // For direct queue

  templateId?: string | null;     // For Minew
  messageId?: number | null;      // For Standard

  locationType: 'PRODUCT' | 'SHELF';
  locationId: number;

  startDate: Date;
  endDate?: Date | null;

  priorityId?: number | null;

  isRecurring: boolean;
  recurrencePattern?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;

  userId: number;
}


export interface CreateDirectQueueRequest {
  deviceId: number;

  // Minew
  templateId?: string | null;

  // Standard
  messageId?: number | null;

  locationType: 'PRODUCT' | 'SHELF';
  locationId: number;

  startDate: Date;
  endDate?: Date | null;

  priorityId?: number | null;

  isRecurring: boolean;
  recurrencePattern?: string | null;

  userId: number;

  queueType?: 'TEMPLATE_QUEUE' | 'MESSAGE_QUEUE';
}


export interface CreateQueueFromAssignmentRequest {
  assignmentId: number;

  startDate: Date;
  endDate?: Date | null;

  priorityId?: number | null;
  displayOrder?: number | null;

  isRecurring: boolean;
  recurrencePattern?: string | null;

  userId: number;
}


export interface UpdateQueueRequest {
  startDate?: Date | null;
  endDate?: Date | null;

  priorityId?: number | null;
  displayOrder?: number | null;

  isActive?: boolean | null;
  isRecurring?: boolean | null;

  recurrencePattern?: string | null;

  userId: number;
}


export interface QueuePagedRequest extends BasePagedRequest {
  storeId?: number | null;
  queueType?: string | null;
  status?: string | null;
  deviceId?: number | null;
  locationType?: string | null;
  locationId?: number | null;
  startDateFrom?: string | null;
  startDateTo?: string | null;
  isActive?: boolean | null;
}
export interface Priority {
  Id: number;
  PriorityCode: string;
  PriorityName: string;
  Description?: string;
  Value: number;
  ColorCode?: string;
  isActive: boolean;
  DisplayOrder: number;
}
