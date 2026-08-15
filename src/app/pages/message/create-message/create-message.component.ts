import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Message } from '../../../core/interfaces/message.interface';
import { FabricCanvasService } from '../../../core/services/fabric-canvas.service';
import { QueueService } from '../../../core/services/queue.service';
import 'fabric';
import { Canvas } from 'fabric';
import { MatInputModule } from '@angular/material/input';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import {
  CustomSnackbarComponent,
  SnackbarData,
} from '../../../shared/components/alert/custom-snackbar.component';
import { CustomMessageService } from '../../../core/services/message.service';
import { SettingsService } from '../../../core/services/settings.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Dropdown } from 'primeng/dropdown';
import { DeviceScreenDto } from '../../../core/interfaces/device.interface';
import { DeviceService } from '../../../core/services/device.service';
import { SearchParams } from '../../../core/interfaces/pagination-result.interface';
import { ImportsModule } from '../../../imports/imports';

// Define screen size interface
interface ScreenSize {
  id: number;
  name: string;
  width: number;
  height: number;
  label: string;
}

@Component({
  selector: 'app-create-message',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatInputModule,
    ImportsModule,
  ],
  templateUrl: './create-message.component.html',
  styleUrl: './create-message.component.css',
})
export class CreateMessageComponent implements OnInit, OnDestroy {
  @ViewChild('fabricCanvas') fabricCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('screenSizeDropdown') screenSizeDropdown!: Dropdown;

  messageForm: FormGroup;
  // General and Video message types are hidden for now. Flip to true to bring
  // them back - the cards, content sections, previews and submit paths for both
  // are all still in place.
  showGeneralAndVideoTypes = false;

  /** Add-text dialog, replacing the browser's prompt(). */
  showAddTextDialog = false;
  newTextValue = '';

  // Must default to a type that is actually offered, or the page opens on a
  // hidden type with no card selected and no matching content section.
  selectedMessageType: string = 'image';
  isLoading = false;
  canvas: Canvas | null = null;

  // Tool categories and selection state
  activeToolCategory: string = 'shapes';
  hasSelection: boolean = false;
  hasSelectedText: boolean = false;
  selectedProperties: any = null;

  // Canvas background
  canvasBackgroundColor: string = '#ffffff';

  // Preset colors for quick selection
  presetColors: string[] = [
    '#000000',
    '#FFFFFF',
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFFF00',
    '#FF00FF',
    '#00FFFF',
    '#800000',
    '#808000',
    '#008000',
    '#800080',
    '#008080',
    '#000080',
    '#C0C0C0',
    '#808080',
    '#FF9999',
    '#FFCC99',
    '#FFFF99',
    '#CCFF99',
    '#99FFCC',
    '#99CCFF',
    '#CC99FF',
    '#FF99CC',
  ];

  // Preview data
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  videoPreview: string | null = null;

  //user
  currentUserId!: number;

  //Default store
  storeId: number = 0;

  // Screen sizes from data
  screenSizes: ScreenSize[] = [];
  selectedScreenSize: ScreenSize | null = null;
  // PrimeNG Dropdown configuration
  screenSizeOptions: ScreenSize[] = [];
  selectedScreenSizeOption: ScreenSize | null = null;
  screenSizeLoading: boolean = false;
  screenSizeTotalRecords: number = 0;
  screenSizePageSize: number = 3;
  screenSizePageNumber: number = 1;
  screenSizeSearchTerm: string = '';
  screenSizeHasNextPage: boolean = false;
  screenSizeHasPreviousPage: boolean = false;
  screenSizeFilterTimeout: any;
  // screenSizes: ScreenSize[] = [
  //   { width: 212, height: 104, label: '212x104 (Small)' },
  //   { width: 250, height: 122, label: '250x122' },
  //   { width: 296, height: 128, label: '296x128' },
  //   { width: 384, height: 184, label: '384x184' },
  //   { width: 400, height: 300, label: '400x300 (Medium)' },
  //   { width: 800, height: 480, label: '800x480 (Large)' },
  //   { width: 1920, height: 1080, label: 'Full HD' }
  // ];

  canvasWidth: number = 800;
  canvasHeight: number = 480;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private settingsService: SettingsService,
    private messageService: CustomMessageService,
    private primemessageService: MessageService,
    private deviceService: DeviceService,
    private fabricService: FabricCanvasService,
    private snackBar: MatSnackBar,
    private confirmationService: ConfirmationService,
  ) {
    this.messageForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(255)]],
      content_data: [''],
      duration: [
        5,
        [Validators.required, Validators.min(1), Validators.max(300)],
      ],
      screenSize: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    // Initialize canvas after view init
    setTimeout(() => {
      if (this.fabricCanvasRef && this.selectedMessageType === 'custom_image') {
        this.initFabricCanvas();
      }
    }, 100);

    // Subscribe to current user
    this.auth.currentUser$.subscribe((user) => {
      if (user) {
        this.currentUserId = user.id;
      } else {
        this.snackBar.open(' User not authenticated', 'Close', {
          duration: 3000,
        });
      }
    });
    this.setDefaultStore();
    // Load initial screen sizes
    this.loadScreenSizes();
  }

  ngOnDestroy(): void {
    this.fabricService.dispose();
  }

  private setDefaultStore(): void {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    if (currentStore) {
      this.storeId = currentStore.id;
    }
  }

  onMessageTypeChange(type: string): void {
    this.selectedMessageType = type;
    this.resetForm();

    if (type === 'custom_image') {
      setTimeout(() => {
        this.initFabricCanvas();
      }, 100);
    } else {
      this.fabricService.dispose();
    }
  }

  // Load screen sizes
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

        // Set default if not selected and we have items
        if (!this.selectedScreenSize && newSizes.length > 0) {
          this.selectedScreenSize = newSizes[0];
          this.selectedScreenSizeOption = newSizes[0];
          this.updateCanvasDimensions(newSizes[0]);
          this.messageForm.patchValue({ screenSize: newSizes[0].id });
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
        this.selectedMessageType === 'image' &&
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
    if (this.canvas && this.selectedMessageType === 'custom_image') {
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

  // Handle screen size selection
  onScreenSizeChange(): void {
    const selectedLabel = this.messageForm.get('screenSize')?.value;
    const size = this.screenSizes.find((s) => s.label === selectedLabel);

    if (size) {
      this.selectedScreenSize = size;
      this.canvasWidth = size.width;
      this.canvasHeight = size.height;

      // Update canvas dimensions if it exists
      if (this.canvas && this.selectedMessageType === 'custom_image') {
        this.resizeCanvas(size.width, size.height);
      }

      // Re-validate existing image file if dimensions changed
      if (
        this.selectedFile &&
        this.selectedMessageType === 'image' &&
        this.imagePreview
      ) {
        const img = new Image();
        img.onload = () => {
          if (img.width > size.width || img.height > size.height) {
            this.showError(
              `Current image (${img.width}x${img.height}) exceeds new screen size (${size.width}x${size.height}). Please select a new image.`,
            );
            this.selectedFile = null;
            this.imagePreview = null;
            if (this.fileInput) {
              this.fileInput.nativeElement.value = '';
            }
          }
        };
        img.src = this.imagePreview;
      }
    }
  }
  // onScreenSizeChange(): void {
  //   const selectedLabel = this.messageForm.get('screenSize')?.value;
  //   const size = this.screenSizes.find(s => s.label === selectedLabel);

  //   if (size) {
  //     this.selectedScreenSize = size;
  //     this.canvasWidth = size.width;
  //     this.canvasHeight = size.height;

  //     // Update canvas dimensions if it exists
  //     if (this.canvas && this.selectedMessageType === 'custom_image') {
  //       this.resizeCanvas(size.width, size.height);
  //     }

  //     // Validate file dimensions if image/video is selected
  //     if (this.selectedFile && (this.selectedMessageType === 'image' || this.selectedMessageType === 'video')) {
  //       this.validateFileDimensions(this.selectedFile);
  //     }
  //   }
  // }
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

  validateFileDimensions(file: File): boolean {
    // Only validate images
    if (!file.type.match(/image\/(jpeg|png|gif|bmp|webp)/)) return true;

    let isValid = true;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        if (
          img.width > this.selectedScreenSize!.width ||
          img.height > this.selectedScreenSize!.height
        ) {
          this.showError(
            `Image dimensions (${img.width}x${img.height}) exceed selected screen size (${this.selectedScreenSize!.width}x${this.selectedScreenSize!.height}). Please select a new image or choose a larger screen size.`,
          );

          // Clear the file input
          if (this.fileInput) {
            this.fileInput.nativeElement.value = '';
          }
          isValid = false;
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    return isValid;
  }

  // validateFileDimensions(file: File): void {
  //   if (!file.type.match(/image\/(jpeg|png|gif|bmp|webp)/)) return;

  //   const reader = new FileReader();
  //   reader.onload = (e: any) => {
  //     const img = new Image();
  //     img.onload = () => {
  //       if (img.width > this.selectedScreenSize.width || img.height > this.selectedScreenSize.height) {
  //         this.showError(`Image dimensions (${img.width}x${img.height}) exceed selected screen size (${this.selectedScreenSize.width}x${this.selectedScreenSize.height}). Please select a smaller image or choose a larger screen size.`);
  //         this.selectedFile = null;
  //         this.imagePreview = null;
  //         if (this.fileInput) {
  //           this.fileInput.nativeElement.value = '';
  //         }
  //       }
  //     };
  //     img.src = e.target.result;
  //   };
  //   reader.readAsDataURL(file);
  // }

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
      this.updateSelectionState();

      // Listen for selection changes
      this.canvas.on('selection:created', () => this.updateSelectionState());
      this.canvas.on('selection:updated', () => this.updateSelectionState());
      this.canvas.on('selection:cleared', () => this.updateSelectionState());
    }
  }

  // initFabricCanvas(): void {
  //   if (this.fabricCanvasRef?.nativeElement) {
  //     // Set canvas dimensions based on selected screen size
  //     this.canvas = this.fabricService.initCanvas(
  //       this.fabricCanvasRef.nativeElement,
  //       this.canvasWidth,
  //       this.canvasHeight
  //     );
  //     this.updateSelectionState();

  //     // Listen for selection changes
  //     this.canvas.on('selection:created', () => this.updateSelectionState());
  //     this.canvas.on('selection:updated', () => this.updateSelectionState());
  //     this.canvas.on('selection:cleared', () => this.updateSelectionState());
  //   }
  // }

  // initFabricCanvas(): void {
  //   if (this.fabricCanvasRef?.nativeElement) {
  //     this.canvas = this.fabricService.initCanvas(this.fabricCanvasRef.nativeElement);
  //     this.updateSelectionState();

  //     // Listen for selection changes
  //     this.canvas.on('selection:created', () => this.updateSelectionState());
  //     this.canvas.on('selection:updated', () => this.updateSelectionState());
  //     this.canvas.on('selection:cleared', () => this.updateSelectionState());
  //   }
  // }

  private updateSelectionState(): void {
    this.hasSelection = this.fabricService.hasSelection();
    this.selectedProperties = this.fabricService.getSelectedObjectProperties();

    // Check if any selected object is text
    const selectedObjects = this.fabricService.getSelectedObjects();
    this.hasSelectedText = selectedObjects.some(
      (obj) =>
        obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox',
    );
  }

  // Tool Category Management
  setActiveToolCategory(category: string): void {
    this.activeToolCategory = category;
  }

  // File handling
  // onFileSelected(event: any): void {
  //   const file = event.target.files[0];
  //   if (!file) return;

  //   this.selectedFile = file;

  //   // Create preview
  //   const reader = new FileReader();
  //   reader.onload = (e: any) => {
  //     if (this.selectedMessageType === 'image') {
  //       this.imagePreview = e.target.result;
  //     } else if (this.selectedMessageType === 'video') {
  //       this.videoPreview = e.target.result;
  //     }
  //   };
  //   reader.readAsDataURL(file);
  // }

  // File handling
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validImageTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp',
    ];
    const validVideoTypes = [
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/webm',
    ];

    if (
      this.selectedMessageType === 'image' &&
      !validImageTypes.includes(file.type)
    ) {
      this.showError(
        'Please select a valid image file (JPEG, PNG, GIF, BMP, WebP)',
      );
      return;
    }

    if (
      this.selectedMessageType === 'video' &&
      !validVideoTypes.includes(file.type)
    ) {
      this.showError('Please select a valid video file (MP4, AVI, MOV, WebM)');
      return;
    }

    // Validate file size
    const maxImageSize = 10 * 1024 * 1024; // 10MB
    const maxVideoSize = 100 * 1024 * 1024; // 100MB

    if (this.selectedMessageType === 'image' && file.size > maxImageSize) {
      this.showError('Image file size should not exceed 10MB');
      return;
    }

    if (this.selectedMessageType === 'video' && file.size > maxVideoSize) {
      this.showError('Video file size should not exceed 100MB');
      return;
    }

    // For images, validate dimensions asynchronously
    if (this.selectedMessageType === 'image') {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => {
          if (
            img.width > this.selectedScreenSize!.width ||
            img.height > this.selectedScreenSize!.height
          ) {
            this.showError(
              `Image dimensions (${img.width}x${img.height}) exceed selected screen size (${this.selectedScreenSize!.width}x${this.selectedScreenSize!.height}). Please select a smaller image or choose a larger screen size.`,
            );

            // Clear the file input
            if (this.fileInput) {
              this.fileInput.nativeElement.value = '';
            }
            return; // Don't set the file or show preview
          }

          // If validation passes, set the file and show preview
          this.selectedFile = file;
          this.imagePreview = e.target.result;
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } else if (this.selectedMessageType === 'video') {
      // For videos, just set the file and preview
      this.selectedFile = file;

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.videoPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }
  // onFileSelected(event: any): void {
  //   const file = event.target.files[0];
  //   if (!file) return;

  //   // Validate file type
  //   const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
  //   const validVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/webm'];

  //   if (this.selectedMessageType === 'image' && !validImageTypes.includes(file.type)) {
  //     this.showError('Please select a valid image file (JPEG, PNG, GIF, BMP, WebP)');
  //     return;
  //   }

  //   if (this.selectedMessageType === 'video' && !validVideoTypes.includes(file.type)) {
  //     this.showError('Please select a valid video file (MP4, AVI, MOV, WebM)');
  //     return;
  //   }

  //   // Validate file size
  //   const maxImageSize = 10 * 1024 * 1024; // 10MB
  //   const maxVideoSize = 100 * 1024 * 1024; // 100MB

  //   if (this.selectedMessageType === 'image' && file.size > maxImageSize) {
  //     this.showError('Image file size should not exceed 10MB');
  //     return;
  //   }

  //   if (this.selectedMessageType === 'video' && file.size > maxVideoSize) {
  //     this.showError('Video file size should not exceed 100MB');
  //     return;
  //   }

  //   // Validate image dimensions
  //   if (this.selectedMessageType === 'image') {
  //     this.validateFileDimensions(file);
  //     if (!this.selectedFile) return; // Validation failed
  //   }

  //   this.selectedFile = file;

  //   // Create preview
  //   const reader = new FileReader();
  //   reader.onload = (e: any) => {
  //     if (this.selectedMessageType === 'image') {
  //       this.imagePreview = e.target.result;
  //     } else if (this.selectedMessageType === 'video') {
  //       this.videoPreview = e.target.result;
  //     }
  //   };
  //   reader.readAsDataURL(file);
  // }

  // Canvas Operations - delegating to service
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

  // uploadImage(): void {
  //   const input = document.createElement('input');
  //   input.type = 'file';
  //   input.accept = 'image/*';
  //   input.onchange = (event: any) => {
  //     const file = event.target.files[0];
  //     if (file) {
  //       const reader = new FileReader();
  //       reader.onload = (e: any) => {
  //         this.fabricService.addImage(e.target.result);
  //         this.updateSelectionState();
  //       };
  //       reader.readAsDataURL(file);
  //     }
  //   };
  //   input.click();
  // }

  uploadImage(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          const img = new Image();
          img.onload = () => {
            if (
              img.width > this.canvasWidth ||
              img.height > this.canvasHeight
            ) {
              this.showError(
                `Image dimensions (${img.width}x${img.height}) exceed canvas size (${this.canvasWidth}x${this.canvasHeight}). The image will be scaled down.`,
              );
              // Scale image to fit canvas
              const scale = Math.min(
                this.canvasWidth / img.width,
                this.canvasHeight / img.height,
              );
              this.fabricService.addImage(e.target.result, scale);
            } else {
              this.fabricService.addImage(e.target.result);
            }
            this.updateSelectionState();
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  // Selection Operations
  selectAll(): void {
    this.fabricService.selectAll();
    this.updateSelectionState();
  }

  deleteSelected(): void {
    this.fabricService.deleteSelected();
    this.updateSelectionState();
  }

  copySelected(): void {
    this.fabricService.copySelected();
  }

  paste(): void {
    this.fabricService.paste();
    this.updateSelectionState();
  }

  duplicateSelected(): void {
    this.fabricService.duplicateSelected();
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

  // Color Operations
  changeFillColor(color: string): void {
    this.fabricService.changeFillColor(color);
    this.updateSelectionState();
  }

  changeStrokeColor(color: string): void {
    this.fabricService.changeStrokeColor(color);
    this.updateSelectionState();
  }

  changeStrokeWidth(event: any): void {
    const width = parseInt(event.target.value);
    this.fabricService.changeStrokeWidth(width);
    this.updateSelectionState();
  }

  changeOpacity(opacity: string): void {
    const selectedObjects = this.fabricService.getSelectedObjects();
    selectedObjects.forEach((obj) => {
      obj.set('opacity', parseFloat(opacity));
    });
    this.canvas?.requestRenderAll();
    this.updateSelectionState();
  }

  // Border Style Operations
  setBorderStyle(dashPattern: number[]): void {
    this.fabricService.setBorderStyle(dashPattern);
    this.updateSelectionState();
  }

  setBorderRadius(event: any): void {
    const radius = parseInt(event.target.value);
    this.fabricService.setBorderRadius(radius);
    this.updateSelectionState();
  }

  // Text Style Operations
  updateTextStyle(property: string, value: any): void {
    if (typeof value === 'object' && value.target) {
      value = value.target.value;
    }
    this.fabricService.updateTextStyle(property, value);
    this.updateSelectionState();
  }

  toggleTextStyle(
    property: string,
    activeValue: any,
    inactiveValue: any,
  ): void {
    const currentValue = this.selectedProperties?.[property];
    const newValue = currentValue === activeValue ? inactiveValue : activeValue;
    this.fabricService.updateTextStyle(property, newValue);
    this.updateSelectionState();
  }

  // Alignment Operations
  alignLeft(): void {
    this.fabricService.alignLeft();
    this.updateSelectionState();
  }

  alignCenter(): void {
    this.fabricService.alignCenter();
    this.updateSelectionState();
  }

  alignRight(): void {
    this.fabricService.alignRight();
    this.updateSelectionState();
  }

  alignTop(): void {
    this.fabricService.alignTop();
    this.updateSelectionState();
  }

  alignMiddle(): void {
    this.fabricService.alignMiddle();
    this.updateSelectionState();
  }

  alignBottom(): void {
    this.fabricService.alignBottom();
    this.updateSelectionState();
  }

  // Layer Operations
  bringToFront(): void {
    this.fabricService.bringToFront();
    this.updateSelectionState();
  }

  bringForward(): void {
    this.fabricService.bringForward();
    this.updateSelectionState();
  }

  sendBackward(): void {
    this.fabricService.sendBackward();
    this.updateSelectionState();
  }

  sendToBack(): void {
    this.fabricService.sendToBack();
    this.updateSelectionState();
  }

  // Transform Operations
  flipHorizontal(): void {
    this.fabricService.flipHorizontal();
    this.updateSelectionState();
  }

  flipVertical(): void {
    this.fabricService.flipVertical();
    this.updateSelectionState();
  }

  rotateSelected(angle: number): void {
    this.fabricService.rotateSelected(angle);
    this.updateSelectionState();
  }

  setRotation(angle: string): void {
    const selectedObjects = this.fabricService.getSelectedObjects();
    selectedObjects.forEach((obj) => {
      obj.set('angle', parseInt(angle));
    });
    this.canvas?.requestRenderAll();
    this.updateSelectionState();
  }

  // Group Operations
  groupSelected(): void {
    this.fabricService.groupSelected();
    this.updateSelectionState();
  }

  ungroupSelected(): void {
    this.fabricService.ungroupSelected();
    this.updateSelectionState();
  }

  // Canvas Background Operations
  setCanvasBackgroundColor(color: string): void {
    this.canvasBackgroundColor = color;
    this.fabricService.setCanvasBackgroundColor(color);
  }

  clearCanvasBackground(): void {
    this.canvasBackgroundColor = '#ffffff';
    this.fabricService.setCanvasBackgroundColor('#ffffff');
  }

  // Download canvas as image
  downloadCanvas(): void {
    const dataURL = this.fabricService.exportAsImage();
    const link = document.createElement('a');
    link.download = 'canvas-design.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  onSubmit(): void {
    if (this.messageForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    // Validate file exists for image/video types
    if (
      (this.selectedMessageType === 'image' ||
        this.selectedMessageType === 'video') &&
      !this.selectedFile
    ) {
      this.showError(`Please select a ${this.selectedMessageType} file`);
      return;
    }

    this.isLoading = true;
    const formData = this.messageForm.value;

    switch (this.selectedMessageType) {
      case 'general':
        this.createGeneralMessage(formData);
        break;
      case 'image':
        this.createImageMessage(formData);
        break;
      case 'video':
        this.createVideoMessage(formData);
        break;
      case 'custom_image':
        this.createCustomImageMessage(formData);
        break;
    }
  }

  private createGeneralMessage(formData: any): void {
    const payload = {
      title: formData.title,
      content_data: formData.content_data,
      duration: formData.duration,
      createdBy: this.currentUserId,
      storeId: this.storeId,
      ScreenSizeId: formData.screenSize,
    };
    this.messageService.createGeneralMessage(payload).subscribe({
      next: (message: Message) => {
        this.showSuccess('General message created successfully');
        this.resetForm();
        this.isLoading = false;
      },
      error: (error) => {
        console.error(error); // log full error
        this.showError(
          'Failed to create message: ' + (error.message || error.statusText),
        );
        this.isLoading = false;
      },
    });
  }

  private createImageMessage(formData: any): void {
    if (!this.selectedFile) {
      this.showError('Please select an image file');
      this.isLoading = false;
      return;
    }

    const uploadData = new FormData();
    uploadData.append('image', this.selectedFile);
    uploadData.append('title', formData.title);
    uploadData.append('duration', formData.duration.toString());
    uploadData.append('createdBy', this.currentUserId.toString());
    uploadData.append('storeId', this.storeId.toString());
    uploadData.append('screenSizeId', formData.screenSize.toString());
    this.messageService.uploadImageMessage(uploadData).subscribe({
      next: (message: Message) => {
        this.showSuccess('Image message created successfully');
        this.resetForm();
        this.isLoading = false;
      },
      error: (error) => {
        this.showError('Failed to create image message: ' + error.message);
        this.isLoading = false;
      },
    });
  }

  private createVideoMessage(formData: any): void {
    if (!this.selectedFile) {
      this.showError('Please select a video file');
      this.isLoading = false;
      return;
    }

    const uploadData = new FormData();
    uploadData.append('video', this.selectedFile);
    uploadData.append('title', formData.title);
    uploadData.append('duration', formData.duration.toString());
    uploadData.append('createdBy', this.currentUserId.toString());
    uploadData.append('storeId', this.storeId.toString());
    uploadData.append('screenSizeId', formData.screenSize.toString());
    this.messageService.uploadVideoMessage(uploadData).subscribe({
      next: (message: Message) => {
        this.showSuccess('Video message created successfully');
        this.resetForm();
        this.isLoading = false;
      },
      error: (error) => {
        this.showError('Failed to create video message: ' + error.message);
        this.isLoading = false;
      },
    });
  }

  private createCustomImageMessage(formData: any): void {
    if (!this.canvas) {
      this.showError('Canvas not initialized');
      this.isLoading = false;
      return;
    }

    const canvasData = this.fabricService.getCanvasData();
    const imageData = this.fabricService.exportAsImage();

    const messageData = {
      title: formData.title,
      fabric_js_data: JSON.stringify(canvasData),
      image_data: imageData,
      duration: formData.duration,
      createdBy: this.currentUserId,
      storeId: this.storeId,
      screenSizeId: formData.screenSize,
    };
    console.log('Custom Image Message Data:', messageData);
    this.messageService.createCustomImageMessage(messageData).subscribe({
      next: (message: Message) => {
        this.showSuccess('Custom image message created successfully');
        this.resetForm();
        this.isLoading = false;
      },
      error: (error) => {
        this.showError(
          'Failed to create custom image message: ' + error.message,
        );
        this.isLoading = false;
      },
    });
  }

  // private createCustomImageMessage(formData: any): void {
  //   if (!this.canvas) {
  //     this.showError('Canvas not initialized');
  //     this.isLoading = false;
  //     return;
  //   }

  //   const canvasData = this.fabricService.getCanvasData();
  //   const imageData = this.fabricService.exportAsImage();

  //   const messageData = {
  //     title: formData.title,
  //     fabric_js_data: canvasData,
  //     image_data: imageData,
  //     duration: formData.duration,
  //     created_by: formData.created_by
  //   };

  //   this.queueService.createCustomImageMessage(messageData).subscribe({
  //     next: (message: Message) => {
  //       this.showSuccess('Custom image message created successfully');
  //       this.resetForm();
  //       this.isLoading = false;
  //     },
  //     error: (error) => {
  //       this.showError('Failed to create custom image message: ' + error.message);
  //       this.isLoading = false;
  //     }
  //   });
  // }

  // public resetForm(): void {
  //   this.messageForm.reset();
  //   this.messageForm.patchValue({
  //     duration: 5
  //   });
  //   this.selectedFile = null;
  //   this.imagePreview = null;
  //   this.videoPreview = null;
  //   this.hasSelection = false;
  //   this.hasSelectedText = false;
  //   this.selectedProperties = null;
  //   this.activeToolCategory = 'shapes';
  //   this.canvasBackgroundColor = '#ffffff';

  //   if (this.fileInput) {
  //     this.fileInput.nativeElement.value = '';
  //   }

  //   if (this.canvas) {
  //     this.fabricService.clearCanvas();
  //   }
  // }
  public resetForm(): void {
    this.messageForm.reset({
      duration: 5,
      screenSize: this.selectedScreenSize?.id || '',
    });
    this.selectedFile = null;
    this.imagePreview = null;
    this.videoPreview = null;
    this.hasSelection = false;
    this.hasSelectedText = false;
    this.selectedProperties = null;
    this.activeToolCategory = 'shapes';
    this.canvasBackgroundColor = '#ffffff';

    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }

    if (this.canvas) {
      this.fabricService.clearCanvas();
    }
  }
  private markFormGroupTouched(): void {
    Object.keys(this.messageForm.controls).forEach((key) => {
      this.messageForm.get(key)?.markAsTouched();
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
  // private showSuccess(message: string): void {
  //   this.openSnackbar({
  //     message: message,
  //     icon: 'fa-check-circle',
  //     type: 'success'
  //   });
  // }

  // private showError(message: string): void {
  //   this.openSnackbar({
  //     message: message,
  //     icon: 'fas fa-times-circle',
  //     type: 'error'
  //   });
  // }

  // private openSnackbar(data: SnackbarData): void {
  //   this.snackBar.openFromComponent(CustomSnackbarComponent, {
  //     data: data,
  //     duration: 5000,
  //     horizontalPosition: 'end',
  //     verticalPosition: 'top',
  //     panelClass: [`${data.type}-snackbar`]
  //   });
  // }
  //#endregion

  // private showSuccess(message: string): void {
  //   this.snackBar.open(message, 'Close', {
  //     duration: 3000,
  //     horizontalPosition: 'end',
  //     verticalPosition: 'top',
  //     panelClass: ['success-snackbar']
  //   });
  // }

  // private showError(message: string): void {
  //   this.snackBar.open(message, 'Close', {
  //     duration: 7000,
  //     horizontalPosition: 'end',
  //     verticalPosition: 'top',
  //     panelClass: ['error-snackbar']
  //   });
  // }

  getErrorMessage(fieldName: string): string {
    const field = this.messageForm.get(fieldName);
    if (field?.hasError('required')) {
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
    }
    if (field?.hasError('maxlength')) {
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is too long`;
    }
    if (field?.hasError('min')) {
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be at least 1`;
    }
    if (field?.hasError('max')) {
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} cannot exceed 300`;
    }
    return '';
  }
}
