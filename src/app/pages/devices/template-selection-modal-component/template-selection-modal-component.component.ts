// template-selection-modal.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { DeviceService } from '../../../core/services/device.service';
import {
  TemplateSelectionModalData,
  ComboCreationResult,
} from '../../../core/interfaces/combo-create.models';

@Component({
  selector: 'app-template-selection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  template: `
    <div
      class="bg-white rounded-lg shadow-xl w-full max-w-5xl mx-auto flex flex-col"
      style="height: 90vh;"
    >
      <!-- Dialog Header -->
      <div
        class="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0"
      >
        <div>
          <h2 class="text-xl font-semibold text-gray-900">
            Select Template for Device
          </h2>
          <p class="text-sm text-gray-500 mt-1">
            Choose a display template to create a device-template combination
          </p>
        </div>
        <button
          (click)="close()"
          class="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-2"
          aria-label="Close dialog"
        >
          <i class="fas fa-times text-lg"></i>
        </button>
      </div>

      <!-- Dialog Content -->
      <div class="flex flex-col flex-1 min-h-0">
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- Device Information Section -->
          <div class="space-y-4" *ngIf="data.selectedDevice">
            <h3
              class="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2"
            >
              Device Information
            </h3>

            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <i class="fas fa-desktop text-blue-500"></i>
                    <span class="font-medium text-sm text-gray-900">{{
                      data.selectedDevice.deviceName || 'Unnamed Device'
                    }}</span>
                    <span
                      [class]="getStatusBadgeClass(data.selectedDevice.status)"
                      class="px-2 py-1 rounded-full text-xs font-medium"
                    >
                      {{ data.selectedDevice.status }}
                    </span>
                  </div>
                  <div class="text-xs text-gray-600 mt-2 space-y-1">
                    <div class="flex items-center gap-2">
                      <span class="font-medium">MAC Address:</span>
                      <span class="font-mono">{{
                        data.selectedDevice.mac
                      }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-medium">Screen Size:</span>
                      <span>{{ data.selectedDevice.screenSize }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Search & Filter Section -->
          <div class="space-y-4">
            <h3
              class="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2"
            >
              Available Templates
            </h3>

            <div class="relative">
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
              >
                <i class="fas fa-search text-gray-400"></i>
              </div>
              <input
                type="text"
                class="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                placeholder="Search templates by name or ID..."
                [(ngModel)]="searchTerm"
                (input)="filterTemplates()"
              />
            </div>
          </div>

          <!-- Templates Grid -->
          <div class="space-y-4">
            <div *ngIf="loading" class="flex items-center justify-center py-12">
              <div class="text-center">
                <div
                  class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"
                ></div>
                <p class="text-sm text-gray-600">Loading templates...</p>
              </div>
            </div>

            <div
              *ngIf="!loading && filteredTemplates.length === 0"
              class="text-center py-12"
            >
              <i class="fas fa-folder-open text-4xl text-gray-300 mb-4"></i>
              <p class="text-gray-600 font-medium">No templates found</p>
              <p class="text-sm text-gray-500 mt-1">
                Please sync templates from cloud first or adjust your search
                criteria.
              </p>
            </div>

            <div
              *ngIf="!loading && filteredTemplates.length > 0"
              class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <div
                *ngFor="let template of filteredTemplates"
                class="template-card border-2 rounded-lg overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg"
                [class.border-blue-500]="selectedTemplate?.id === template.id"
                [class.border-gray-200]="selectedTemplate?.id !== template.id"
                [class.bg-blue-50]="selectedTemplate?.id === template.id"
                [class.bg-white]="selectedTemplate?.id !== template.id"
                (click)="selectTemplate(template)"
              >
                <!-- Template Preview Image -->
                <div
                  class="template-preview bg-gray-100 flex items-center justify-center"
                  style="height: 160px;"
                >
                  <img
                    *ngIf="template.previewImage"
                    [src]="template.previewImage"
                    alt="Preview"
                    class="w-full h-full object-contain"
                  />
                  <div *ngIf="!template.previewImage" class="text-center py-8">
                    <i class="fas fa-image text-4xl text-gray-300 mb-2"></i>
                    <p class="text-xs text-gray-500">No preview available</p>
                  </div>
                </div>

                <!-- Template Details -->
                <div class="p-4">
                  <div class="flex items-start justify-between mb-2">
                    <h4
                      class="font-medium text-sm text-gray-900 line-clamp-2 flex-1"
                    >
                      {{ template.demoName || 'Unnamed Template' }}
                    </h4>
                    <div class="ml-2">
                      <input
                        type="radio"
                        class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                        [checked]="selectedTemplate?.id === template.id"
                        (click)="
                          $event.stopPropagation(); selectTemplate(template)
                        "
                      />
                    </div>
                  </div>

                  <div class="space-y-1 text-xs text-gray-600">
                    <div
                      class="flex items-center gap-2"
                      *ngIf="template.screenSize"
                    >
                      <i class="fas fa-desktop text-gray-400"></i>
                      <span
                        >{{ template.screenSize?.width }}x{{
                          template.screenSize?.height
                        }}</span
                      >
                    </div>
                    <div class="flex items-center gap-2" *ngIf="template.id">
                      <i class="fas fa-tag text-gray-400"></i>
                      <span class="font-mono">{{ template.id }}</span>
                    </div>
                  </div>

                  <div
                    *ngIf="selectedTemplate?.id === template.id"
                    class="mt-3 pt-3 border-t border-blue-200"
                  >
                    <div class="flex items-center text-xs text-blue-600">
                      <i class="fas fa-check-circle mr-1"></i>
                      <span class="font-medium">Selected</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Selected Template Details -->
          <div *ngIf="selectedTemplate && !loading" class="space-y-4">
            <h3
              class="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2"
            >
              Selected Template
            </h3>

            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
              <div class="flex items-start gap-4">
                <div
                  *ngIf="selectedTemplate.previewImage"
                  class="flex-shrink-0"
                >
                  <img
                    [src]="selectedTemplate.previewImage"
                    alt="Selected Template"
                    class="w-24 h-24 object-contain rounded border border-green-300"
                  />
                </div>
                <div
                  *ngIf="!selectedTemplate.previewImage"
                  class="flex-shrink-0 w-24 h-24 bg-gray-100 rounded border border-green-300 flex items-center justify-center"
                >
                  <i class="fas fa-palette text-2xl text-gray-400"></i>
                </div>
                <div class="flex-1">
                  <h4 class="font-medium text-gray-900 mb-2">
                    {{ selectedTemplate.demoName }}
                  </h4>
                  <div class="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <span class="font-medium">Template ID:</span>
                      <span class="ml-1 font-mono">{{
                        selectedTemplate.id
                      }}</span>
                    </div>
                    <div *ngIf="selectedTemplate.screenSize">
                      <span class="font-medium">Resolution:</span>
                      <span class="ml-1"
                        >{{ selectedTemplate.screenSize?.width }}x{{
                          selectedTemplate.screenSize?.height
                        }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-purple-50 border border-purple-200 rounded-md p-3">
              <div class="flex">
                <i
                  class="fas fa-info-circle text-purple-400 mt-0.5 text-lg"
                ></i>
                <div class="ml-3">
                  <p class="text-sm text-purple-700">
                    <strong>Note:</strong> Creating a combo will link this
                    template with the selected device. The device will be able
                    to display content using this template format.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Dialog Actions -->
        <div
          class="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0"
        >
          <button
            type="button"
            (click)="close()"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <i class="fas fa-times mr-2"></i>
            Cancel
          </button>
          <button
            type="button"
            (click)="createCombo()"
            [disabled]="!selectedTemplate || creatingCombo"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <i *ngIf="creatingCombo" class="fas fa-spinner fa-spin"></i>
            <i *ngIf="!creatingCombo" class="fas fa-link"></i>
            {{ creatingCombo ? 'Creating Combo...' : 'Create Combo' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      /* Custom scrollbar */
      .flex-1.overflow-y-auto::-webkit-scrollbar {
        width: 8px;
      }

      .flex-1.overflow-y-auto::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 4px;
      }

      .flex-1.overflow-y-auto::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }

      .flex-1.overflow-y-auto::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }

      /* Template card hover effect */
      .template-card {
        transition: all 0.2s ease-in-out;
      }

      .template-card:hover {
        transform: translateY(-2px);
      }

      /* Line clamp utility */
      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* Animation for spinner */
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .animate-spin {
        animation: spin 1s linear infinite;
      }

      /* Focus states */
      input:focus,
      button:focus {
        outline: none;
      }

      /* Responsive adjustments */
      @media (max-width: 768px) {
        .grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3 {
          grid-template-columns: 1fr;
        }

        .max-w-5xl {
          max-width: 95vw;
          margin: 0 10px;
        }
      }

      /* Transition utilities */
      .transition-all {
        transition-property: all;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        transition-duration: 200ms;
      }

      .transition-colors {
        transition-property: color, background-color, border-color;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        transition-duration: 150ms;
      }
    `,
  ],
})
export class TemplateSelectionModalComponent implements OnInit {
  templates: any[] = [];
  filteredTemplates: any[] = [];
  selectedTemplate: any = null;
  searchTerm: string = '';
  loading: boolean = false;
  creatingCombo: boolean = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: TemplateSelectionModalData,
    private dialogRef: MatDialogRef<TemplateSelectionModalComponent>,
    private deviceService: DeviceService,
  ) {}

  ngOnInit() {
    this.loadTemplates();
  }

  loadTemplates() {
    this.loading = true;
    if (this.data.storeId) {
      this.deviceService.syncTemplatesFromCloud(this.data.storeId).subscribe({
        next: (templates) => {
          this.templates = templates;
          this.filteredTemplates = templates;
          this.loading = false;
          this.loadTemplatePreviews();
        },
        error: (error) => {
          console.error('Failed to load templates:', error);
          this.loading = false;
        },
      });
    }
  }

  loadTemplatePreviews() {
    this.templates.forEach((template) => {
      this.deviceService.getTemplatePreview(template.id).subscribe({
        next: (previewImage) => {
          template.previewImage = previewImage;
        },
        error: (error) => {
          console.error(
            'Failed to load preview for template:',
            template.id,
            error,
          );
        },
      });
    });
  }

  filterTemplates() {
    if (!this.searchTerm.trim()) {
      this.filteredTemplates = [...this.templates];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredTemplates = this.templates.filter(
      (template) =>
        template.demoName?.toLowerCase().includes(term) ||
        template.id?.toLowerCase().includes(term),
    );
  }

  selectTemplate(template: any) {
    this.selectedTemplate = template;
  }

  createCombo() {
    if (!this.selectedTemplate || !this.data.selectedDevice) {
      return;
    }

    this.creatingCombo = true;
    this.deviceService
      .createDeviceTemplateCombo(
        this.data.selectedDevice.id,
        this.selectedTemplate.id,
      )
      .subscribe({
        next: (combo) => {
          const result: ComboCreationResult = {
            success: true,
            combo: combo,
          };
          this.dialogRef.close(result);
        },
        error: (error) => {
          const result: ComboCreationResult = {
            success: false,
            error: error.message,
          };
          this.dialogRef.close(result);
          this.creatingCombo = false;
        },
      });
  }

  getStatusBadgeClass(status: string): string {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status?.toLowerCase()) {
      case 'online':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'offline':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  }

  close() {
    this.dialogRef.close({ success: false });
  }
}
