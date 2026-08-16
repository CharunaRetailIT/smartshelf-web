import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MessageWithUser } from '../../../core/interfaces/message.interface';
import { QueueService } from '../../../core/services/queue.service';
import 'fabric';
import { Canvas } from 'fabric';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FabricCanvasService } from '../../../core/services/fabric-canvas.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  CustomSnackbarComponent,
  SnackbarData,
} from '../../../shared/components/alert/custom-snackbar.component';
import { SettingsService } from '../../../core/services/settings.service';
import { CustomMessageService } from '../../../core/services/message.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Dropdown } from 'primeng/dropdown';
import { DeviceService } from '../../../core/services/device.service';
import { ImportsModule } from '../../../imports/imports';
import { SearchParams } from '../../../core/interfaces/pagination-result.interface';
import { DeviceScreenDto } from '../../../core/interfaces/device.interface';

// Define screen size interface
interface ScreenSize {
  id: number;
  name: string;
  width: number;
  height: number;
  label: string;
  aspectRatio?: string;
}

@Component({
  selector: 'app-edit-message',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    ImportsModule,
  ],
  templateUrl: './edit-message.component.html',
  styleUrl: './edit-message.component.css',
})
export class EditMessageComponent implements OnInit, OnDestroy {
  @ViewChild('fabricCanvas') fabricCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('screenSizeDropdown') screenSizeDropdown!: Dropdown;

  editForm: FormGroup;
  messageData: MessageWithUser;
  isLoading = false;
  currentUserId!: number;
  storeId: number = 0;

  // Canvas and tools
  canvas: Canvas | null = null;
  activeToolCategory = 'shapes';
  hasSelection = false;
  selectedProperties: any = null;

  // File handling
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  videoPreview: string | null = null;

  // Screen sizes data
  screenSizes: ScreenSize[] = [];
  selectedScreenSize: ScreenSize | null = null;
  canvasWidth: number = 800;
  canvasHeight: number = 480;

  // PrimeNG Dropdown configuration
  screenSizeOptions: ScreenSize[] = [];
  selectedScreenSizeOption: ScreenSize | null = null;
  screenSizeLoading: boolean = false;
  screenSizeTotalRecords: number = 0;
  screenSizePageSize: number = 10;
  screenSizePageNumber: number = 1;
  screenSizeSearchTerm: string = '';
  screenSizeHasNextPage: boolean = false;
  screenSizeHasPreviousPage: boolean = false;
  screenSizeFilterTimeout: any;

  toolCategories = [
    { id: 'shapes', name: 'Shapes', icon: 'fas fa-shapes' },
    { id: 'colors', name: 'Colors', icon: 'fas fa-palette' },
    { id: 'layout', name: 'Layout', icon: 'fas fa-layer-group' },
  ];

  /** Add-text dialog, replacing the browser's prompt(). */
  showAddTextDialog = false;
  newTextValue = '';

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<EditMessageComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { message: MessageWithUser },
    private settingsService: SettingsService,
    private messageService: CustomMessageService,
    private primemessageService: MessageService,
    private fabricService: FabricCanvasService,
    public auth: AuthService,
    private snackBar: MatSnackBar,
    private deviceService: DeviceService,
    private confirmationService: ConfirmationService,
  ) {
    this.messageData = data.message;
    console.log('Received message data:', this.messageData);

    this.editForm = this.fb.group({
      title: [
        this.messageData.title,
        [Validators.required, Validators.maxLength(255)],
      ],
      contentData: [this.messageData.contentData || ''],
      duration: [
        this.messageData.duration,
        [Validators.required, Validators.min(1), Validators.max(300)],
      ],
      screenSizeId: [this.messageData.screenSizeId || '', Validators.required],
      isActive: [this.messageData.isActive || false],
    });
  }

  ngOnInit(): void {
    this.setDefaultStore();

    // Get current user
    this.auth.currentUser$.subscribe((user) => {
      if (user) {
        this.currentUserId = user.id;
      }
    });

    // Load screen sizes from API
    this.loadScreenSizes();

    // Initialize canvas for custom images
    if (this.messageData.contentType === 4) {
      setTimeout(() => {
        this.initFabricCanvas();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    if (this.canvas) {
      this.fabricService.dispose();
    }
    if (this.screenSizeFilterTimeout) {
      clearTimeout(this.screenSizeFilterTimeout);
    }
  }

  // Load screen sizes from API
  loadScreenSizes(params?: SearchParams): void {
    this.screenSizeLoading = true;

    const searchParams: SearchParams = {
      pageNumber: this.screenSizePageNumber,
      pageSize: this.screenSizePageSize,
      searchTerm: this.screenSizeSearchTerm,
      isActive: true,
    };

    this.deviceService.getDeviceScreensPaged(searchParams).subscribe({
      next: (response) => {
        const newSizes = response.items.map((screen: DeviceScreenDto) => ({
          id: screen.id,
          name: screen.name,
          width: screen.width,
          height: screen.height,
          aspectRatio: screen.aspectRatio,
          label: `${screen.name} - ${screen.width}x${screen.height}px`,
        }));

        if (this.screenSizePageNumber === 1) {
          this.screenSizeOptions = newSizes;
        } else {
          this.screenSizeOptions = [...this.screenSizeOptions, ...newSizes];
        }

        this.screenSizeTotalRecords = response.totalCount;
        this.screenSizeHasNextPage = response.hasNextPage;
        this.screenSizeHasPreviousPage = response.hasPreviousPage;

        // Set selected screen size if exists
        if (
          this.messageData.screenSizeId &&
          this.screenSizeOptions.length > 0
        ) {
          const selectedSize = this.screenSizeOptions.find(
            (s) => s.id === this.messageData.screenSizeId,
          );
          if (selectedSize) {
            this.selectedScreenSize = selectedSize;
            this.selectedScreenSizeOption = selectedSize;
            this.updateCanvasDimensions(selectedSize);
            this.editForm.patchValue({ screenSizeId: selectedSize.id });
          }
        }

        this.screenSizeLoading = false;
      },
      error: (error) => {
        console.error('Error loading screen sizes:', error);
        this.screenSizeLoading = false;
        this.showError('Failed to load screen sizes');
      },
    });
  }

  // Load more screen sizes
  loadMoreScreenSizes(): void {
    if (this.screenSizeHasNextPage) {
      this.screenSizePageNumber++;
      this.loadScreenSizes();
    }
  }

  // Load previous screen sizes
  loadPreviousScreenSizes(): void {
    if (this.screenSizeHasPreviousPage && this.screenSizePageNumber > 1) {
      this.screenSizePageNumber--;
      this.loadScreenSizes();
    }
  }

  // Handle dropdown filter/search
  onScreenSizeFilter(event: any): void {
    if (this.screenSizeFilterTimeout) {
      clearTimeout(this.screenSizeFilterTimeout);
    }

    this.screenSizeFilterTimeout = setTimeout(() => {
      this.screenSizeSearchTerm = event.filter;
      this.screenSizePageNumber = 1;
      this.loadScreenSizes();
    }, 500);
  }

  // Handle screen size selection
  onScreenSizeSelected(event: any): void {
    const selectedSize = this.screenSizeOptions.find(
      (s) => s.id === event.value,
    );
    if (selectedSize) {
      this.selectedScreenSize = selectedSize;
      this.selectedScreenSizeOption = selectedSize;
      this.updateCanvasDimensions(selectedSize);

      // Re-validate existing image file if dimensions changed
      if (
        this.selectedFile &&
        this.messageData.contentType === 2 &&
        this.imagePreview
      ) {
        this.validateSelectedImage(selectedSize);
      }
    }
  }

  // Update canvas dimensions based on selected screen size
  private updateCanvasDimensions(screenSize: ScreenSize): void {
    this.canvasWidth = screenSize.width;
    this.canvasHeight = screenSize.height;

    // Update canvas dimensions if it exists
    if (this.canvas && this.messageData.contentType === 4) {
      this.resizeCanvas(screenSize.width, screenSize.height);
    }
  }

  // Validate selected image against new screen size
  private validateSelectedImage(screenSize: ScreenSize): void {
    const img = new Image();
    img.onload = () => {
      if (img.width > screenSize.width || img.height > screenSize.height) {
        this.showError(
          `Current image (${img.width}x${img.height}) exceeds new screen size (${screenSize.width}x${screenSize.height}). Please select a new image.`,
        );
        this.selectedFile = null;
        this.imagePreview = null;
        if (this.fileInput) {
          this.fileInput.nativeElement.value = '';
        }
      }
    };
    img.src = this.imagePreview!;
  }

  resizeCanvas(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.setDimensions({
        width: width,
        height: height,
      });
      this.canvas.calcOffset();
      this.canvas.renderAll();
    }
  }

  canEdit(): boolean {
    return this.auth.hasAnyRole(['Admin', 'Manager', 'Operator']);
  }

  isReadOnlyMode(): boolean {
    return !this.canEdit();
  }

  getHeaderText(): string {
    if (!this.data?.message) {
      return 'Create Message';
    }

    return this.canEdit() ? 'Edit Message' : 'View Message';
  }

  getDescriptionText(): string {
    if (!this.data?.message) {
      return 'Update message information and configuration';
    }
    return this.canEdit()
      ? 'Update message information and configuration'
      : 'View message information and configuration';
  }

  private setDefaultStore(): void {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    if (currentStore) {
      this.storeId = currentStore.id;
    }
  }

  initFabricCanvas(): void {
    if (this.fabricCanvasRef?.nativeElement) {
      // Set canvas dimensions based on selected screen size
      const width = this.selectedScreenSize?.width || this.canvasWidth;
      const height = this.selectedScreenSize?.height || this.canvasHeight;

      this.canvas = this.fabricService.initCanvas(
        this.fabricCanvasRef.nativeElement,
        width,
        height,
      );

      // Load existing fabric data if available
      if (this.messageData.fabricJsData) {
        try {
          const fabricData = JSON.parse(this.messageData.fabricJsData);
          this.fabricService.loadCanvasData(fabricData);
        } catch (error) {
          console.error('Error loading fabric data:', error);
        }
      }

      this.updateSelectionState();

      // Listen for selection changes
      this.canvas.on('selection:created', () => this.updateSelectionState());
      this.canvas.on('selection:updated', () => this.updateSelectionState());
      this.canvas.on('selection:cleared', () => this.updateSelectionState());
    }
  }

  private updateSelectionState(): void {
    this.hasSelection = this.fabricService.hasSelection();
    this.selectedProperties = this.fabricService.getSelectedObjectProperties();
  }

  // Tool category management
  setActiveToolCategory(category: string): void {
    this.activeToolCategory = category;
  }

  // File handling
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      if (this.messageData.contentType === 2) {
        this.imagePreview = e.target.result;
      } else if (this.messageData.contentType === 3) {
        this.videoPreview = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  }

  // Canvas operations
  /**
   * Opens the add-text dialog. Cancelling now adds nothing - the old
   * `prompt()` fell through to 'Sample Text' when dismissed, so cancelling
   * still dropped a text object onto the canvas.
   */
  addText(): void {
    this.newTextValue = '';
    this.showAddTextDialog = true;
    this.focusAddTextInput();
  }

  confirmAddText(): void {
    const text = this.newTextValue.trim();
    if (!text) return;

    this.fabricService.addText(text);
    this.updateSelectionState();
    this.showAddTextDialog = false;
  }

  cancelAddText(): void {
    this.showAddTextDialog = false;
  }

  /**
   * Focus the field once the dialog has rendered.
   *
   * Two PrimeNG behaviours are worked around here. Its own `focusOnShow`
   * prefers the dialog *footer*, so it lands on Cancel - hence
   * [focusOnShow]="false". And its (onShow) event never fires in this app,
   * because it is emitted from an animation callback and app.config registers
   * both provideNoopAnimations() and provideAnimations(); so this is driven
   * from addText() on a timer rather than from the event.
   *
   * The input is looked up by id because it is projected into the dialog's
   * own view, where a @ViewChild on the host does not resolve it.
   */
  focusAddTextInput(): void {
    setTimeout(() => {
      const input = document.getElementById(
        'addTextValue',
      ) as HTMLInputElement | null;
      input?.focus();
    }, 150);
  }

  addRectangle(): void {
    this.fabricService.addRectangle();
    this.updateSelectionState();
  }

  addCircle(): void {
    this.fabricService.addCircle();
    this.updateSelectionState();
  }

  uploadImage(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.fabricService.addImage(e.target.result);
          this.updateSelectionState();
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  changeFillColor(color: string): void {
    this.fabricService.changeFillColor(color);
    this.updateSelectionState();
  }

  changeStrokeColor(color: string): void {
    this.fabricService.changeStrokeColor(color);
    this.updateSelectionState();
  }

  deleteSelected(): void {
    this.fabricService.deleteSelected();
    this.updateSelectionState();
  }

  clearCanvas(): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to clear the canvas?',
      header: 'Clear Canvas',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Clear',
      rejectLabel: 'Cancel',
      accept: () => {
        this.fabricService.clearCanvas();
        this.updateSelectionState();
      },
    });
  }

  duplicateSelected(): void {
    this.fabricService.duplicateSelected();
    this.updateSelectionState();
  }

  // Content type helpers
  getContentTypeIcon(): string {
    switch (this.messageData.contentType) {
      case 1:
        return 'fas fa-align-left';
      case 2:
        return 'fas fa-image';
      case 3:
        return 'fas fa-video';
      case 4:
        return 'fas fa-paint-brush';
      default:
        return 'fas fa-question';
    }
  }

  getContentTypeBackground(): string {
    switch (this.messageData.contentType) {
      case 1:
        return 'bg-blue-100';
      case 2:
        return 'bg-green-100';
      case 3:
        return 'bg-purple-100';
      case 4:
        return 'bg-orange-100';
      default:
        return 'bg-gray-100';
    }
  }

  getContentTypeIconColor(): string {
    switch (this.messageData.contentType) {
      case 1:
        return 'text-blue-600';
      case 2:
        return 'text-green-600';
      case 3:
        return 'text-purple-600';
      case 4:
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  }

  getContentTypeName(): string {
    switch (this.messageData.contentType) {
      case 1:
        return 'General Message';
      case 2:
        return 'Image Upload';
      case 3:
        return 'Video Upload';
      case 4:
        return 'Custom Design';
      default:
        return 'Unknown';
    }
  }

  // Form submission
  onSubmit(): void {
    console.log('on submit called?');
    if (this.editForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isLoading = true;
    const formData = this.editForm.value;

    switch (this.messageData.contentType) {
      case 1:
        this.updateGeneralMessage(formData);
        break;
      case 2:
        this.updateImageMessage(formData);
        break;
      case 3:
        this.updateVideoMessage(formData);
        break;
      case 4:
        this.updateCustomImageMessage(formData);
        break;
    }
  }

  private updateGeneralMessage(formData: MessageWithUser): void {
    const payload = {
      id: this.messageData.id,
      title: formData.title,
      contentData: formData.contentData,
      duration: formData.duration,
      screenSizeId: formData.screenSizeId,
      isActive: formData.isActive,
      UpdatedBy: this.currentUserId,
      StoreId: this.storeId,
    };
    console.log(payload);
    this.messageService.updateGeneralMessage(payload).subscribe({
      next: () => {
        this.showSuccess('General message updated successfully');
        this.dialogRef.close(true);
      },
      error: (error) => {
        this.showError('Failed to update message: ' + error.message);
        this.isLoading = false;
      },
    });
  }

  private updateImageMessage(formData: any): void {
    const updateData = new FormData();
    updateData.append('id', this.messageData.id.toString());
    updateData.append('title', formData.title);
    updateData.append('duration', formData.duration.toString());
    updateData.append('screenSizeId', formData.screenSizeId.toString());
    updateData.append('isActive', formData.isActive.toString());
    updateData.append('updatedBy', this.currentUserId.toString());
    updateData.append('storeId', this.storeId.toString());

    if (this.selectedFile) {
      updateData.append('image', this.selectedFile);
    }
    console.log('Update Data:', updateData);
    this.messageService.updateImageMessage(updateData).subscribe({
      next: () => {
        this.showSuccess('Image message updated successfully');
        this.dialogRef.close(true);
      },
      error: (error) => {
        this.showError('Failed to update image message: ' + error.message);
        this.isLoading = false;
      },
    });
  }

  private updateVideoMessage(formData: any): void {
    const updateData = new FormData();
    updateData.append('id', this.messageData.id.toString());
    updateData.append('title', formData.title);
    updateData.append('duration', formData.duration.toString());
    updateData.append('screenSizeId', formData.screenSizeId.toString());
    updateData.append('isActive', formData.isActive.toString());
    updateData.append('updatedBy', this.currentUserId.toString());
    updateData.append('storeId', this.storeId.toString());

    if (this.selectedFile) {
      updateData.append('video', this.selectedFile);
    }

    this.messageService.updateVideoMessage(updateData).subscribe({
      next: () => {
        this.showSuccess('Video message updated successfully');
        this.dialogRef.close(true);
      },
      error: (error) => {
        this.showError('Failed to update video message: ' + error.message);
        this.isLoading = false;
      },
    });
  }

  private updateCustomImageMessage(formData: any): void {
    if (!this.canvas) {
      this.showError('Canvas not initialized');
      this.isLoading = false;
      return;
    }

    const canvasData = this.fabricService.getCanvasData();
    const imageData = this.fabricService.exportAsImage();

    const messageData = {
      id: this.messageData.id,
      title: formData.title,
      fabric_js_data: JSON.stringify(canvasData),
      image_data: imageData,
      duration: formData.duration,
      screenSizeId: formData.screenSizeId,
      is_active: formData.isActive,
      updated_by: this.currentUserId,
      storeId: this.storeId,
    };

    this.messageService.updateCustomImageMessage(messageData).subscribe({
      next: () => {
        this.showSuccess('Custom image message updated successfully');
        this.dialogRef.close(true);
      },
      error: (error) => {
        this.showError(
          'Failed to update custom image message: ' + error.message,
        );
        this.isLoading = false;
      },
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.editForm.controls).forEach((key) => {
      this.editForm.get(key)?.markAsTouched();
    });
  }

  //#region Snackbar Methods
  private showSuccess(message: string): void {
    this.primemessageService.add({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 5000,
    });
  }

  private showError(message: string): void {
    this.primemessageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000,
    });
  }

  private showWarning(message: string): void {
    this.primemessageService.add({
      severity: 'warn',
      summary: 'Warning',
      detail: message,
      life: 5000,
    });
  }

  private showInfo(message: string): void {
    this.primemessageService.add({
      severity: 'info',
      summary: 'Info',
      detail: message,
      life: 5000,
    });
  }
  //#endregion
}
