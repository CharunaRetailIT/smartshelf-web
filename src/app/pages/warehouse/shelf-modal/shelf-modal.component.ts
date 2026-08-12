import { ChangeDetectorRef, Component, Inject, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormArray, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';
import { AisleMaster } from '../../../core/interfaces/aisle.interface';
import { LocalDeviceDto, LocalTemplateDto } from '../../../core/interfaces/device.interface';
import { MessageWithUser } from '../../../core/interfaces/message.interface';
import { SearchParams } from '../../../core/interfaces/pagination-result.interface';
import { Shelf } from '../../../core/interfaces/shelf.interface';
import { AisleService } from '../../../core/services/aisle.service';
import { AuthService } from '../../../core/services/auth.service';
import { DeviceService } from '../../../core/services/device.service';
import { SettingsService } from '../../../core/services/settings.service';
import { ShelfService } from '../../../core/services/shelf.service';
import { SnackbarData, CustomSnackbarComponent } from '../../../shared/components/alert/custom-snackbar.component';
import { CommonModule } from '@angular/common';
import { ImportsModule } from '../../../imports/imports';
import { CustomMessageService } from '../../../core/services/message.service';
import { TruncatePipe } from '../../../pipes/truncate.pipe';
import { MessageService } from 'primeng/api';

// Component specific interfaces
interface DeviceComboForm {
  deviceId: number;
  templateId?: string;
  messageId?: number;
  displayOrder: number;
  isActive: boolean;
  isDefault?: boolean;
  deviceTemplateComboId?: number;
  deviceMessageComboId?: number;
}

interface ExistingCombo {
  id: number;
  deviceId: number;
  deviceName: string;
  templateId?: string;
  templateName?: string;
  messageId?: number;
  messageTitle?: string;
  deviceMAC: string;
  status: string;
  isDefault: boolean;
  isActive: boolean;
  screenSize?: string;
  screenWidth?: number;
  screenHeight?: number;
  battery?: number;
}

interface ComboModeOption {
  label: string;
  value: 'device-template' | 'device-message';
  icon: string;
}
interface ProcessedComboResult {
  id?: number;
  success: boolean;
  message?: string;
}

@Component({
  selector: 'app-shelf-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ImportsModule, TruncatePipe],
  templateUrl: './shelf-modal.component.html',
  styleUrl: './shelf-modal.component.css'
})
export class ShelfModalComponent implements OnInit {
  // Modal properties
  @ViewChild('shelfModal') shelfModal: any;
  visible: boolean = true;
  header: string = 'Add New Shelf';

  // Form properties
  shelfForm: FormGroup;
  isSubmitting: boolean = false;
  isEditMode: boolean = false;

  // Tab management
  activeTabIndex: number = 0;
  tabs = [
    { label: 'Basic Information', icon: 'pi pi-info-circle' },
    { label: 'Device Configuration', icon: 'pi pi-cog' }
  ];

  // Data sources
  aisles: AisleMaster[] = [];
  devices: LocalDeviceDto[] = [];
  templates: LocalTemplateDto[] = [];
  messages: MessageWithUser[] = [];
  storeId: number = 0;

  // Combo mode selection
  comboMode: 'device-template' | 'device-message' = 'device-template';
  comboModeOptions: ComboModeOption[] = [
    { label: 'Device + Template', value: 'device-template', icon: 'pi pi-sliders-h' },
    { label: 'Device + Message', value: 'device-message', icon: 'pi pi-comment' }
  ];

  // Existing combos (lazy loaded)
  existingCombos: ExistingCombo[] = [];
  existingMessageCombos: any[] = [];
  selectedExistingCombos: any[] = [];
  selectedExistingMessageCombos: any[] = [];

  // handle existing assignments
  allAssignments: any[] = [];

  // Lazy loading properties
  deviceLoading: boolean = false;
  templateLoading: boolean = false;
  messageLoading: boolean = false;
  existingComboLoading: boolean = false;
  existingMessageComboLoading: boolean = false;

  devicePage: number = 1;
  templatePage: number = 1;
  messagePage: number = 1;
  existingComboPage: number = 1;
  existingMessageComboPage: number = 1;

  deviceHasMore: boolean = true;
  templateHasMore: boolean = true;
  messageHasMore: boolean = true;
  existingComboHasMore: boolean = true;
  existingMessageComboHasMore: boolean = true;

  pageSize: number = 10;

  // Search terms
  deviceSearchTerm: string = '';
  templateSearchTerm: string = '';
  messageSearchTerm: string = '';
  existingComboSearchTerm: string = '';
  existingMessageComboSearchTerm: string = '';

  //existing combo load
  existingComboStartIndex: number = 0;
  existingComboPageSize: number = 10;
  existingComboTotalItems: number = 0;
  existingComboCurrentPage: number = 1;
  existingComboTotalPages: number = 0;
  existingComboVisibleItems: any[] = [];
  existingComboAllLoadedItems: any[] = [];
  existingComboLoadingPrev: boolean = false;
  existingComboLoadingNext: boolean = false;

  //existing message combo load
  existingMessageCombosVisibleItems: any[] = [];
  existingMessageComboStartIndex: number = 0;
  existingMessageComboPageSize: number = 10;
  existingMessageComboTotalItems: number = 0;
  existingMessageComboCurrentPage: number = 1;
  existingMessageComboTotalPages: number = 0;
  existingMessageComboAllLoadedItems: any[] = [];
  existingMessageComboLoadingPrev: boolean = false;
  existingMessageComboLoadingNext: boolean = false;
  existingMessageComboSearchDebounceTimer: any;

  //Current mode
  currentLoadingData: any = null;
  currentLoadingMethod: 'template' | 'message' = 'template';


  //Current User
  currentUserId: number = 0;

  // Filter subjects
  private deviceFilterSubject = new Subject<string>();
  private templateFilterSubject = new Subject<string>();
  private messageFilterSubject = new Subject<string>();
  private existingComboFilterSubject = new Subject<string>();
  private existingMessageComboFilterSubject = new Subject<string>();

  filteredTemplates: LocalTemplateDto[] = [];
  templateSearchDebounce = new Subject<string>();

  showLoadMoreInDropdown: boolean = false;
  dropdownVisible: boolean = false;

  private loadingMissingItems = false;
  private missingItemRequests = new Set<string>();

  existingComboSearchDebounceTimer: any;


  // Validation patterns
  private readonly IP_PATTERN = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  private readonly MAC_PATTERN = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

  Math = Math;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ShelfModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      shelf?: Shelf;
      aisleID?: number;
      devices?: LocalDeviceDto[];
      templates?: LocalTemplateDto[];
      messages?: MessageWithUser[];
    },
    private shelfService: ShelfService,
    private aisleService: AisleService,
    private deviceService: DeviceService,
    private messageService: CustomMessageService,
    public auth: AuthService,
    private settingsService: SettingsService,
    private primemessageService: MessageService,
    private snackBar: MatSnackBar,
    private cdRef: ChangeDetectorRef
  ) {
    this.shelfForm = this.createForm();
    this.isEditMode = !!data?.shelf;
    this.header = this.getHeaderText();
    console.log(this.shelfForm)
    if (data?.devices) this.devices = data.devices;
    if (data?.templates) this.templates = data.templates;
    if (data?.messages) this.messages = data.messages;
  }

  getHeaderText(): string {
    if (!this.data?.shelf) {
      return 'Add New Shelf';
    }
    return this.canEdit() ? 'Edit Shelf' : 'View Shelf';
  }

  getDescriptionText(): string {
    if (!this.data?.shelf) {
      return 'Create a new shelf with complete details and device assignments';
    }

    return this.canEdit()
      ? 'Edit shelf details and manage assigned devices'
      : 'View shelf details and assigned devices';
  }


  //#region Lifecycle Methods
  ngOnInit(): void {
    this.initCurrentUser();
    this.setupFilterSubjects();
    this.setDefaultStore();

    // Add template search debounce
    // In ngOnInit, update the subscription:
    this.templateSearchDebounce.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.templateSearchTerm = searchTerm;
      this.templatePage = 1;
      this.filteredTemplates = [];
      this.templates = []; // Clear existing templates

      // If search term is empty, we want ALL templates
      // If search term has value, we want filtered templates
      this.loadTemplates();
    });

    if (this.isEditMode && this.data.shelf) {
      this.populateFormForEdit();
    } else {
      this.clearForm();
      if (this.data?.aisleID) {
        this.shelfForm.patchValue({ aisleId: this.data.aisleID });
      }
    }
    console.log("shelf modal initialized with data:", this.data);
    this.loadInitialData();
  }


  ngOnDestroy(): void {
    // Cleanup subscriptions
    this.templateSearchDebounce.complete();
  }

  initCurrentUser() {
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      this.showError('User not authenticated');
      return;
    }
    this.currentUserId = user.id;
  }

  canEdit(): boolean {
    return this.auth.hasAnyRole(['Admin', 'Manager', 'Operator']);
  }

  isReadOnlyMode(): boolean {
    return !this.canEdit();
  }

  private setupFilterSubjects(): void {
    // Device filter with debounce
    this.deviceFilterSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.deviceSearchTerm = searchTerm;
      this.devicePage = 1;
      this.devices = [];
      this.loadDevices();
    });

    // Template filter with debounce
    this.templateFilterSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.templateSearchTerm = searchTerm;
      this.templatePage = 1;
      this.templates = [];
      this.loadTemplates();
    });

    // Message filter with debounce
    this.messageFilterSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.messageSearchTerm = searchTerm;
      this.messagePage = 1;
      this.messages = [];
      this.loadMessages();
    });

    // Existing combo filter
    this.existingComboFilterSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.existingComboSearchTerm = searchTerm;
      this.resetExistingComboPagination(); // Reset pagination on new search
      this.loadExistingCombos('initial');
    });

    // Existing message combo filter
    this.existingMessageComboFilterSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.existingMessageComboSearchTerm = searchTerm;
      this.existingMessageComboPage = 1;
      this.existingMessageCombos = [];
      this.loadExistingMessageCombos();
    });
  }

  private setDefaultStore(): void {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    if (currentStore) {
      this.storeId = currentStore.id;
    }
  }

  private loadInitialData(): void {
    this.loadAisles();
    this.initializeDropdowns();
  }

  private async initializeDropdowns(): Promise<void> {
    // Load devices, templates, and messages first
    await Promise.all([
      this.loadDevices(),
      this.loadTemplates(),
      this.loadMessages()
    ]);

    // Then load assignments (which depends on devices/templates)
    if (this.isEditMode && this.data.shelf) {
      await this.loadCombosForEdit();
    }

    // Then load existing combos
    await Promise.all([
      // this.loadExistingCombos(),
      this.loadExistingCombos('initial'),
      this.loadMessageCombos('initial')

      //this.loadExistingMessageCombos()
    ]);
  }

  // private async initializeDropdowns(): Promise<void> {
  //   await Promise.all([
  //     this.loadDevices(),
  //     this.loadTemplates(),
  //     this.loadMessages(),
  //     this.loadExistingCombos(),
  //     this.loadExistingMessageCombos()
  //   ]);
  // }
  //#endregion

  //#region Form Methods
  private createForm(): FormGroup {
    const currentUser = this.auth.getCurrentUserValue();
    const aisleIdFromData = this.data?.aisleID;

    return this.fb.group({
      id: [null],
      aisleId: [aisleIdFromData, [Validators.required]],
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      location: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['', [Validators.maxLength(500)]],
      coordinates: ['', [Validators.maxLength(50)]],
      storeId: [this.storeId || null],
      // ipAddress: ['', [Validators.pattern(this.IP_PATTERN)]],
      // macAddress: [''],
      // deviceName: ['', [Validators.maxLength(100)]],
      isActive: [true],
      createdUser: [currentUser?.id || 0, [Validators.required]],
      deviceCombos: this.fb.array([])
    });
  }

  private clearForm(): void {
    this.shelfForm.reset({
      isActive: true,
      createdUser: this.auth.getCurrentUserValue()?.id || 0
    });
    this.deviceCombos.clear();
    this.comboMode = 'device-template';
    this.selectedExistingCombos = [];
    this.selectedExistingMessageCombos = [];
    this.resetTemplateSearch();

  }

  private populateFormForEdit(): void {
    if (!this.data.shelf) return;

    const shelf = this.data.shelf;
    this.shelfForm.patchValue({
      id: shelf.id,
      aisleId: shelf.aisleId,
      storeId: this.storeId,
      name: shelf.name,
      location: shelf.location,
      description: shelf.description,
      coordinates: shelf.coordinates,
      isActive: shelf.isActive !== undefined ? shelf.isActive : true,
      createdUser: shelf.createdUser || this.auth.getCurrentUserValue()?.id || 0
    });

    // Load existing combos for edit
    this.loadCombosForEdit();
  }

  // Method to show/hide dropdown
  onDropdownShow(): void {
    this.dropdownVisible = true;

    // If no combos loaded yet, load initial page
    if (this.existingComboAllLoadedItems.length === 0 && !this.existingComboLoading) {
      this.loadExistingCombos('initial');
    }
  }

  onDropdownHide(): void {
    this.dropdownVisible = false;
  }

  checkIfNeedLoadMore(): void {
    // Show load more button if we're at the bottom of the list
    this.showLoadMoreInDropdown = this.hasMoreCombos() || this.hasPreviousCombos();
  }


  // Generic method to load combos based on mode
  private async loadCombos(
    loadDirection: 'initial' | 'next' | 'prev' = 'initial',
    comboType: 'template' | 'message' = 'template'
  ): Promise<void> {
    if (comboType === 'template') {
      await this.loadTemplateCombos(loadDirection);
    } else {
      await this.loadMessageCombos(loadDirection);
    }
  }


  // Template combos loading
  public async loadTemplateCombos(loadDirection: 'initial' | 'next' | 'prev' = 'initial'): Promise<void> {
    if (this.existingComboLoading) return;

    this.existingComboLoading = true;

    if (loadDirection === 'next') {
      this.existingComboLoadingNext = true;
    } else if (loadDirection === 'prev') {
      this.existingComboLoadingPrev = true;
    }

    try {
      let targetPage = this.existingComboPage;

      if (loadDirection === 'next') {
        targetPage = this.existingComboCurrentPage + 1;
      } else if (loadDirection === 'prev') {
        targetPage = this.existingComboCurrentPage - 1;
      } else {
        targetPage = 1;
        this.existingComboCurrentPage = 1;
      }

      const request: SearchParams = {
        pageNumber: targetPage,
        pageSize: this.pageSize,
        searchTerm: this.existingComboSearchTerm
      };

      const pagedResult = await firstValueFrom(
        this.deviceService.getCombosPaged(request)
      );

      const result = pagedResult.result;
      const newCombos = result?.items || [];

      const mappedCombos = newCombos.map((combo: any) => ({
        id: combo.id,
        deviceId: combo.deviceId,
        deviceName: combo.deviceName,
        templateId: combo.templateId,
        templateName: combo.templateName,
        deviceMAC: combo.deviceMac || combo.deviceMAC || '',
        status: 'Active',
        isDefault: combo.isDefault,
        isActive: true,
        screenSize: combo.screenSize,
        screenWidth: combo.screenWidth,
        screenHeight: combo.screenHeight,
        battery: combo.battery,
        comboType: 'template' // Add type identifier
      }));
      console.log("template combo", mappedCombos)
      this.existingComboTotalItems = result?.totalCount || 0;
      this.existingComboTotalPages = Math.ceil(this.existingComboTotalItems / this.pageSize);

      // Handle loading based on direction and search
      if (this.existingComboSearchTerm) {
        // Search mode
        if (loadDirection === 'next') {
          this.existingComboAllLoadedItems = [...this.existingComboAllLoadedItems, ...mappedCombos];
          this.existingComboCurrentPage = targetPage;
        } else if (loadDirection === 'prev') {
          this.existingComboAllLoadedItems = [...mappedCombos, ...this.existingComboAllLoadedItems];
          this.existingComboCurrentPage = targetPage;
        } else {
          this.existingComboAllLoadedItems = mappedCombos;
          this.existingComboCurrentPage = 1;
        }
      } else {
        // Normal browsing
        if (loadDirection === 'next') {
          this.existingComboAllLoadedItems = [...this.existingComboAllLoadedItems, ...mappedCombos];
          this.existingComboCurrentPage = targetPage;
        } else if (loadDirection === 'prev') {
          this.existingComboAllLoadedItems = [...mappedCombos, ...this.existingComboAllLoadedItems];
          this.existingComboCurrentPage = targetPage;
        } else {
          this.existingComboAllLoadedItems = mappedCombos;
          this.existingComboCurrentPage = 1;
        }
      }

      this.existingComboPage = targetPage;
      this.updateVisibleTemplateCombos();

    } catch (error) {
      console.error('Error loading template combos:', error);
      this.showError('Failed to load template combos');
    } finally {
      this.existingComboLoading = false;
      this.existingComboLoadingNext = false;
      this.existingComboLoadingPrev = false;
    }
  }

  // Message combos loading
  public async loadMessageCombos(loadDirection: 'initial' | 'next' | 'prev' = 'initial'): Promise<void> {
    if (this.existingMessageComboLoading) return;

    this.existingMessageComboLoading = true;

    if (loadDirection === 'next') {
      this.existingMessageComboLoadingNext = true;
    } else if (loadDirection === 'prev') {
      this.existingMessageComboLoadingPrev = true;
    }

    try {
      let targetPage = this.existingMessageComboPage;

      if (loadDirection === 'next') {
        targetPage = this.existingMessageComboCurrentPage + 1;
      } else if (loadDirection === 'prev') {
        targetPage = this.existingMessageComboCurrentPage - 1;
      } else {
        targetPage = 1;
        this.existingMessageComboCurrentPage = 1;
      }

      const request: SearchParams & { deviceId?: number; messageId?: number; isActive?: boolean } = {
        pageNumber: targetPage,
        pageSize: this.pageSize,
        searchTerm: this.existingMessageComboSearchTerm,
        isActive: true
      };

      const pagedResult = await firstValueFrom(
        this.deviceService.getDeviceMessageCombosPagedByParams(request)
      );

      const newCombos = pagedResult.items || [];

      // Get device and message names
      const mappedCombos = await Promise.all(newCombos.map(async (combo: any) => {
        let deviceName = 'Unknown Device';
        let messageTitle = 'Unknown Message';

        // Get device name
        if (combo.deviceId) {
          const device = this.devices.find(d => d.id === combo.deviceId);
          if (device) deviceName = device.deviceName;
          else {
            // Try to load device if not found
            try {
              const loadedDevice = await firstValueFrom(
                this.deviceService.getDeviceById(combo.deviceId)
              );
              if (loadedDevice) {
                deviceName = loadedDevice.deviceName;
                if (!this.devices.some(d => d.id === combo.deviceId)) {
                  this.devices.push(loadedDevice);
                }
              }
            } catch (e) {
              console.warn('Could not load device:', combo.deviceId);
            }
          }
        }

        // Get message title
        if (combo.messageId) {
          const message = this.messages.find(m => m.id === combo.messageId);
          if (message) messageTitle = message.title;
          else {
            // Try to load message if not found
            try {
              const loadedMessage = await firstValueFrom(
                this.messageService.getMessageById(combo.messageId)
              );
              if (loadedMessage) {
                messageTitle = loadedMessage.title;
                if (!this.messages.some(m => m.id === combo.messageId)) {
                  this.messages.push(loadedMessage);
                }
              }
            } catch (e) {
              console.warn('Could not load message:', combo.messageId);
            }
          }
        }

        return {
          id: combo.id,
          deviceId: combo.deviceId,
          deviceName: deviceName,
          messageId: combo.messageId,
          messageTitle: messageTitle,
          deviceMAC: combo.deviceMac || '',
          status: combo.isActive ? 'Active' : 'Inactive',
          isDefault: false,
          isActive: combo.isActive,
          comboType: 'message', // Add type identifier
          // Add message specific properties
          contentType: combo.contentType,
          duration: combo.duration,
          _type: 'device-message'
        };
      }));

      this.existingMessageComboTotalItems = pagedResult.totalCount || 0;
      this.existingMessageComboTotalPages = Math.ceil(this.existingMessageComboTotalItems / this.pageSize);

      // Handle loading based on direction and search
      if (this.existingMessageComboSearchTerm) {
        // Search mode
        if (loadDirection === 'next') {
          this.existingMessageComboAllLoadedItems = [...this.existingMessageComboAllLoadedItems, ...mappedCombos];
          this.existingMessageComboCurrentPage = targetPage;
        } else if (loadDirection === 'prev') {
          this.existingMessageComboAllLoadedItems = [...mappedCombos, ...this.existingMessageComboAllLoadedItems];
          this.existingMessageComboCurrentPage = targetPage;
        } else {
          this.existingMessageComboAllLoadedItems = mappedCombos;
          this.existingMessageComboCurrentPage = 1;
        }
      } else {
        // Normal browsing
        if (loadDirection === 'next') {
          this.existingMessageComboAllLoadedItems = [...this.existingMessageComboAllLoadedItems, ...mappedCombos];
          this.existingMessageComboCurrentPage = targetPage;
        } else if (loadDirection === 'prev') {
          this.existingMessageComboAllLoadedItems = [...mappedCombos, ...this.existingMessageComboAllLoadedItems];
          this.existingMessageComboCurrentPage = targetPage;
        } else {
          this.existingMessageComboAllLoadedItems = mappedCombos;
          this.existingMessageComboCurrentPage = 1;
        }
      }

      this.existingMessageComboPage = targetPage;
      this.updateVisibleMessageCombos();

    } catch (error) {
      console.error('Error loading message combos:', error);
      this.showError('Failed to load message combos');
    } finally {
      this.existingMessageComboLoading = false;
      this.existingMessageComboLoadingNext = false;
      this.existingMessageComboLoadingPrev = false;
    }
  }

  // Update visible items methods
  private updateVisibleTemplateCombos(): void {
    if (this.existingComboSearchTerm) {
      this.existingComboVisibleItems = [...this.existingComboAllLoadedItems];
    } else {
      const startIndex = (this.existingComboCurrentPage - 1) * this.pageSize;
      const endIndex = Math.min(startIndex + this.pageSize, this.existingComboAllLoadedItems.length);
      this.existingComboVisibleItems = this.existingComboAllLoadedItems.slice(startIndex, endIndex);
    }
  }

  private updateVisibleMessageCombos(): void {
    if (this.existingMessageComboSearchTerm) {
      this.existingMessageCombosVisibleItems = [...this.existingMessageComboAllLoadedItems];
    } else {
      const startIndex = (this.existingMessageComboCurrentPage - 1) * this.pageSize;
      const endIndex = Math.min(startIndex + this.pageSize, this.existingMessageComboAllLoadedItems.length);
      this.existingMessageCombosVisibleItems = this.existingMessageComboAllLoadedItems.slice(startIndex, endIndex);
    }
  }

  // Template combo methods
  onTemplateComboFilter(event: any): void {
    const filterValue = event.filter || '';

    if (this.existingComboSearchDebounceTimer) {
      clearTimeout(this.existingComboSearchDebounceTimer);
    }

    this.existingComboSearchDebounceTimer = setTimeout(() => {
      this.performTemplateComboSearch(filterValue);
    }, 500);
  }

  private async performTemplateComboSearch(searchTerm: string): Promise<void> {
    this.existingComboSearchTerm = searchTerm;
    this.resetTemplateComboPagination();
    await this.loadTemplateCombos('initial');
  }

  resetTemplateComboPagination(): void {
    this.existingComboPage = 1;
    this.existingComboCurrentPage = 1;
    this.existingComboAllLoadedItems = [];
    this.existingComboVisibleItems = [];
    this.selectedExistingCombos = [];
  }

  // Message combo methods
  onMessageComboFilter(event: any): void {
    const filterValue = event.filter || '';

    if (this.existingMessageComboSearchDebounceTimer) {
      clearTimeout(this.existingMessageComboSearchDebounceTimer);
    }

    this.existingMessageComboSearchDebounceTimer = setTimeout(() => {
      this.performMessageComboSearch(filterValue);
    }, 500);
  }

  private async performMessageComboSearch(searchTerm: string): Promise<void> {
    this.existingMessageComboSearchTerm = searchTerm;
    this.resetMessageComboPagination();
    await this.loadMessageCombos('initial');
  }

  resetMessageComboPagination(): void {
    this.existingMessageComboPage = 1;
    this.existingMessageComboCurrentPage = 1;
    this.existingMessageComboAllLoadedItems = [];
    this.existingMessageCombosVisibleItems = [];
    this.selectedExistingMessageCombos = [];
  }

  // Check if has more/previous
  hasMoreTemplateCombos(): boolean {
    if (this.existingComboSearchTerm) {
      return this.existingComboCurrentPage < this.existingComboTotalPages;
    }
    return this.existingComboCurrentPage < this.existingComboTotalPages;
  }

  hasPreviousTemplateCombos(): boolean {
    if (this.existingComboSearchTerm) {
      return this.existingComboCurrentPage > 1;
    }
    return this.existingComboCurrentPage > 1;
  }

  hasMoreMessageCombos(): boolean {
    if (this.existingMessageComboSearchTerm) {
      return this.existingMessageComboCurrentPage < this.existingMessageComboTotalPages;
    }
    return this.existingMessageComboCurrentPage < this.existingMessageComboTotalPages;
  }

  hasPreviousMessageCombos(): boolean {
    if (this.existingMessageComboSearchTerm) {
      return this.existingMessageComboCurrentPage > 1;
    }
    return this.existingMessageComboCurrentPage > 1;
  }

  // Load more/previous methods
  async loadMoreTemplateCombos(): Promise<void> {
    if (this.existingComboLoadingNext || !this.hasMoreTemplateCombos()) return;
    await this.loadTemplateCombos('next');
  }

  async loadPreviousTemplateCombos(): Promise<void> {
    if (this.existingComboLoadingPrev || !this.hasPreviousTemplateCombos()) return;
    await this.loadTemplateCombos('prev');
  }

  async loadMoreMessageCombos(): Promise<void> {
    if (this.existingMessageComboLoadingNext || !this.hasMoreMessageCombos()) return;
    await this.loadMessageCombos('next');
  }

  async loadPreviousMessageCombos(): Promise<void> {
    if (this.existingMessageComboLoadingPrev || !this.hasPreviousMessageCombos()) return;
    await this.loadMessageCombos('prev');
  }

  // Clear search methods
  clearTemplateComboSearch(multiSelect: any): void {
    this.existingComboSearchTerm = '';
    if (multiSelect) {
      multiSelect.filterValue = '';
    }
    this.resetTemplateComboPagination();
    this.loadTemplateCombos('initial');
  }

  clearMessageComboSearch(multiSelect: any): void {
    this.existingMessageComboSearchTerm = '';
    if (multiSelect) {
      multiSelect.filterValue = '';
    }
    this.resetMessageComboPagination();
    this.loadMessageCombos('initial');
  }

  onTemplateComboDropdownShow(): void {
    // If no template combos loaded yet, load initial page
    if (this.existingComboAllLoadedItems.length === 0 && !this.existingComboLoading) {
      this.loadTemplateCombos('initial');
    }
  }

  onMessageComboDropdownShow(): void {
    // If no message combos loaded yet, load initial page
    if (this.existingMessageComboAllLoadedItems.length === 0 && !this.existingMessageComboLoading) {
      this.loadMessageCombos('initial');
    }
  }


  private async loadCombosForEdit(): Promise<void> {
    if (!this.data.shelf?.id) {
      console.log('No shelf ID found for edit');
      return;
    }

    console.log('loadCombosForEdit called for shelf ID:', this.data.shelf.id);

    try {
      const apiResponse = await firstValueFrom(
        this.shelfService.getShelfWithAssignments(this.data.shelf.id, this.storeId)
      );

      let shelfWithAssignments: Shelf;

      if (apiResponse && 'result' in apiResponse) {
        console.log('Response has "result" property');
        shelfWithAssignments = (apiResponse as any).result;
      } else if (apiResponse && 'id' in apiResponse) {
        console.log('Response is already a Shelf object');
        shelfWithAssignments = apiResponse as Shelf;
      } else {
        console.log('Unknown response structure, trying to use as-is');
        shelfWithAssignments = apiResponse as any;
      }

      if (shelfWithAssignments?.assignments) {
        console.log(`Found ${shelfWithAssignments.assignments.length} assignments`);

        // Store assignments for later use
        this.allAssignments = shelfWithAssignments.assignments;

        // Process based on current combo mode
        this.processAssignmentsForCurrentMode();
      }
    } catch (error) {
      console.error('Error loading shelf assignments:', error);
    }
  }



  // New method to process assignments based on current mode
  private processAssignmentsForCurrentMode(): void {
    if (!this.allAssignments || this.allAssignments.length === 0) {
      return;
    }

    // Clear existing combos
    while (this.deviceCombos.length) {
      this.deviceCombos.removeAt(0);
    }

    // Filter assignments for current mode
    const filteredAssignments = this.allAssignments.filter(a =>
      (this.comboMode === 'device-template' && a.assignmentType === 'TEMPLATE') ||
      (this.comboMode === 'device-message' && a.assignmentType === 'MESSAGE')
    );

    console.log(`Processing ${filteredAssignments.length} assignments for ${this.comboMode} mode`);

    // Process filtered assignments
    filteredAssignments.forEach((assignment, index) => {
      if (this.comboMode === 'device-template') {
        this.processTemplateAssignment(assignment, index);
      } else {
        this.processMessageAssignment(assignment, index);
      }
    });
  }


  // private async loadCombosForEdit(): Promise<void> {
  //   if (!this.data.shelf?.id) {
  //     console.log('No shelf ID found for edit');
  //     return;
  //   }

  //   console.log('loadCombosForEdit called for shelf ID:', this.data.shelf.id);

  //   try {
  //     // Call the service method
  //     const apiResponse = await firstValueFrom(
  //       this.shelfService.getShelfWithAssignments(this.data.shelf.id)
  //     );

  //     console.log('API Response from service:', apiResponse);
  //     console.log('Type of response:', typeof apiResponse);
  //     console.log('Is it a Shelf object?', 'id' in apiResponse);

  //     // Check if it's already the Shelf object or the wrapper
  //     let shelfWithAssignments: Shelf;

  //     // Option 1: If service returns the wrapper (has 'result' property)
  //     if (apiResponse && 'result' in apiResponse) {
  //       console.log('Response has "result" property');
  //       shelfWithAssignments = (apiResponse as any).result;
  //       console.log('Extracted shelf from result:', shelfWithAssignments);
  //     } 
  //     // Option 2: If service returns the Shelf object directly
  //     else if (apiResponse && 'id' in apiResponse) {
  //       console.log('Response is already a Shelf object');
  //       shelfWithAssignments = apiResponse as Shelf;
  //     }
  //     // Option 3: If service returns something else
  //     else {
  //       console.log('Unknown response structure, trying to use as-is');
  //       shelfWithAssignments = apiResponse as any;
  //     }

  //     // Now check for assignments
  //     if (shelfWithAssignments?.assignments) {
  //       console.log(`Found ${shelfWithAssignments.assignments.length} assignments:`, shelfWithAssignments.assignments);

  //       // Load specific devices and templates needed for these assignments
  //       // await this.loadSpecificDevicesAndTemplates(shelfWithAssignments.assignments);

  //       // Process assignments once all data is loaded
  //       this.processAssignmentsForEdit(shelfWithAssignments.assignments);
  //     } else {
  //       console.log('No assignments found on shelf object');
  //       console.log('Shelf object:', shelfWithAssignments);
  //       console.log('Assignments property exists?', 'assignments' in shelfWithAssignments);
  //     }
  //   } catch (error) {
  //     console.error('Error loading shelf assignments:', error);
  //     console.error('Error details:', error);
  //   }
  // }
  // private async loadCombosForEdit(): Promise<void> {
  //   if (!this.data.shelf?.id) return;

  //   try {
  //     const shelfWithAssignments = await firstValueFrom(
  //       this.shelfService.getShelfWithAssignments(this.data.shelf.id)
  //     );

  //     if (shelfWithAssignments?.assignments) {
  //       this.processAssignmentsForEdit(shelfWithAssignments.assignments);
  //     }
  //   } catch (error) {
  //     console.error('Error loading shelf assignments:', error);
  //   }
  // }

  // private processAssignmentsForEdit(assignments: any[]): void {
  //   assignments.forEach((assignment, index) => {
  //     if (assignment.assignmentType === 'TEMPLATE') {
  //       this.comboMode = 'device-template';
  //       this.addDeviceCombo({
  //         deviceId: assignment.combo?.deviceId || 0,
  //         templateId: assignment.combo?.templateId || '',
  //         displayOrder: assignment.displayOrder || index + 1,
  //         isActive: assignment.isActive !== false,
  //         isDefault: assignment.displayOrder === 1,
  //         deviceTemplateComboId: assignment.deviceTemplateComboId
  //       });
  //     } else if (assignment.assignmentType === 'MESSAGE') {
  //       this.comboMode = 'device-message';
  //       this.addDeviceCombo({
  //         deviceId: assignment.combo?.deviceId || 0,
  //         messageId: assignment.combo?.messageId || 0,
  //         displayOrder: assignment.displayOrder || index + 1,
  //         isActive: assignment.isActive !== false,
  //         isDefault: false,
  //         deviceMessageComboId: assignment.deviceMessageComboId
  //       });
  //     }
  //   });
  // }

  private processAssignmentsForEdit(assignments: any[]): void {
    console.log('=== DEBUG: processAssignmentsForEdit START ===');
    console.log('Assignments received:', assignments);

    // Clear any existing combos first
    while (this.deviceCombos.length) {
      this.deviceCombos.removeAt(0);
    }

    // Check if we have mixed assignment types
    const hasTemplateAssignments = assignments.some(a => a.assignmentType === 'TEMPLATE');
    const hasMessageAssignments = assignments.some(a => a.assignmentType === 'MESSAGE');

    if (hasTemplateAssignments && hasMessageAssignments) {
      console.warn('Mixed assignment types found. Defaulting to template assignments.');
      // You could show a warning to the user here
      this.showWarning('This shelf has both template and message assignments. Showing template assignments only.');
    }

    // Set the combo mode based on assignments
    // Priority: If any template assignments exist, use template mode
    this.comboMode = hasTemplateAssignments ? 'device-template' : 'device-message';

    console.log(`Setting combo mode to: ${this.comboMode}`);

    // Process only assignments that match the selected mode
    const filteredAssignments = assignments.filter(a =>
      (this.comboMode === 'device-template' && a.assignmentType === 'TEMPLATE') ||
      (this.comboMode === 'device-message' && a.assignmentType === 'MESSAGE')
    );

    console.log(`Processing ${filteredAssignments.length} assignments for mode ${this.comboMode}`);

    filteredAssignments.forEach((assignment, index) => {
      console.log(`\n=== Processing assignment ${index + 1} ===`);
      console.log('Assignment data:', assignment);

      if (this.comboMode === 'device-template') {
        // Process TEMPLATE assignment
        this.processTemplateAssignment(assignment, index);
      } else {
        // Process MESSAGE assignment
        this.processMessageAssignment(assignment, index);
      }
    });

    // Force change detection
    this.cdRef.detectChanges();
  }


  private processTemplateAssignment(assignment: any, index: number): void {
    let device: LocalDeviceDto | undefined;
    let template: LocalTemplateDto | undefined;

    // Find device
    if (assignment.deviceId) {
      const deviceId = Number(assignment.deviceId);
      device = this.devices.find(d => d.id === deviceId);

      if (!device && assignment.deviceMAC) {
        const cleanMAC = assignment.deviceMAC.toLowerCase().replace(/:/g, '');
        device = this.devices.find(d => {
          if (!d.mac) return false;
          const cleanDeviceMAC = d.mac.toLowerCase().replace(/:/g, '');
          return cleanDeviceMAC === cleanMAC;
        });
      }
    }

    // Find template
    if (assignment.templateId) {
      const templateId = assignment.templateId.toString();
      template = this.templates.find(t => t.id.toString() === templateId);
    }

    if (device && template) {
      console.log(`✅ Adding template combo: Device ${device.deviceName}, Template ${template.name}`);
      this.addDeviceCombo({
        deviceId: device.id,
        templateId: template.id,
        displayOrder: assignment.displayOrder || index + 1,
        isActive: assignment.isActive !== false,
        isDefault: assignment.displayOrder === 1,
        deviceTemplateComboId: assignment.deviceTemplateComboId
      });
    } else {
      console.warn(`❌ Incomplete data for template assignment ${index + 1}`);
      // Add with available data
      this.addDeviceCombo({
        deviceId: assignment.deviceId ? Number(assignment.deviceId) : 0,
        templateId: assignment.templateId || '',
        displayOrder: assignment.displayOrder || index + 1,
        isActive: assignment.isActive !== false,
        isDefault: assignment.displayOrder === 1,
        deviceTemplateComboId: assignment.deviceTemplateComboId
      });
    }
  }

  private processMessageAssignment(assignment: any, index: number): void {
    let device: LocalDeviceDto | undefined;
    let message: MessageWithUser | undefined;

    console.log('Processing message assignment:', assignment);

    // Find device - look in deviceId field for MESSAGE assignments
    if (assignment.deviceId) {
      const deviceId = Number(assignment.deviceId);
      console.log(`Looking for device with ID: ${deviceId}`);
      device = this.devices.find(d => d.id === deviceId);

      if (!device && assignment.deviceMAC) {
        console.log(`Device not found by ID, trying MAC: ${assignment.deviceMAC}`);
        const cleanMAC = assignment.deviceMAC.toLowerCase().replace(/:/g, '');
        device = this.devices.find(d => {
          if (!d.mac) return false;
          const cleanDeviceMAC = d.mac.toLowerCase().replace(/:/g, '');
          return cleanDeviceMAC === cleanMAC;
        });
      }

      console.log('Found device:', device ? `${device.deviceName} (ID: ${device.id})` : 'NOT FOUND');
    }

    // Find message
    if (assignment.messageId) {
      const messageId = Number(assignment.messageId);
      console.log(`Looking for message with ID: ${messageId}`);
      message = this.messages.find(m => m.id === messageId);
      console.log('Found message:', message ? `${message.title} (ID: ${message.id})` : 'NOT FOUND');
    }

    if (device && message) {
      console.log(`✅ Adding message combo: Device ${device.deviceName}, Message ${message.title}`);
      this.addDeviceCombo({
        deviceId: device.id,
        messageId: message.id,
        displayOrder: assignment.displayOrder || index + 1,
        isActive: assignment.isActive !== false,
        isDefault: false,
        deviceMessageComboId: assignment.deviceMessageComboId
      });
    } else if (device && !message) {
      console.warn(`❌ Message not found for assignment ${index + 1}`);
      // Add with device only
      this.addDeviceCombo({
        deviceId: device.id,
        messageId: assignment.messageId || 0,
        displayOrder: assignment.displayOrder || index + 1,
        isActive: assignment.isActive !== false,
        isDefault: false,
        deviceMessageComboId: assignment.deviceMessageComboId
      });
    } else if (!device && message) {
      console.warn(`❌ Device not found for assignment ${index + 1}`);
      // Add with message only
      this.addDeviceCombo({
        deviceId: assignment.deviceId ? Number(assignment.deviceId) : 0,
        messageId: message.id,
        displayOrder: assignment.displayOrder || index + 1,
        isActive: assignment.isActive !== false,
        isDefault: false,
        deviceMessageComboId: assignment.deviceMessageComboId
      });
    } else {
      console.warn(`❌ No device or message found for assignment ${index + 1}`);
      // Add with whatever data we have
      this.addDeviceCombo({
        deviceId: assignment.deviceId ? Number(assignment.deviceId) : 0,
        messageId: assignment.messageId || 0,
        displayOrder: assignment.displayOrder || index + 1,
        isActive: assignment.isActive !== false,
        isDefault: false,
        deviceMessageComboId: assignment.deviceMessageComboId
      });
    }
  }

  // private processAssignmentsForEdit(assignments: any[]): void {
  //   // Clear any existing combos first
  //   while (this.deviceCombos.length) {
  //     this.deviceCombos.removeAt(0);
  //   }

  //   console.log('=== DEBUG: processAssignmentsForEdit START ===');
  //   console.log('Assignments received:', assignments);
  //   console.log('Available devices:', this.devices.map(d => ({ id: d.id, deviceName: d.deviceName, mac: d.mac })));
  //   console.log('Available templates:', this.templates.map(t => ({ id: t.id, name: t.name })));

  //   // Process each assignment
  //   assignments.forEach((assignment, index) => {
  //     console.log(`\n=== Processing assignment ${index + 1} ===`);
  //     console.log('Assignment data:', assignment);

  //     if (assignment.assignmentType === 'TEMPLATE') {
  //       this.comboMode = 'device-template';

  //       // Try to find device by deviceId
  //       let device: LocalDeviceDto | undefined;

  //       // IMPORTANT: Check if deviceId exists and is a number
  //       if (assignment.deviceId !== null && assignment.deviceId !== undefined) {
  //         // Convert to number for comparison
  //         const deviceId = Number(assignment.deviceId);
  //         device = this.devices.find(d => d.id === deviceId);
  //         console.log(`Looking for device with ID ${deviceId}:`, device ? `Found: ${device.deviceName}` : 'NOT FOUND');

  //         // If not found by ID, try by MAC
  //         if (!device && assignment.deviceMAC) {
  //           const cleanMAC = assignment.deviceMAC.toLowerCase().replace(/:/g, '');
  //           device = this.devices.find(d => {
  //             if (!d.mac) return false;
  //             const cleanDeviceMAC = d.mac.toLowerCase().replace(/:/g, '');
  //             return cleanDeviceMAC === cleanMAC;
  //           });
  //           console.log(`Looking for device with MAC ${assignment.deviceMAC}:`, device ? `Found: ${device.deviceName}` : 'NOT FOUND');
  //         }
  //       } else {
  //         console.log('No deviceId or deviceMAC in assignment');
  //       }

  //       // Try to find template
  //       let template: LocalTemplateDto | undefined;

  //       // Check if templateId exists
  //       if (assignment.templateId) {
  //         // Template IDs might be strings or numbers - convert to string for comparison
  //         const templateId = assignment.templateId.toString();
  //         template = this.templates.find(t => t.id.toString() === templateId);
  //         console.log(`Looking for template with ID ${templateId}:`, template ? `Found: ${template.name}` : 'NOT FOUND');

  //         // If not found by ID, try by name
  //         if (!template && assignment.templateName) {
  //           template = this.templates.find(t => t.name === assignment.templateName);
  //           console.log(`Looking for template with name "${assignment.templateName}":`, template ? `Found: ${template.name}` : 'NOT FOUND');
  //         }
  //       }

  //       if (device && template) {
  //         console.log(`✅ SUCCESS: Found both device and template for assignment ${index + 1}`);
  //         console.log(`Device: ${device.deviceName} (ID: ${device.id})`);
  //         console.log(`Template: ${template.name} (ID: ${template.id})`);

  //         this.addDeviceCombo({
  //           deviceId: device.id,
  //           templateId: template.id,
  //           displayOrder: assignment.displayOrder || index + 1,
  //           isActive: assignment.isActive !== false,
  //           isDefault: assignment.displayOrder === 1,
  //           deviceTemplateComboId: assignment.deviceTemplateComboId
  //         });
  //       } else {
  //         console.warn(`❌ WARNING: Could not find complete match for assignment ${index + 1}`);

  //         // Add combo anyway with whatever data we have
  //         // This ensures the form at least has the IDs
  //         const deviceId = assignment.deviceId ? Number(assignment.deviceId) : 0;
  //         const templateId = assignment.templateId || '';

  //         this.addDeviceCombo({
  //           deviceId: deviceId,
  //           templateId: templateId,
  //           displayOrder: assignment.displayOrder || index + 1,
  //           isActive: assignment.isActive !== false,
  //           isDefault: assignment.displayOrder === 1,
  //           deviceTemplateComboId: assignment.deviceTemplateComboId
  //         });

  //         console.log(`Added combo with deviceId: ${deviceId}, templateId: ${templateId}`);
  //       }
  //     } else if (assignment.assignmentType === 'MESSAGE') {
  //       this.comboMode = 'device-message';
  //       console.log('Message assignment found (not implemented):', assignment);
  //     }
  //   });

  //   console.log(`\n=== DEBUG SUMMARY ===`);
  //   console.log(`Total assignments processed: ${assignments.length}`);
  //   console.log(`Total combos added to form: ${this.deviceCombos.length}`);
  //   console.log('Current combos in form:', this.deviceCombos.value);
  //   console.log('=== DEBUG: processAssignmentsForEdit END ===');

  //   // Force change detection
  //   this.cdRef.detectChanges();
  // }


  // Helper method to find device by MAC address
  // private findDeviceByMAC(macAddress: string): LocalDeviceDto | undefined {
  //   return this.devices.find(device => 
  //     device.mac?.toLowerCase() === macAddress.toLowerCase()  );
  // }

  // Helper method to find device by MAC address
  private findDeviceByMAC(macAddress: string): LocalDeviceDto | undefined {
    if (!macAddress) return undefined;

    return this.devices.find(device =>
      device.mac && device.mac.toLowerCase() === macAddress.toLowerCase()
    );
  }

  // Helper method to find template by name
  private findTemplateByName(templateName: string): LocalTemplateDto | undefined {
    if (!templateName) return undefined;

    return this.templates.find(template =>
      template.name === templateName
    );
  }
  // Helper method to find template by name
  // private findTemplateByName(templateName: string): LocalTemplateDto | undefined {
  //   return this.templates.find(template => 
  //     template.name === templateName
  //   );
  // }

  get deviceCombos(): FormArray {
    return this.shelfForm.get('deviceCombos') as FormArray;
  }

  get deviceComboGroups(): FormGroup[] {
    return this.deviceCombos.controls as FormGroup[];
  }

  addDeviceCombo(initialData?: DeviceComboForm): void {
    let comboGroup: FormGroup;

    if (this.comboMode === 'device-template') {
      comboGroup = this.fb.group({
        deviceId: [initialData?.deviceId || '', Validators.required],
        templateId: [initialData?.templateId || '', Validators.required],
        displayOrder: [initialData?.displayOrder || this.deviceCombos.length + 1, [Validators.required, Validators.min(1)]],
        isActive: [initialData?.isActive !== undefined ? initialData.isActive : true],
        isDefault: [initialData?.isDefault || false],
        deviceTemplateComboId: [initialData?.deviceTemplateComboId || null]
      });
    } else {
      comboGroup = this.fb.group({
        deviceId: [initialData?.deviceId || '', Validators.required],
        messageId: [initialData?.messageId || '', Validators.required],
        displayOrder: [initialData?.displayOrder || this.deviceCombos.length + 1, [Validators.required, Validators.min(1)]],
        isActive: [initialData?.isActive !== undefined ? initialData.isActive : true],
        isDefault: [initialData?.isDefault || false],
        deviceMessageComboId: [initialData?.deviceMessageComboId || null]
      });
    }

    this.deviceCombos.push(comboGroup);
  }

  removeDeviceCombo(index: number): void {
    this.deviceCombos.removeAt(index);
  }

  // toggleComboMode(): void {
  //   // Clear existing combos when switching modes
  //   while (this.deviceCombos.length) {
  //     this.deviceCombos.removeAt(0);
  //   }

  //   // Reset selections
  //   this.selectedExistingCombos = [];
  //   this.selectedExistingMessageCombos = [];

  //   // Add initial combo
  //   this.addDeviceCombo();
  // }

  toggleComboMode(): void {
    // Store the previous mode
    const previousMode = this.comboMode === 'device-template' ? 'device-message' : 'device-template';

    // Clear existing combos
    while (this.deviceCombos.length) {
      this.deviceCombos.removeAt(0);
    }

    // Reset selections
    this.selectedExistingCombos = [];
    this.selectedExistingMessageCombos = [];

    // If we have stored assignments, process them for the new mode
    if (this.allAssignments && this.allAssignments.length > 0) {
      this.processAssignmentsForCurrentMode();
    } else {
      // Otherwise add a new empty combo
      this.addDeviceCombo();
    }
  }

  //   toggleComboMode(): void {
  //   // Don't clear combos immediately - ask user for confirmation
  //   if (this.deviceCombos.length > 0) {
  //     const confirm = window.confirm(
  //       'Switching combo type will remove existing assignments. Continue?'
  //     );

  //     if (!confirm) {
  //       // Revert the combo mode change
  //       this.comboMode = this.comboMode === 'device-template' ? 'device-message' : 'device-template';
  //       return;
  //     }
  //   }

  //   // Clear existing combos when switching modes
  //   while (this.deviceCombos.length) {
  //     this.deviceCombos.removeAt(0);
  //   }

  //   // Reset selections
  //   this.selectedExistingCombos = [];
  //   this.selectedExistingMessageCombos = [];

  //   // Add initial combo
  //   this.addDeviceCombo();
  // }

  addSelectedExistingCombos(): void {
    if (this.comboMode === 'device-template') {
      // First, collect all template IDs from selected combos
      const templateIdsToLoad = this.selectedExistingCombos
        .map(combo => combo.templateId)
        .filter((id): id is string => !!id && id !== '');

      // Load any missing templates
      this.loadSpecificTemplates(templateIdsToLoad).then(() => {
        // Now add the combos with templates loaded
        this.selectedExistingCombos.forEach(combo => {
          this.addDeviceCombo({
            deviceId: combo.deviceId,
            templateId: combo.templateId || '',
            displayOrder: this.deviceCombos.length + 1,
            isActive: combo.isActive,
            isDefault: combo.isDefault,
            deviceTemplateComboId: combo.id
          });
        });

        this.showSuccess(`Added ${this.selectedExistingCombos.length} template combo(s)`);
        this.selectedExistingCombos = [];
      });
    } else {
      this.selectedExistingMessageCombos.forEach(combo => {
        this.addDeviceCombo({
          deviceId: combo.deviceId,
          messageId: combo.messageId,
          displayOrder: this.deviceCombos.length + 1,
          isActive: combo.isActive,
          isDefault: false,
          deviceMessageComboId: combo.id
        });
      });
      this.showSuccess(`Added ${this.selectedExistingMessageCombos.length} message combo(s)`);
      this.selectedExistingMessageCombos = [];
    }
  }

  // Add this method to load specific templates by ID
  // private async loadSpecificTemplates(templateIds: string[]): Promise<void> {
  //   if (!templateIds.length) return;

  //   // Filter out templates already loaded
  //   const missingIds = templateIds.filter(id => 
  //     !this.templates.some(t => t.id.toString() === id.toString())
  //   );

  //   if (!missingIds.length) return;

  //   try {

  //     // Option A: If your service supports loading by IDs
  //     const loadedTemplates = await firstValueFrom(
  //       this.deviceService.getTemplatesByIds(missingIds)
  //     );

  //     // Add to existing templates (avoid duplicates)
  //     loadedTemplates.forEach(template => {
  //       if (!this.templates.some(t => t.id === template.id)) {
  //         this.templates.push(template);
  //       }
  //     });

  //     // Update filteredTemplates if they're shown
  //     if (!this.templateSearchTerm) {
  //       this.filteredTemplates = [...this.templates];
  //     }

  //   } catch (error) {
  //     console.error('Error loading specific templates:', error);
  //     // Continue anyway - the template name will show as "Unknown Template"
  //   }
  // }

  private async loadMissingItemsForSelectedCombos(selectedCombos: any[]): Promise<void> {
    if (this.loadingMissingItems || !selectedCombos.length) return;

    this.loadingMissingItems = true;

    try {
      // Extract IDs from selected combos based on mode
      if (this.comboMode === 'device-template') {
        const deviceIds: number[] = [];
        const templateIds: string[] = [];

        selectedCombos.forEach(combo => {
          if (combo.deviceId && !this.isDeviceLoaded(combo.deviceId)) {
            deviceIds.push(combo.deviceId);
          }
          if (combo.templateId && !this.isTemplateLoaded(combo.templateId)) {
            templateIds.push(combo.templateId);
          }
        });

        // Load missing devices and templates in parallel
        await Promise.all([
          this.loadSpecificDevices(deviceIds),
          this.loadSpecificTemplates(templateIds)
        ]);

      } else if (this.comboMode === 'device-message') {
        const deviceIds: number[] = [];
        const messageIds: number[] = [];

        selectedCombos.forEach(combo => {
          if (combo.deviceId && !this.isDeviceLoaded(combo.deviceId)) {
            deviceIds.push(combo.deviceId);
          }
          if (combo.messageId && !this.isMessageLoaded(combo.messageId)) {
            messageIds.push(combo.messageId);
          }
        });

        // Load missing devices and messages in parallel
        await Promise.all([
          this.loadSpecificDevices(deviceIds),
          this.loadSpecificMessages(messageIds)
        ]);
      }

    } catch (error) {
      console.error('Error loading missing items for selected combos:', error);
    } finally {
      this.loadingMissingItems = false;
    }
  }

  // Helper methods to check if items are loaded
  private isDeviceLoaded(deviceId: number): boolean {
    return this.devices.some(d => d.id === deviceId);
  }

  private isTemplateLoaded(templateId: string): boolean {
    return this.templates.some(t => t.id.toString() === templateId.toString());
  }

  private isMessageLoaded(messageId: number): boolean {
    return this.messages.some(m => m.id === messageId);
  }

  //   private clearForm(): void {
  //   this.shelfForm.reset({
  //     isActive: true,
  //     createdUser: this.auth.getCurrentUserValue()?.id || 0
  //   });
  //   this.deviceCombos.clear();
  //   this.comboMode = 'device-template';
  //   this.selectedExistingCombos = [];
  //   this.selectedExistingMessageCombos = [];

  //   // Reset search state
  //   this.resetTemplateSearch();
  // }
  //#endregion

  //#region Data Loading Methods
  private async loadAisles(): Promise<void> {
    try {
      this.aisles = await firstValueFrom(this.aisleService.getAllAisles());
    } catch (error) {
      console.error('Error loading aisles:', error);
      this.showError('Failed to load aisles.');
    }
  }

  private async loadDevices(): Promise<void> {
    if (!this.storeId || this.deviceLoading) return;

    this.deviceLoading = true;

    try {
      const pagedResult = await firstValueFrom(
        this.deviceService.getLocalDevicesPagedbyStore(
          this.storeId,
          this.devicePage,
          this.pageSize,
          this.deviceSearchTerm
        )
      );

      const newDevices = pagedResult.items || [];
      console.log("devices", newDevices)
      if (this.devicePage === 1) {
        this.devices = newDevices;
      } else {
        this.devices = [...this.devices, ...newDevices];
      }

      this.deviceHasMore = this.devices.length < (pagedResult.totalCount || 0);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      this.deviceLoading = false;
    }
  }
  private async loadTemplates(): Promise<void> {
    if (!this.storeId || this.templateLoading) return;

    this.templateLoading = true;

    try {
      // Pass the search term (empty string for "all templates")
      const pagedResult = await firstValueFrom(
        this.deviceService.getLocalTemplatesPagedByStore(
          this.storeId,
          this.templatePage,
          this.pageSize,
          this.templateSearchTerm // Pass search term to backend (empty for all)
        )
      );

      const newTemplates = pagedResult.items || [];

      if (this.templatePage === 1) {
        this.templates = newTemplates;
        this.filteredTemplates = [...newTemplates]; // Initialize filtered templates
      } else {
        this.templates = [...this.templates, ...newTemplates];

        // Update filtered templates based on current search
        if (this.templateSearchTerm) {
          // Re-filter with current search term
          this.filteredTemplates = this.templates.filter(template =>
            template.name.toLowerCase().includes(this.templateSearchTerm.toLowerCase()) ||
            template.screenWidth?.toString().includes(this.templateSearchTerm) ||
            template.screenHeight?.toString().includes(this.templateSearchTerm)
          );
        } else {
          this.filteredTemplates = [...this.templates]; // Show all when no search
        }
      }

      this.templateHasMore = this.templates.length < (pagedResult.totalCount || 0);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      this.templateLoading = false;
    }
  }

  //  private async loadTemplates(): Promise<void> {
  //   if (!this.storeId || this.templateLoading) return;

  //   this.templateLoading = true;

  //   try {
  //     const pagedResult = await firstValueFrom(
  //       this.deviceService.getLocalTemplatesPagedByStore(
  //         this.storeId,
  //         this.templatePage,
  //         this.pageSize,
  //         this.templateSearchTerm // Pass search term to backend
  //       )
  //     );

  //     const newTemplates = pagedResult.items || [];

  //     if (this.templatePage === 1) {
  //       this.templates = newTemplates;
  //       this.filteredTemplates = [...newTemplates]; // Initialize filtered templates
  //     } else {
  //       this.templates = [...this.templates, ...newTemplates];
  //       this.filteredTemplates = [...this.templates]; // Update filtered templates
  //     }

  //     this.templateHasMore = this.templates.length < (pagedResult.totalCount || 0);
  //   } catch (error) {
  //     console.error('Error loading templates:', error);
  //   } finally {
  //     this.templateLoading = false;
  //   }
  // }


  private async loadMessages(): Promise<void> {
    if (this.messageLoading) return;

    this.messageLoading = true;

    try {
      const request: SearchParams = {
        pageNumber: this.messagePage,
        pageSize: this.pageSize,
        searchTerm: this.messageSearchTerm,
      };

      const response = await firstValueFrom(
        this.messageService.getMessagesPaged(request)
      );

      if (response.success && response.result) {
        const pagedResult = response.result;
        const newMessages = pagedResult.items || [];

        if (this.messagePage === 1) {
          this.messages = newMessages;
        } else {
          this.messages = [...this.messages, ...newMessages];
        }

        this.messageHasMore = this.messages.length < (pagedResult.totalCount || 0);
        this.messagePage = pagedResult.pageNumber || this.messagePage;
      } else {
        console.warn('Failed to load messages:', response.message);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      this.messageLoading = false;
    }
  }

  // private async loadMessages(): Promise<void> {
  //   if (this.messageLoading) return;

  //   this.messageLoading = true;

  //   try {
  //     const request: SearchParams = {
  //       pageNumber: this.messagePage,
  //       pageSize: this.pageSize,
  //       searchTerm: this.messageSearchTerm,
  //       // isActive: true
  //     };

  //     const pagedResult = await firstValueFrom(
  //       this.messageService.getMessagesPaged(request)
  //     );

  //     const newMessages = pagedResult.items || [];

  //     if (this.messagePage === 1) {
  //       this.messages = newMessages;
  //     } else {
  //       this.messages = [...this.messages, ...newMessages];
  //     }

  //     this.messageHasMore = this.messages.length < (pagedResult.totalCount || 0);
  //   } catch (error) {
  //     console.error('Error loading messages:', error);
  //   } finally {
  //     this.messageLoading = false;
  //   }
  // }

  // private async loadExistingCombos(): Promise<void> {
  //   if (this.existingComboLoading) return;

  //   this.existingComboLoading = true;

  //   try {
  //     const request: SearchParams = {
  //       pageNumber: this.existingComboPage,
  //       pageSize: this.pageSize,
  //       searchTerm: this.existingComboSearchTerm
  //     };

  //     const pagedResult = await firstValueFrom(
  //       this.deviceService.getCombosPaged(request)
  //     );

  //     const result = pagedResult.result;
  //     const newCombos = result?.items || [];

  //     const mappedCombos = newCombos.map((combo: any) => ({
  //       id: combo.id,
  //       deviceId: combo.deviceId,
  //       deviceName: combo.deviceName,
  //       templateId: combo.templateId,
  //       templateName: combo.templateName,
  //       deviceMAC: combo.deviceMac || combo.deviceMAC || '',
  //       status: 'Active',
  //       isDefault: combo.isDefault,
  //       isActive: true,
  //       screenSize: combo.screenSize,
  //       screenWidth: combo.screenWidth,
  //       screenHeight: combo.screenHeight,
  //       battery: combo.battery
  //     }));

  //     if (this.existingComboPage === 1) {
  //       this.existingCombos = mappedCombos;
  //     } else {
  //       this.existingCombos = [...this.existingCombos, ...mappedCombos];
  //     }

  //     this.existingComboHasMore = this.existingCombos.length < (result?.totalCount || 0);
  //   } catch (error) {
  //     console.error('Error loading existing combos:', error);
  //   } finally {
  //     this.existingComboLoading = false;
  //   }
  // }

  public async loadExistingCombos(loadDirection: 'initial' | 'next' | 'prev' = 'initial'): Promise<void> {
    if (this.existingComboLoading) return;

    this.existingComboLoading = true;

    // Set loading flags based on direction
    if (loadDirection === 'next') {
      this.existingComboLoadingNext = true;
    } else if (loadDirection === 'prev') {
      this.existingComboLoadingPrev = true;
    }

    try {
      // Calculate page number based on direction
      let targetPage = this.existingComboPage;

      if (loadDirection === 'next') {
        targetPage = this.existingComboCurrentPage + 1;
      } else if (loadDirection === 'prev') {
        targetPage = this.existingComboCurrentPage - 1;
      } else {
        targetPage = 1;
        this.existingComboCurrentPage = 1;
      }

      // Prepare search params with search term
      const request: SearchParams = {
        pageNumber: targetPage,
        pageSize: this.pageSize,
        searchTerm: this.existingComboSearchTerm // Server-side search
      };

      // Call API with search term
      const pagedResult = await firstValueFrom(
        this.deviceService.getCombosPaged(request)
      );

      const result = pagedResult.result;
      const newCombos = result?.items || [];

      const mappedCombos = newCombos.map((combo: any) => ({
        id: combo.id,
        deviceId: combo.deviceId,
        deviceName: combo.deviceName,
        templateId: combo.templateId,
        templateName: combo.templateName,
        deviceMAC: combo.deviceMac || combo.deviceMAC || '',
        status: 'Active',
        isDefault: combo.isDefault,
        isActive: true,
        screenSize: combo.screenSize,
        screenWidth: combo.screenWidth,
        screenHeight: combo.screenHeight,
        battery: combo.battery
      }));

      console.log("template combo", mappedCombos)
      // Update totals from server response
      this.existingComboTotalItems = result?.totalCount || 0;
      this.existingComboTotalPages = Math.ceil(this.existingComboTotalItems / this.pageSize);

      // Handle different loading scenarios
      if (this.existingComboSearchTerm) {
        // For search results, replace items (not accumulate)
        if (loadDirection === 'next') {
          // For search pagination, add to existing search results
          this.existingComboAllLoadedItems = [...this.existingComboAllLoadedItems, ...mappedCombos];
          this.existingComboCurrentPage = targetPage;
        } else if (loadDirection === 'prev') {
          // Prepend previous search results
          this.existingComboAllLoadedItems = [...mappedCombos, ...this.existingComboAllLoadedItems];
          this.existingComboCurrentPage = targetPage;
        } else {
          // Initial search - replace all items
          this.existingComboAllLoadedItems = mappedCombos;
          this.existingComboCurrentPage = 1;
        }
      } else {
        // For normal browsing (no search)
        if (loadDirection === 'next') {
          this.existingComboAllLoadedItems = [...this.existingComboAllLoadedItems, ...mappedCombos];
          this.existingComboCurrentPage = targetPage;
        } else if (loadDirection === 'prev') {
          this.existingComboAllLoadedItems = [...mappedCombos, ...this.existingComboAllLoadedItems];
          this.existingComboCurrentPage = targetPage;
        } else {
          this.existingComboAllLoadedItems = mappedCombos;
          this.existingComboCurrentPage = 1;
        }
      }

      // Update page tracking
      this.existingComboPage = targetPage;

      // Update visible items
      this.updateVisibleExistingCombos();

    } catch (error) {
      console.error('Error loading existing combos:', error);
      this.showError('Failed to load combos. Please try again.');
    } finally {
      this.existingComboLoading = false;
      this.existingComboLoadingNext = false;
      this.existingComboLoadingPrev = false;
    }
  }

  // Load next page of combos
  async loadMoreExistingCombos(): Promise<void> {
    if (this.existingComboLoadingNext || !this.hasMoreCombos()) return;

    await this.loadExistingCombos('next');
  }

  // Load previous page of combos
  async loadPreviousExistingCombos(): Promise<void> {
    if (this.existingComboLoadingPrev || !this.hasPreviousCombos()) return;

    await this.loadExistingCombos('prev');
  }

  // Handle filter changes
  onExistingComboFilter(event: any): void {
    const filterValue = event.filter || '';

    // Clear previous timer
    if (this.existingComboSearchDebounceTimer) {
      clearTimeout(this.existingComboSearchDebounceTimer);
    }

    // Debounce search by 500ms
    this.existingComboSearchDebounceTimer = setTimeout(() => {
      this.performServerSideSearch(filterValue);
    }, 500);
  }

  private async performServerSideSearch(searchTerm: string): Promise<void> {
    // Update search term
    this.existingComboSearchTerm = searchTerm;

    // Reset pagination for new search
    this.resetExistingComboPaginationForSearch();

    // Load search results
    await this.loadExistingCombos('initial');
  }

  // Reset pagination specifically for search
  private resetExistingComboPaginationForSearch(): void {
    this.existingComboPage = 1;
    this.existingComboCurrentPage = 1;
    this.existingComboAllLoadedItems = [];
    this.existingComboVisibleItems = [];
    this.selectedExistingCombos = []; // Clear selection on new search
  }

  // Check if there are more combos to load
  hasMoreCombos(): boolean {
    // During search, we need to check if server has more pages
    if (this.existingComboSearchTerm) {
      return this.existingComboCurrentPage < this.existingComboTotalPages;
    }
    // During normal browsing
    return this.existingComboCurrentPage < this.existingComboTotalPages;
  }

  hasPreviousCombos(): boolean {
    // During search, allow going back if we're not on first page
    if (this.existingComboSearchTerm) {
      return this.existingComboCurrentPage > 1;
    }
    // During normal browsing
    return this.existingComboCurrentPage > 1;
  }

  // Search change handler with debounce
  onExistingComboSearchChange(searchTerm: string): void {
    this.existingComboSearchTerm = searchTerm;

    // Clear any pending search
    if (this.existingComboSearchDebounceTimer) {
      clearTimeout(this.existingComboSearchDebounceTimer);
    }

    // Debounce search by 500ms
    this.existingComboSearchDebounceTimer = setTimeout(() => {
      this.performExistingComboSearch();
    }, 500);
  }


  // Perform the search
  private performExistingComboSearch(): void {
    // Reset pagination on new search
    this.resetExistingComboPagination();

    // Load with search term
    this.loadExistingCombos('initial');
  }

  // Clear search
  clearExistingComboSearch(): void {
    this.existingComboSearchTerm = '';
    this.resetExistingComboPaginationForSearch();
    this.loadExistingCombos('initial');
  }


  // Highlight search term in results
  highlightSearchTerm(text: string): string {
    if (!this.existingComboSearchTerm || !text) {
      return text || '';
    }

    const searchLower = this.existingComboSearchTerm.toLowerCase();
    const textLower = text.toLowerCase();

    if (textLower.includes(searchLower)) {
      const regex = new RegExp(`(${this.existingComboSearchTerm})`, 'gi');
      return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    return text;
  }
  // Reset to first page
  resetExistingComboPagination(): void {
    this.existingComboPage = 1;
    this.existingComboCurrentPage = 1;
    this.existingComboAllLoadedItems = [];
    this.existingComboVisibleItems = [];
    this.existingComboTotalItems = 0;
    this.existingComboTotalPages = 0;
    this.selectedExistingCombos = []; // Clear selection on search
  }

  private updateVisibleExistingCombos(): void {
    if (this.existingComboSearchTerm) {
      // For search results, show all loaded search items
      this.existingComboVisibleItems = [...this.existingComboAllLoadedItems];
    } else {
      // For normal browsing, show only current page items
      const startIndex = (this.existingComboCurrentPage - 1) * this.pageSize;
      const endIndex = Math.min(startIndex + this.pageSize, this.existingComboAllLoadedItems.length);
      this.existingComboVisibleItems = this.existingComboAllLoadedItems.slice(startIndex, endIndex);
    }
  }

  private async loadExistingMessageCombos(): Promise<void> {
    if (this.existingMessageComboLoading) return;

    this.existingMessageComboLoading = true;

    try {
      const request: SearchParams & { deviceId?: number; messageId?: number; isActive?: boolean } = {
        pageNumber: this.existingMessageComboPage,
        pageSize: this.pageSize,
        searchTerm: this.existingMessageComboSearchTerm,
        isActive: true
      };

      const pagedResult = await firstValueFrom(
        this.deviceService.getDeviceMessageCombosPagedByParams(request)
      );
      this.existingMessageCombos = this.normalizeMessageCombos(pagedResult.items || []);

      const newCombos = pagedResult.items || [];
      console.log("newcombos for msg", newCombos);

      const mappedCombos = await Promise.all(newCombos.map(async (combo: any) => {
        let deviceName = 'Unknown Device';
        let messageTitle = 'Unknown Message';
        // Try to get device name
        if (combo.deviceId) {
          const device = this.devices.find(d => d.id === combo.deviceId);
          if (device) deviceName = device.deviceName;
        }

        // Try to get message title
        if (combo.messageId) {
          const message = this.messages.find(m => m.id === combo.messageId);
          if (message) messageTitle = message.title;
        }

        return {
          id: combo.id,
          deviceId: combo.deviceId,
          deviceName: deviceName,
          messageId: combo.messageId,
          messageTitle: messageTitle,
          deviceMAC: combo.deviceMac || '',
          status: combo.isActive ? 'Active' : 'Inactive',
          isDefault: false,
          isActive: combo.isActive
        };
      }));

      if (this.existingMessageComboPage === 1) {
        this.existingMessageCombos = mappedCombos;
      } else {
        this.existingMessageCombos = [...this.existingMessageCombos, ...mappedCombos];
      }

      this.existingMessageComboHasMore = this.existingMessageCombos.length < (pagedResult.totalCount || 0);
    } catch (error) {
      console.error('Error loading existing message combos:', error);
    } finally {
      this.existingMessageComboLoading = false;
    }
  }

  // Load specific devices by IDs
  private async loadSpecificDevices(deviceIds: number[]): Promise<void> {
    if (!deviceIds.length) return;

    const uniqueIds = [...new Set(deviceIds)];
    const requestKey = `devices:${uniqueIds.sort().join(',')}`;

    // Skip if already loading
    if (this.missingItemRequests.has(requestKey)) return;
    this.missingItemRequests.add(requestKey);

    try {
      const loadedDevices = await firstValueFrom(
        this.deviceService.getDevicesByIds(uniqueIds)
      );

      // Add to existing devices (avoid duplicates)
      loadedDevices.forEach(device => {
        if (!this.devices.some(d => d.id === device.id)) {
          this.devices.push(device);
        }
      });

      // Update UI if needed
      this.cdRef.detectChanges();

    } catch (error) {
      console.error('Error loading specific devices:', error);
    } finally {
      this.missingItemRequests.delete(requestKey);
    }
  }

  // Load specific templates by IDs
  private async loadSpecificTemplates(templateIds: string[]): Promise<void> {
    if (!templateIds.length) return;

    const uniqueIds = [...new Set(templateIds)];
    const requestKey = `templates:${uniqueIds.sort().join(',')}`;

    if (this.missingItemRequests.has(requestKey)) return;
    this.missingItemRequests.add(requestKey);

    try {
      // Directly pass string IDs to service
      const loadedTemplates = await firstValueFrom(
        this.deviceService.getTemplatesByIds(uniqueIds) // Service now accepts string[]
      );

      // Add to existing templates
      loadedTemplates.forEach(template => {
        // Ensure consistent ID comparison (both as strings)
        const templateIdStr = template.id.toString();
        if (!this.templates.some(t => t.id.toString() === templateIdStr)) {
          this.templates.push(template);
        }
      });

      // Update filteredTemplates
      if (!this.templateSearchTerm) {
        this.filteredTemplates = [...this.templates];
      }

      this.cdRef.detectChanges();

    } catch (error) {
      console.error('Error loading specific templates:', error);
    } finally {
      this.missingItemRequests.delete(requestKey);
    }
  }

  // Load specific messages by IDs
  private async loadSpecificMessages(messageIds: number[]): Promise<void> {
    if (!messageIds.length) return;

    const uniqueIds = [...new Set(messageIds)];
    const requestKey = `messages:${uniqueIds.sort().join(',')}`;

    if (this.missingItemRequests.has(requestKey)) return;
    this.missingItemRequests.add(requestKey);

    try {
      const loadedMessages = await firstValueFrom(
        this.messageService.getMessagesByIds(uniqueIds)
      );

      // Add to existing messages
      loadedMessages.forEach(message => {
        if (!this.messages.some(m => m.id === message.id)) {
          this.messages.push(message);
        }
      });

      this.cdRef.detectChanges();

    } catch (error) {
      console.error('Error loading specific messages:', error);
    } finally {
      this.missingItemRequests.delete(requestKey);
    }
  }
  //#endregion

  //#region Lazy Load Handlers (New Methods)
  onDeviceLazyLoad(event: any): void {
    const { first, rows, filter } = event;
    const pageNumber = Math.floor(first / rows) + 1;

    if (filter && filter !== this.deviceSearchTerm) {
      this.deviceFilterSubject.next(filter);
    } else if (first + rows >= this.devices.length && this.deviceHasMore && !this.deviceLoading) {
      this.devicePage = pageNumber;
      this.loadDevices();
    }
  }

  // onTemplateLazyLoad(event: any): void {
  //   const { first, rows, filter } = event;
  //   const pageNumber = Math.floor(first / rows) + 1;

  //   if (filter && filter !== this.templateSearchTerm) {
  //     this.templateFilterSubject.next(filter);
  //   } else if (first + rows >= this.templates.length && this.templateHasMore && !this.templateLoading) {
  //     this.templatePage = pageNumber;
  //     this.loadTemplates();
  //   }
  // }

  // Update onTemplateLazyLoad method
  onTemplateLazyLoad(event: any): void {
    const { first, rows, filter } = event;
    const pageNumber = Math.floor(first / rows) + 1;

    // If filter changed, trigger backend search
    if (filter && filter !== this.templateSearchTerm) {
      this.templateSearchDebounce.next(filter);
    }
    // If scrolling to load more and we have more to load
    else if (first + rows >= this.templates.length && this.templateHasMore && !this.templateLoading) {
      this.templatePage = pageNumber;
      this.loadTemplates();
    }
  }

  // Add loadMoreTemplates method
  loadMoreTemplates(): void {
    if (!this.templateLoading && this.templateHasMore) {
      this.templatePage++;
      this.loadTemplates();
    }
  }

  resetTemplateSearch(): void {
    this.templateSearchTerm = '';
    this.templatePage = 1;
    this.templates = [];
    this.filteredTemplates = [];
    this.loadTemplates();
  }

  onMessageLazyLoad(event: any): void {
    const { first, rows, filter } = event;
    const pageNumber = Math.floor(first / rows) + 1;

    if (filter && filter !== this.messageSearchTerm) {
      this.messageFilterSubject.next(filter);
    } else if (first + rows >= this.messages.length && this.messageHasMore && !this.messageLoading) {
      this.messagePage = pageNumber;
      this.loadMessages();
    }
  }

  onExistingComboLazyLoad(event: any): void {
    const { first, rows, filter } = event;
    const pageNumber = Math.floor(first / rows) + 1;

    if (filter && filter !== this.existingComboSearchTerm) {
      this.existingComboFilterSubject.next(filter);
    } else if (first + rows >= this.existingCombos.length && this.existingComboHasMore && !this.existingComboLoading) {
      this.existingComboPage = pageNumber;
      this.loadExistingCombos();
    }
  }

  onExistingMessageComboLazyLoad(event: any): void {
    const { first, rows, filter } = event;
    const pageNumber = Math.floor(first / rows) + 1;

    if (filter && filter !== this.existingMessageComboSearchTerm) {
      this.existingMessageComboFilterSubject.next(filter);
    } else if (first + rows >= this.existingMessageCombos.length && this.existingMessageComboHasMore && !this.existingMessageComboLoading) {
      this.existingMessageComboPage = pageNumber;
      this.loadExistingMessageCombos();
    }
  }

  //   onTemplateFilter(event: any): void {
  //   // PrimeNG passes the filter value in event.filter
  //   const filterValue = event.filter || '';

  //   // If filter is empty, show all loaded templates
  //   if (!filterValue.trim()) {
  //     this.filteredTemplates = [...this.templates];
  //     return;
  //   }

  //   // First filter locally from already loaded templates
  //   const localFiltered = this.templates.filter(template =>
  //     template.name.toLowerCase().includes(filterValue.toLowerCase()) ||
  //     template.screenWidth?.toString().includes(filterValue) ||
  //     template.screenHeight?.toString().includes(filterValue)
  //   );

  //   this.filteredTemplates = localFiltered;

  //   // If we have more templates to load and local results are limited,
  //   // trigger backend search
  //   if (this.templateHasMore && localFiltered.length < 5) {
  //     this.templateSearchDebounce.next(filterValue);
  //   }
  // }

  onTemplateFilter(event: any): void {
    // PrimeNG passes the filter value in event.filter
    const filterValue = event.filter || '';

    // Always update the search term
    this.templateSearchTerm = filterValue;

    // If filter is empty, trigger backend call to get ALL templates
    if (!filterValue.trim()) {
      this.templateSearchDebounce.next(''); // Send empty string to backend
      return;
    }

    // First filter locally from already loaded templates
    const localFiltered = this.templates.filter(template =>
      template.name.toLowerCase().includes(filterValue.toLowerCase()) ||
      template.screenWidth?.toString().includes(filterValue) ||
      template.screenHeight?.toString().includes(filterValue)
    );

    this.filteredTemplates = localFiltered;

    // Always trigger backend search when user types
    // This ensures we get all matching templates from database
    this.templateSearchDebounce.next(filterValue);
  }
  //#endregion

  //#region UI Helper Methods (New Methods)
  toggleTab(index: number): void {
    this.activeTabIndex = index;
  }

  getDeviceName(deviceId: number): string {
    const device = this.devices.find(d => d.id === deviceId);
    return device ? device.deviceName : 'Unknown Device';
  }

  getTemplateName(templateId: string): string {
    const template = this.templates.find(t => t.id === templateId);
    return template ? template.name : 'Unknown Template';
  }

  getMessageTitle(messageId: number): string {
    const message = this.messages.find(m => m.id === messageId);
    return message ? message.title : 'Unknown Message';
  }

  getContentTypeString(contentType: number): string {
    const types: { [key: number]: string } = {
      0: 'General',
      1: 'Image',
      2: 'Video',
      3: 'Custom Image'
    };
    return types[contentType] || 'General';
  }

  getDeviceStatus(deviceId: number): string {
    const device = this.devices.find(d => d.id === deviceId);
    return device?.status || 'Unknown';
  }

  getDeviceStatusClass(deviceId: number): string {
    const status = this.getDeviceStatus(deviceId);
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'offline': return 'bg-gray-100 text-gray-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  }

  showComboPreview(combo: any): void {
    // This can be extended to show a preview dialog
    console.log('Show preview for combo:', combo);
  }

  get selectedCombos() {
    return this.comboMode === 'device-template'
      ? this.selectedExistingCombos
      : this.selectedExistingMessageCombos;
  }

  set selectedCombos(value: any) {
    if (this.comboMode === 'device-template') {
      this.selectedExistingCombos = value;
    } else {
      this.selectedExistingMessageCombos = value;
    }
  }

  // In your component.ts, normalize the data:
  normalizeMessageCombos(messages: any[]) {
    return messages.map(msg => ({
      id: msg.id,
      deviceName: msg.deviceName || msg.device?.deviceName || 'Unknown Device',
      deviceMAC: msg.deviceMAC || msg.device?.mac || 'No MAC',
      templateName: msg.messageTitle || msg.title || 'No Message',
      messageTitle: msg.messageTitle || msg.title || 'No Message', // Add for consistency
      status: msg.status || 'Active',
      screenWidth: null, // Explicitly set null for messages
      screenHeight: null,
      screenSize: null,
      contentType: msg.contentType,
      duration: msg.duration,
      _type: 'device-message' // Add type identifier
    }));
  }

  //#endregion

  //#region Validation Methods
  getFieldError(fieldName: string): string {
    const field = this.shelfForm.get(fieldName);
    if (field?.invalid && field?.touched) {
      if (field.errors?.['required']) {
        return `${this.getFieldLabel(fieldName)} is required`;
      }
      if (field.errors?.['minlength']) {
        return `${this.getFieldLabel(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
      if (field.errors?.['maxlength']) {
        return `${this.getFieldLabel(fieldName)} cannot exceed ${field.errors['maxlength'].requiredLength} characters`;
      }
      if (field.errors?.['pattern']) {
        if (fieldName === 'ipAddress') {
          return 'Please enter a valid IP address (e.g., 192.168.1.20)';
        }
        return `Please enter a valid ${fieldName}`;
      }
    }
    return '';
  }

  getDeviceComboFieldError(index: number, fieldName: string): string {
    const comboGroup = this.deviceCombos.at(index) as FormGroup;
    const field = comboGroup.get(fieldName);
    if (field?.invalid && field?.touched) {
      if (field.errors?.['required']) {
        return `${fieldName === 'deviceId' ? 'Device' :
          fieldName === 'templateId' ? 'Template' :
            fieldName === 'messageId' ? 'Message' :
              fieldName} is required`;
      }
      if (field.errors?.['min']) {
        return 'Display order must be at least 1';
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      'aisleId': 'Aisle',
      'name': 'Shelf name',
      'location': 'Location',
      'description': 'Description',
      'coordinates': 'Coordinates',
      'ipAddress': 'IP Address',
      'macAddress': 'MAC Address',
      'deviceName': 'Device Name'
    };
    return labels[fieldName] || fieldName;
  }

  markFormGroupTouched(): void {
    Object.keys(this.shelfForm.controls).forEach(key => {
      const control = this.shelfForm.get(key);
      control?.markAsTouched();
    });

    this.deviceCombos.controls.forEach(combo => {
      Object.keys((combo as FormGroup).controls).forEach(key => {
        (combo as FormGroup).get(key)?.markAsTouched();
      });
    });
  }
  //#endregion

  //#region Submit Methods
  async onSubmit(): Promise<void> {
    console.log('onSubmit triggered');

    const formValue = this.shelfForm.value;
    console.log('Form value:', formValue);
    if (this.shelfForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting = true;

    try {
      const formValue = this.shelfForm.value;
      const shelfData: Shelf = {
        aisleId: formValue.aisleId,
        name: formValue.name,
        location: formValue.location,
        description: formValue.description,
        coordinates: formValue.coordinates,
        isActive: formValue.isActive,
        storeId: this.storeId,
        createdUser: formValue.createdUser,
        createdDate: new Date(),
        updatedDate: new Date()
      };

      let createdShelf: Shelf;

      if (this.isEditMode && formValue.id) {
        // Update existing shelf
        console.log('Updating shelf with data:', shelfData);
        const updateData = { ...shelfData, id: formValue.id };
        createdShelf = await firstValueFrom(this.shelfService.updateShelf(updateData));
      } else {
        // Create new shelf
        console.log('Creating new shelf with data:', shelfData);
        createdShelf = await firstValueFrom(this.shelfService.createShelf(shelfData));
      }

      // Process device combos
      if (createdShelf && createdShelf.id) {
        await this.processDeviceCombos(createdShelf.id, formValue.deviceCombos);
      }

      const successMessage = this.isEditMode ?
        'Shelf updated successfully!' :
        'Shelf created successfully!';

      this.showSuccess(successMessage);
      this.dialogRef.close({ success: true, data: createdShelf });
    } catch (error) {
      console.error('Error saving shelf:', error);
      this.showError('Failed to save shelf. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }

  private async processDeviceCombos(shelfId: number, deviceCombos: DeviceComboForm[]): Promise<void> {
    const currentUser = this.auth.getCurrentUserValue();
    const userId = currentUser?.id || 0;

    const processedCombos = [];
    const failedCombos = [];

    // Track all current combo IDs for cleanup
    const currentComboIds: { type: string, id?: number }[] = [];

    for (let i = 0; i < deviceCombos.length; i++) {
      const combo = deviceCombos[i];

      try {
        let result: ProcessedComboResult;

        if (this.comboMode === 'device-template') {
          if (combo.deviceTemplateComboId) {
            // Update existing combo
            await this.updateExistingTemplateCombo(combo, shelfId, userId, i + 1);
            currentComboIds.push({ type: 'TEMPLATE', id: combo.deviceTemplateComboId });
          } else {
            // Create new combo
            result = await this.processTemplateCombo(combo, shelfId, userId, i + 1);
            if (result.success && result.id) {
              currentComboIds.push({ type: 'TEMPLATE', id: result.id });
            } else {
              throw new Error(result.message || 'Failed to create template combo');
            }
          }
        } else {
          if (combo.deviceMessageComboId) {
            // Update existing message combo
            await this.updateExistingMessageCombo(combo, shelfId, userId, i + 1);
            currentComboIds.push({ type: 'MESSAGE', id: combo.deviceMessageComboId });
          } else {
            // Create new message combo
            result = await this.processMessageCombo(combo, shelfId, userId, i + 1);
            if (result.success && result.id) {
              currentComboIds.push({ type: 'MESSAGE', id: result.id });
            } else {
              throw new Error(result.message || 'Failed to create message combo');
            }
          }
        }

        processedCombos.push({ index: i + 1, status: 'success' });
      } catch (error) {
        console.error(`Failed to process combo ${i + 1}:`, error);
        failedCombos.push({
          index: i + 1,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Handle cleanup: Remove assignments that were deleted
    await this.cleanupDeletedAssignments(shelfId, currentComboIds);

    // Show summary
    if (processedCombos.length > 0) {
      this.showSuccess(
        `${processedCombos.length} combo(s) processed successfully`
      );
    }

    if (failedCombos.length > 0) {
      this.showWarning(
        `${failedCombos.length} combo(s) failed to process. Please check the console for details.`
      );
    }
  }

  private async updateExistingTemplateCombo(combo: DeviceComboForm, shelfId: number, userId: number, displayOrder: number): Promise<void> {
    try {
      const comboId = combo.deviceTemplateComboId;
      if (!comboId) {
        throw new Error('Missing deviceTemplateComboId');
      }

      // 1. First, check if the combo itself needs updating
      // Get the current combo details
      const currentComboResponse = await firstValueFrom(
        this.deviceService.getDeviceTemplateComboById(comboId)
      );

      if (!currentComboResponse.success || !currentComboResponse.result) {
        throw new Error('Failed to fetch current combo details');
      }

      const currentCombo = currentComboResponse.result;

      // Fix the comparison - convert deviceId to number if needed
      const currentDeviceId = typeof currentCombo.deviceId === 'string'
        ? parseInt(currentCombo.deviceId, 10)
        : currentCombo.deviceId;

      // Check if combo details have changed
      const detailsChanged =
        currentDeviceId !== combo.deviceId ||
        currentCombo.templateId !== combo.templateId ||
        currentCombo.isDefault !== (combo.isDefault || false);
      // Note: DeviceTemplateComboDto might not have isActive property
      // If not, remove this line: currentCombo.isActive !== (combo.isActive !== false)
      if (detailsChanged) {
        // Update the combo itself
        await firstValueFrom(
          this.deviceService.updateDeviceTemplateCombo(comboId, {
            deviceId: combo.deviceId,
            templateId: combo.templateId || '',
            isDefault: combo.isDefault || false,
            isActive: combo.isActive !== false  // Add this if your DTO supports it
          })
        );
      }
      // 2. Update the assignment
      const assignmentsResponse = await firstValueFrom(
        this.deviceService.getAssignments('SHELF', shelfId)
      );

      const assignments = Array.isArray(assignmentsResponse) ? assignmentsResponse : [];

      // Find the existing assignment for this combo
      const existingAssignment = assignments.find(assignment =>
        assignment.assignmentType === 'TEMPLATE' &&
        assignment.deviceTemplateComboId === comboId
      );

      // const assignments = await firstValueFrom(
      //   this.deviceService.getAssignments('SHELF', shelfId)
      // );
      // // Find the existing assignment for this combo
      //  const existingAssignment = assignments.find(assignment => 
      //   assignment.assignmentType === 'TEMPLATE' &&
      //   assignment.deviceTemplateComboId === comboId
      // );



      if (existingAssignment) {
        // Update the assignment if needed
        if (existingAssignment.displayOrder !== displayOrder ||
          existingAssignment.isActive !== (combo.isActive !== false)) {
          await firstValueFrom(
            this.deviceService.updateAssignment(existingAssignment.id, {
              displayOrder: displayOrder,
              isActive: combo.isActive !== false
            })
          );
        }
      } else {
        // Create new assignment if not found (shouldn't happen but handle gracefully)
        await firstValueFrom(
          this.deviceService.assignComboToLocationWithDetails(
            'TEMPLATE',
            comboId,
            'SHELF',
            shelfId,
            userId,
            displayOrder,
            this.storeId,
            combo.isActive !== false,
          )
        );
      }
    } catch (error) {
      console.error('Error updating existing template combo:', error);
      throw error;
    }
  }

  private async updateExistingMessageCombo(
    combo: DeviceComboForm,
    shelfId: number,
    userId: number,
    displayOrder: number
  ): Promise<void> {
    try {
      const comboId = combo.deviceMessageComboId;
      if (comboId && combo.messageId) {
        // 1. Update the device-message combo if needed
        // You might want to add this to your service if the API supports it
        // await firstValueFrom(
        //   this.deviceService.updateDeviceMessageCombo(comboId, {
        //     deviceId: combo.deviceId,
        //     messageId: combo.messageId,
        //     isActive: combo.isActive !== false
        //   })
        // );

        // 2. Update the assignment
        const assignments = await firstValueFrom(
          this.deviceService.getAssignments('SHELF', shelfId)
        );

        // Find the existing assignment for this combo
        const existingAssignment = assignments.find(assignment =>
          assignment.assignmentType === 'MESSAGE' &&
          assignment.deviceMessageComboId === comboId
        );

        if (existingAssignment) {
          // Update the assignment
          await firstValueFrom(
            this.deviceService.updateAssignment(existingAssignment.id, {
              displayOrder: displayOrder,
              isActive: combo.isActive !== false
            })
          );
        } else {
          // Create new assignment if not found
          await firstValueFrom(
            this.deviceService.assignComboToLocationWithDetails(
              'MESSAGE',
              comboId,
              'SHELF',
              shelfId,
              userId,
              displayOrder,
              this.storeId,
              combo.isActive !== false
            )
          );
        }
      }
    } catch (error) {
      console.error('Error updating existing message combo:', error);
      throw error;
    }
  }

  private async cleanupDeletedAssignments(
    shelfId: number,
    currentComboIds: { type: string, id?: number }[]  // Correct parameter type
  ): Promise<void> {
    try {
      // Get all current assignments for this shelf
      const assignments = await firstValueFrom(
        this.deviceService.getAssignments('SHELF', shelfId)
      );

      // Find assignments to delete (those not in current combos)
      const assignmentsToDelete = assignments.filter(assignment => {
        if (this.comboMode === 'device-template') {
          return assignment.assignmentType === 'TEMPLATE' &&
            !currentComboIds.some(c =>
              c.type === 'TEMPLATE' && c.id === assignment.deviceTemplateComboId
            );
        } else {
          return assignment.assignmentType === 'MESSAGE' &&
            !currentComboIds.some(c =>
              c.type === 'MESSAGE' && c.id === assignment.deviceMessageComboId
            );
        }
      });

      // Delete orphaned assignments
      for (const assignment of assignmentsToDelete) {
        await firstValueFrom(
          this.deviceService.deleteAssignment(assignment.id)
        );
      }

      if (assignmentsToDelete.length > 0) {
        console.log(`Deleted ${assignmentsToDelete.length} orphaned assignments`);
      }
    } catch (error) {
      console.error('Error cleaning up deleted assignments:', error);
      // Don't throw - we don't want to fail the whole operation
    }
  }

  private async processTemplateCombo(
    combo: DeviceComboForm,
    shelfId: number,
    userId: number,
    displayOrder: number
  ): Promise<ProcessedComboResult> {
    let comboId = combo.deviceTemplateComboId;

    try {
      // Create template combo if it does not exist
      if (!comboId) {
        const createdCombo = await firstValueFrom(
          this.deviceService.createDeviceTemplateCombo(
            combo.deviceId,
            combo.templateId || '',
            combo.isDefault || false
          )
        );
        comboId = createdCombo.id;
      }

      // Assign combo to shelf (BOTH for new and existing combos)
      if (comboId) {
        await firstValueFrom(
          this.deviceService.assignComboToLocationWithDetails(
            'TEMPLATE',
            comboId,
            'SHELF',
            shelfId,
            userId,
            displayOrder,
            this.storeId,
            combo.isActive !== false,
          )
        );
        return { id: comboId, success: true };
      } else {
        return { success: false, message: 'Failed to get combo ID' };
      }
    } catch (error) {
      console.error('Error processing template combo:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async processMessageCombo(
    combo: DeviceComboForm,
    shelfId: number,
    userId: number,
    displayOrder: number
  ): Promise<ProcessedComboResult> {
    let comboId = combo.deviceMessageComboId;

    try {
      // Create message combo if it does not exist
      if (!comboId && combo.messageId) {
        const createdCombo = await firstValueFrom(
          this.deviceService.createDeviceMessageCombo({
            deviceId: combo.deviceId,
            messageId: combo.messageId,
            storeId: this.storeId,
            isActive: combo.isActive !== false
          })
        );
        comboId = createdCombo.result?.id;
      }

      // Assign message combo to shelf (BOTH for new and existing combos)
      if (comboId) {
        await firstValueFrom(
          this.deviceService.assignComboToLocationWithDetails(
            'MESSAGE',
            comboId,
            'SHELF',
            shelfId,
            userId,
            displayOrder,
            this.storeId,
            combo.isActive !== false
          )
        );
        return { id: comboId, success: true };
      } else {
        return { success: false, message: 'No combo ID or message ID available' };
      }
    } catch (error) {
      console.error('Error processing message combo:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }



  // private async processTemplateCombo(combo: DeviceComboForm, shelfId: number, userId: number, displayOrder: number): Promise<void> {
  //   let comboId = combo.deviceTemplateComboId;

  //   if (!comboId) {
  //     const createdCombo = await firstValueFrom(
  //       this.deviceService.createDeviceTemplateCombo(
  //         combo.deviceId,
  //         combo.templateId || '',
  //         combo.isDefault || false
  //       )
  //     );
  //     comboId = createdCombo.id;
  //   }

  //   if (comboId) {
  //     await firstValueFrom(
  //       this.deviceService.assignComboToLocationWithDetails(
  //         comboId,
  //         'Shelf',
  //         shelfId,
  //         userId,
  //         displayOrder,
  //         combo.isActive !== false
  //       )
  //     );
  //   }
  // }

  // private async processMessageCombo(combo: DeviceComboForm, shelfId: number, userId: number, displayOrder: number): Promise<void> {
  //   let comboId = combo.deviceMessageComboId;

  //   if (!comboId && combo.messageId) {
  //     // Create device-message combo
  //     const createDto = {
  //       deviceId: combo.deviceId,
  //       messageId: combo.messageId,
  //       displayOrder: displayOrder,
  //       isActive: combo.isActive !== false
  //     };

  //     // Assuming you have a method to create device-message combos
  //     // This needs to be implemented based on your API
  //     console.log('Creating device-message combo:', createDto);
  //     // const createdCombo = await firstValueFrom(this.deviceService.createDeviceMessageCombo(createDto));
  //     // comboId = createdCombo.id;
  //   }

  //   if (comboId) {
  //     // Assign the combo to shelf
  //     // This needs to be implemented based on your API
  //     console.log('Assigning message combo to shelf:', { comboId, shelfId });
  //   }
  // }

  onCancel(): void {
    this.dialogRef.close({ success: false });
  }
  //#endregion

  //#region Snackbar Methods
  private showSuccess(message: string): void {
    this.primemessageService.add({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 5000
    });
  }

  private showError(message: string): void {
    this.primemessageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000
    });
  }

  private showWarning(message: string): void {
    this.primemessageService.add({
      severity: 'warn',
      summary: 'Warning',
      detail: message,
      life: 5000
    });
  }

  private showInfo(message: string): void {
    this.primemessageService.add({
      severity: 'info',
      summary: 'Info',
      detail: message,
      life: 5000
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

  // private showWarning(message: string): void {
  //   this.openSnackbar({
  //     message: message,
  //     icon: 'fas fa-exclamation-triangle',
  //     type: 'warning'
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
}
