export interface DeviceScreenDimension {
  id: number;
  deviceId: string; 
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
  refreshRate: number;
  colorDepth: number;
  pixelDensity: number;
  createdDate: Date;
  updatedDate?: Date;
  createdUser: number;
  updatedUser?: number;
  isActive: boolean;
}

export interface CreateDeviceScreenDimensionRequest {
  deviceId: number;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
  refreshRate?: number;
  colorDepth?: number;
  pixelDensity?: number;
  createdUser: number;
}

export interface UpdateDeviceScreenDimensionRequest {
  screenWidth?: number;
  screenHeight?: number;
  orientation?: 'portrait' | 'landscape';
  refreshRate?: number;
  colorDepth?: number;
  pixelDensity?: number;
  updatedUser: number;
}

export interface DeviceScreenDimensionResponse {
  id: number;
  deviceId: string;
  deviceName: string;
  screenWidth: number;
  screenHeight: number;
  orientation: string;
  refreshRate: number;
  colorDepth: number;
  pixelDensity: number;
  screenSize: string; // e.g., "800x600"
  aspectRatio: string; // e.g., "4:3"
  createdDate: Date;
  updatedDate?: Date;
  isActive: boolean;
}