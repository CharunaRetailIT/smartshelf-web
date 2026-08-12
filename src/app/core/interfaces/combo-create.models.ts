import { DeviceTemplateComboDto } from "./device.interface";

export interface DeviceSelectionModalData {
  storeId: number;
  selectedTemplate?: {
    id: string;
    name: string;
    screenSize: string;
  };
}

export interface TemplateSelectionModalData {
  storeId: number;
  selectedDevice?: {
    id: number;
    mac: string;
    deviceName: string;
    screenSize: string;
    status: string;
  };
}

export interface ComboCreationResult {
  success: boolean;
  combo?: DeviceTemplateComboDto;
  error?: string;
}