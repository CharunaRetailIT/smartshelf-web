import { Component, OnInit, ViewChild, OnDestroy, viewChild, EventEmitter, Input, Output, TemplateRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { firstValueFrom, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

// PrimeNG Components
import { Table, TableModule } from 'primeng/table';
import { ConfirmationService, MenuItem, MessageService as PrimeMessageService } from 'primeng/api';


// Models
import {
  LocalDeviceDto,
  DeviceTemplateComboDto,
  AssignmentDto,
  LocalTemplateDto,
  DeviceAssignmentDto,
  DeviceScreenDto,
  DeviceMessageComboDto,
  DeviceMessageComboPagedRequest
} from '../../../core/interfaces/device.interface';
import { AssignmentSearchParams, ComboSearchParams, PagedResult, SearchParams } from '../../../core/interfaces/pagination-result.interface';

// Services
import { DeviceService } from '../../../core/services/device.service';
import { SettingsService } from '../../../core/services/settings.service';

// Import the correct type from PrimeNG
import { TableLazyLoadEvent } from 'primeng/table';
import { ImportsModule } from '../../../imports/imports';
import { MinewStore } from '../../../core/interfaces/minew.interface';
import { ConfirmationDialogComponent } from '../../../shared/components/dialog/confirmation-dialog/confirmation-dialog.component';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { CreateDeviceScreenDimensionRequest, DeviceScreenDimensionResponse } from '../../../core/interfaces/device-screen-dimension.interface';
import { DeleteConfirmationComponent } from '../../../shared/components/dialog/delete-confirmation/delete-confirmation.component';
import { MinewBatchAddComponent } from "../minew-batch-add/minew-batch-add.component";
import { TabsModule } from 'primeng/tabs';
import { AuthService } from '../../../core/services/auth.service';
import { StoreService } from '../../../core/services/store.service';
import { StoreFilterParams } from '../../../core/interfaces/store.interface';
import { CustomSnackbarComponent, SnackbarData } from '../../../shared/components/alert/custom-snackbar.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CustomMessageService } from '../../../core/services/message.service';
import { MessagePagedRequest } from '../../../core/interfaces/message.interface';
import { CreateGatewayRequest, GatewayDto, GatewayPagedRequest, UpdateGatewayRequest } from '../../../core/interfaces/gateway.interface';
import { GatewayService } from '../../../core/services/gateway.service';
import { ProductService } from '../../../core/services/product.service';
import { ShelfService } from '../../../core/services/shelf.service';

interface LayoutOption {
  label: string;
  value: 'list' | 'grid';
  icon: string;
}

@Component({
  selector: 'app-device-management-server-pagination',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    // PrimeNG Modules
    ImportsModule,
    MinewBatchAddComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './device-management.component.html',
  styleUrls: ['./device-management.component.css']
})
export class DeviceManagementComponent implements OnInit, OnDestroy {
  @ViewChild('devicesTable') devicesTable!: Table;
  @ViewChild('templatesTable') templatesTable!: Table;
  @ViewChild('combosTable') combosTable!: Table;
  @ViewChild('assignmentsTable') assignmentsTable!: Table;
  @ViewChild('minewBatchAdd') minewBatchAddComponent!: MinewBatchAddComponent;
  @ViewChild('messageCombosTable') messageCombosTable!: Table;
  @ViewChild('gatewaysTable') gatewaysTable!: Table;

  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<any>();

  // Data
  stores: MinewStore[] = [];
  devices: LocalDeviceDto[] = [];
  templates: LocalTemplateDto[] = [];
  combos: DeviceTemplateComboDto[] = [];
  assignments: DeviceAssignmentDto[] = [];
  screenDimensions: DeviceScreenDimensionResponse[] = [];
  messageCombos: DeviceMessageComboDto[] = [];
  gateways: GatewayDto[] = [];
  // Assignment data
  assignment: any = {
    deviceId: null,
    locationType: null,
    locationId: null,
    isActive: true
  };

  // Products
  products: any[] = [];
  loadingProducts: boolean = false;
  loadingMoreProducts: boolean = false;
  productPageSize: number = 10;
  productCurrentPage: number = 1;
  hasMoreProducts: boolean = true;
  productSearchTerm: string = '';
  productTotalRecords: number = 0;

  // Shelves
  shelves: any[] = [];
  loadingShelves: boolean = false;
  loadingMoreShelves: boolean = false;
  shelfPageSize: number = 10;
  shelfCurrentPage: number = 1;
  hasMoreShelves: boolean = true;
  shelfSearchTerm: string = '';
  shelfTotalRecords: number = 0;

  saving: boolean = false;



  // For dropdowns in forms
  deviceOptions: any[] = [];
  templateOptions: any[] = [];
  comboOptions: any[] = [];
  messageOptions: any[] = [];
  messageComboOptions: any[] = [];

  // Pagination
  devicesTotalRecords: number = 0;
  templatesTotalRecords: number = 0;
  combosTotalRecords: number = 0;
  assignmentsTotalRecords: number = 0;
  messageCombosTotalRecords: number = 0;
  gatewaysTotalRecords: number = 0;

  // Default rows per page
  devicesRows: number = 10;
  templatesRows: number = 10;
  combosRows: number = 10;
  assignmentsRows: number = 10;
  gatewaysRows: number = 10;
  messageCombosRows: number = 10;


  // Loading states
  devicesLoading: boolean = false;
  templatesLoading: boolean = false;
  combosLoading: boolean = false;
  assignmentsLoading: boolean = false;
  messageCombosLoading: boolean = false;
  gatewaysLoading: boolean = false;


  //Sync Properties
  syncingTemplates = false;
  selectedSyncType: string = 'localToCloud';


  // Search terms
  deviceSearchTerm: string = '';
  templateSearchTerm: string = '';
  comboSearchTerm: string = '';
  assignmentSearchTerm: string = '';
  messageComboSearchTerm: string = '';
  gatewaySearchTerm: string = '';


  // Filters
  deviceStatusFilter: string = '';
  templateActiveFilter: boolean | null = null;
  comboDeviceFilter: number = 0;
  comboTemplateFilter: string = '';
  assignmentLocationTypeFilter: string = '';
  assignmentComboFilter: string = '';
  assignmentMessageComboFilter: string = '';
  assignmentActiveFilter: boolean | null = null;
  messageComboDeviceFilter: number = 0;
  messageComboMessageFilter: string = '';
  assignmentTypeFilter: string = '';

  // UI State
  activeTabIndex: number = 0;

  // Message Combos is hidden for now. Flip to true to bring the tab back - the
  // panel, its table and every handler are still in place.
  showMessageCombosTab = false;

  // Tabs are addressed by name, not by position: hiding a panel re-indexes the
  // ones after it, so a hard-coded `activeTabIndex === 4` silently points at
  // the wrong tab the moment a tab is added, removed or hidden.
  get visibleTabs(): string[] {
    return [
      'devices',
      'templates',
      'combos',
      ...(this.showMessageCombosTab ? ['messageCombos'] : []),
      'assignments',
      'gateways',
    ];
  }

  get activeTabKey(): string {
    return this.visibleTabs[this.activeTabIndex] ?? 'devices';
  }
  // Every popup on this page is a Material dialog rendered from a TemplateRef
  // below, so all the state and handlers stay on this component. The boolean
  // flags are kept because other logic still reads them.
  @ViewChild('displayDeviceDialogTpl') displayDeviceDialogTpl!: TemplateRef<unknown>;
  @ViewChild('displayTemplateDialogTpl') displayTemplateDialogTpl!: TemplateRef<unknown>;
  @ViewChild('displayComboDialogTpl') displayComboDialogTpl!: TemplateRef<unknown>;
  @ViewChild('displayAssignmentDialogTpl') displayAssignmentDialogTpl!: TemplateRef<unknown>;
  @ViewChild('displayScreenDimensionDialogTpl') displayScreenDimensionDialogTpl!: TemplateRef<unknown>;
  @ViewChild('displayDeviceSyncDialogTpl') displayDeviceSyncDialogTpl!: TemplateRef<unknown>;
  @ViewChild('displayTemplateSyncDialogTpl') displayTemplateSyncDialogTpl!: TemplateRef<unknown>;
  @ViewChild('displayGatewayDialogTpl') displayGatewayDialogTpl!: TemplateRef<unknown>;
  @ViewChild('displayTemplatePreviewDialogTpl') displayTemplatePreviewDialogTpl!: TemplateRef<unknown>;
  private tplDialogRefs = new Map<string, MatDialogRef<unknown>>();

  displayDeviceDialog: boolean = false;
  displayTemplateDialog: boolean = false;
  displayComboDialog: boolean = false;
  displayAssignmentDialog: boolean = false;
  displayScreenDimensionDialog: boolean = false;
  displayDeviceSyncDialog: boolean = false;
  displayTemplateSyncDialog: boolean = false;
  displayMessageComboDialog: boolean = false;
  isEditMode: boolean = false;
  loading: boolean = false;

  // Selected items
  selectedDevice: LocalDeviceDto | null = null;
  selectedTemplate: LocalTemplateDto | null = null;
  selectedCombo: DeviceTemplateComboDto | null = null;
  selectedAssignment: AssignmentDto | null = null;

  // Forms
  deviceForm: FormGroup;
  templateForm: FormGroup;
  comboForm: FormGroup;
  assignmentForm: FormGroup;
  searchForm: FormGroup;
  screenDimensionForm: FormGroup;
  syncForm: FormGroup;
  messageComboForm: FormGroup;
  gatewayForm: FormGroup;
  displayGatewayDialog: boolean = false;
  selectedGateway: GatewayDto | null = null;

  // Layout options
  layoutOptions: LayoutOption[] = [
    { label: 'List View', value: 'list', icon: 'pi pi-list' },
    { label: 'Grid View', value: 'grid', icon: 'pi pi-th-large' }
  ];

  selectedDevicesLayout: 'list' | 'grid' = 'list';
  selectedTemplatesLayout: 'list' | 'grid' = 'list';
  selectedCombosLayout: 'list' | 'grid' = 'list';
  selectedAssignmentsLayout: 'list' | 'grid' = 'list';
  selectedMessageCombosLayout: 'list' | 'grid' = 'list';
  selectedGatewaysLayout: 'list' | 'grid' = 'list';

  // Store ID
  storeId: number = 0;
  storeName: string = '';
  /** The active store's Minew cloud id; empty until the store is synced. */
  minewStoreId: string = '';

  /** Guards the Refresh Screens button while the cloud read is in flight. */
  screensRefreshing = false;

  storeTotalRecords: number = 0;
  storeLoading: boolean = false;
  storeRows: number = 10;
  storeSearchTerm: string = '';

  //Device Screen
  screenOptions: DeviceScreenDto[] = [];
  screenLoading: boolean = false;
  screenTotalRecords: number = 0;

  //Current User
  currentUserId: number = 0;

  // Options for dropdowns

  addDeviceOptions: MenuItem[] = [];

  statusOptions = [
    { label: 'All', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
    { label: 'Online', value: 'online' },
    { label: 'Offline', value: 'offline' }
  ];

  // Every device is Minew for now, so the picker is hidden and the form's
  // 'Minew' default stands. Flip to true to bring the choice back - the
  // Standard-device branches in the template and TS are all still in place.
  showDeviceTypeSelector = false;

  deviceTypeOptions = [
    { label: 'Minew ESL', value: 'Minew' },
    { label: 'Standard', value: 'Standard' },
  ];

  locationTypeOptions = [
    { label: 'Shelf', value: 'Shelf' },
    { label: 'Product', value: 'Product' }
  ];

  activeFilterOptions = [
    { label: 'All', value: null },
    { label: 'Active', value: true },
    { label: 'Inactive', value: false }
  ];

  // Store Options
  storeOptions: any[] = [];

  // Store Type Options
  storeTypeOptions = [
    { label: 'Local Store', value: 'local', description: 'Store managed locally only' },
    { label: 'Minew Cloud Store', value: 'cloud', description: 'Store synchronized with Minew cloud' }
  ];

  // Sync Options
  syncOptions = [
    { label: 'Create Locally then Sync to Minew', value: 'localToCloud' },
    { label: 'Sync from Minew Cloud', value: 'cloudToLocal' }
  ];

  // Screen Orientation Options
  orientationOptions = [
    { label: 'Portrait', value: 'portrait' },
    { label: 'Landscape', value: 'landscape' }
  ];

  comboTypeOptions = [
    { label: 'All', value: '' },
    { label: 'Template Assignment', value: 'TEMPLATE' },
    { label: 'Message Assignment', value: 'MESSAGE' }
  ];

  // Add gateway type options
  gatewayTypeOptions = [
    { label: 'Minew Gateway', value: 'Minew' },
    { label: 'Standard Gateway', value: 'Standard' },
  ];


  //Template preview
  displayTemplatePreviewDialog: boolean = false;
  selectedTemplateForPreview: LocalTemplateDto | null = null;
  templatePreviewImage: string | null = null;
  isLoadingPreview: boolean = false;

  // RxJS Subjects for debouncing
  private destroy$ = new Subject<void>();
  private deviceSearchSubject$ = new Subject<void>();
  private templateSearchSubject$ = new Subject<void>();
  private comboSearchSubject$ = new Subject<void>();
  private assignmentSearchSubject$ = new Subject<void>();
  private messageComboSearchSubject$ = new Subject<void>();

  constructor(
    private deviceService: DeviceService,
    private settingsService: SettingsService,
    public auth: AuthService,
    public storeService: StoreService,
    private fb: FormBuilder,
    private messageService: CustomMessageService,
    private primeMessageService: PrimeMessageService,
    private gatewayService: GatewayService,
    private productService: ProductService,
    private shelfService: ShelfService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {
    // Initialize forms
    this.deviceForm = this.fb.group({
      id: [''],
      // No client-side format check: MACs are accepted as typed (bare
      // e1000005e79d, separated, or whatever the hardware reports).
      macAddress: [''],
      deviceName: ['', Validators.required],
      deviceType: ['Minew', Validators.required],
      storeId: [0, Validators.required],
      screenId: [null],
      ipAddress: ['', [Validators.pattern(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)]],
      networkName: [''],
      firmware: [''],
      hardware: [''],
      battery: [100, [Validators.min(0), Validators.max(100)]],
      statusId: [1], // Default to Active
      isActive: [true],
      isOnline: [false]
    });


    this.templateForm = this.fb.group({
      id: [''],
      name: ['', Validators.required],
      description: [''],
      screenInch: [0],
      screenWidth: [0],
      screenHeight: [0],
      color: [''],
      orientation: [0],
      storeId: [''],
      isActive: [true]
    });

    this.comboForm = this.fb.group({
      deviceId: ['', Validators.required],
      templateId: ['', Validators.required],
      isDefault: [false]
    });

    this.assignmentForm = this.fb.group({
      comboId: ['', Validators.required],
      locationType: ['', Validators.required],
      locationId: [null, Validators.required],
      displayOrder: [0],
      isActive: [true]
    });

    this.screenDimensionForm = this.fb.group({
      screenWidth: [0, [Validators.required, Validators.min(1)]],
      screenHeight: [0, [Validators.required, Validators.min(1)]],
      orientation: ['portrait', Validators.required],
      refreshRate: [60],
      colorDepth: [8],
      pixelDensity: [96]
    });

    // Sync Form
    this.syncForm = this.fb.group({
      syncType: ['localToCloud', Validators.required],
    });

    this.searchForm = this.fb.group({
      searchTerm: [''],
      status: [''],
      storeId: ['']
    });

    // Message combo form
    this.messageComboForm = this.fb.group({
      deviceId: ['', Validators.required],
      messageId: ['', Validators.required],
      displayOrder: [0],
      isActive: [true]
    });

    //gateway form
    this.gatewayForm = this.fb.group({
      id: [''],
      macAddress: ['', [Validators.required, Validators.pattern(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)]],
      name: ['', Validators.required],
      description: [''],
      storeId: [0, Validators.required],
      gatewayType: ['Minew'],
      hardwareVersion: [''],
      firmwareVersion: [''],
      battery: [100, [Validators.min(0), Validators.max(100)]],
      statusId: [1],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.initCurrentUser();
    this.loadDefaultStore();
    // this.loadStoresLazy();
    this.setupDebouncedSearch();
    // Load initial data for first tab (Devices)
    this.loadDevicesLazy({ first: 0, rows: this.devicesRows });
    // Load dropdown data
    this.loadDeviceOptions();
    this.loadTemplateOptions();
    this.loadMessageOptions();
    this.initializeAddDeviceOptions();
  }



  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.deviceSearchSubject$.complete();
    this.templateSearchSubject$.complete();
    this.comboSearchSubject$.complete();
    this.assignmentSearchSubject$.complete();
  }

  private initCurrentUser(): void {
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      this.showError('User not authenticated');
      return;
    }
    this.currentUserId = user.id;
  }

  loadDefaultStore() {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    if (currentStore) {
      this.storeId = currentStore.id;
      this.storeName = currentStore.storeName;
      // Minew addresses stores by its own cloud id, not our local one.
      this.minewStoreId = currentStore.minewStoreId ?? '';
      console.log('Current default store:', currentStore);
    }
  }

  getLocationLabel(): string {
    const locationType = this.assignmentForm.get('locationType')?.value;
    switch (locationType) {
      case 'Product': return 'Product';
      case 'Shelf': return 'Shelf';
      case 'Store': return 'Store';
      default: return 'Location';
    }
  }

  isFormValid(): boolean {
    const locationType = this.assignmentForm.get('locationType')?.value;
    const locationId = this.assignmentForm.get('locationId')?.value;

    // Basic validation
    const hasCombo = !!this.assignmentForm.get('comboId')?.value;
    const hasLocationType = !!locationType;

    // Location ID validation based on location type
    let hasValidLocationId = false;
    if (locationType === 'Product' || locationType === 'Shelf' || locationType === 'Store') {
      hasValidLocationId = !!locationId;
    }

    return hasCombo && hasLocationType && hasValidLocationId;
  }

  resetForm(): void {
    // Reset the form values
    this.assignmentForm.reset({
      displayOrder: 0,
      isActive: true,
      locationId: null,
      locationType: null
    });

    // Reset pagination
    this.resetProductPagination();
    this.resetShelfPagination();
  }

  onCancel(): void {
    this.resetForm();
    this.visibleChange.emit(false);
  }

  onSave(): void {
    if (!this.isFormValid()) {
      this.showError('Please fill all required fields');
      return;
    }

    this.saving = true;
    this.save.emit(this.assignment);
    this.saving = false;
    this.onCancel();
  }

  onLocationTypeChange(): void {
    // Clear the locationId when location type changes
    this.assignmentForm.get('locationId')?.setValue(null);

    const locationType = this.assignmentForm.get('locationType')?.value;

    if (locationType === 'Product') {
      this.resetProductPagination();
      this.products = [];
      this.loadProducts();
    } else if (locationType === 'Shelf') {
      this.resetShelfPagination();
      this.shelves = [];
      this.loadShelves();
    }
    // For Store type, keep the numeric input field
  }

  //#region Product Methods
  resetProductPagination(): void {
    this.productCurrentPage = 1;
    this.products = [];
    this.hasMoreProducts = true;
    this.productSearchTerm = '';
  }

  async loadProducts(reset: boolean = false): Promise<void> {
    if (reset) {
      this.resetProductPagination();
    }

    if (this.loadingProducts || !this.hasMoreProducts) return;

    this.loadingProducts = true;

    try {
      const requestParams = {
        pageNumber: this.productCurrentPage,
        pageSize: this.productPageSize,
        searchTerm: this.productSearchTerm || undefined,
        storeId: this.storeId,
        isActive: true
      };

      const pagedResult = await firstValueFrom(
        this.productService.getProductsPaged(requestParams)
      );

      const newProducts = pagedResult.items || [];

      if (reset || this.productCurrentPage === 1) {
        this.products = newProducts;
      } else {
        this.products = [...this.products, ...newProducts];
      }

      this.productTotalRecords = pagedResult.totalCount || 0;
      this.hasMoreProducts = this.productCurrentPage < pagedResult.totalPages;

      console.log(`Loaded ${newProducts.length} products. Total: ${this.products.length}, Has more: ${this.hasMoreProducts}`);

    } catch (error: any) {
      console.error('Error loading products:', error);
      this.showError('Failed to load products');
      this.products = [];
    } finally {
      this.loadingProducts = false;
    }
  }

  async loadMoreProducts(): Promise<void> {
    if (this.loadingMoreProducts || !this.hasMoreProducts) return;

    this.loadingMoreProducts = true;
    this.productCurrentPage++;

    try {
      await this.loadProducts();
    } finally {
      this.loadingMoreProducts = false;
    }
  }

  async loadPreviousProducts(): Promise<void> {
    if (this.productCurrentPage <= 1) return;

    this.productCurrentPage--;
    await this.loadProducts(true);
  }

  onProductSearch(event: any): void {
    this.productSearchTerm = event.filter || '';
    this.loadProducts(true);
  }
  //#endregion

  //#region Shelf Methods
  resetShelfPagination(): void {
    this.shelfCurrentPage = 1;
    this.shelves = [];
    this.hasMoreShelves = true;
    this.shelfSearchTerm = '';
  }

  async loadShelves(reset: boolean = false): Promise<void> {
    if (reset) {
      this.resetShelfPagination();
    }

    if (this.loadingShelves || !this.hasMoreShelves) return;

    this.loadingShelves = true;

    try {
      const shelves = await firstValueFrom(
        this.shelfService.getAllShelves(this.storeId)
      );

      // Apply search filter if any
      let filteredShelves = [...shelves];

      if (this.shelfSearchTerm) {
        const term = this.shelfSearchTerm.toLowerCase();
        filteredShelves = filteredShelves.filter(shelf =>
          shelf.name?.toLowerCase().includes(term) ||
          shelf.location?.toLowerCase().includes(term));
      }

      // Apply pagination
      const startIndex = (this.shelfCurrentPage - 1) * this.shelfPageSize;
      const endIndex = startIndex + this.shelfPageSize;
      const newShelves = filteredShelves.slice(startIndex, endIndex);

      this.shelfTotalRecords = filteredShelves.length;

      if (reset || this.shelfCurrentPage === 1) {
        this.shelves = newShelves;
      } else {
        this.shelves = [...this.shelves, ...newShelves];
      }

      this.hasMoreShelves = endIndex < filteredShelves.length;

      console.log(`Loaded ${newShelves.length} shelves. Total: ${this.shelves.length}, Has more: ${this.hasMoreShelves}`);

    } catch (error: any) {
      console.error('Error loading shelves:', error);
      this.showError('Failed to load shelves');
      this.shelves = [];
    } finally {
      this.loadingShelves = false;
    }
  }

  async loadMoreShelves(): Promise<void> {
    if (this.loadingMoreShelves || !this.hasMoreShelves) return;

    this.loadingMoreShelves = true;
    this.shelfCurrentPage++;

    try {
      await this.loadShelves();
    } finally {
      this.loadingMoreShelves = false;
    }
  }

  async loadPreviousShelves(): Promise<void> {
    if (this.shelfCurrentPage <= 1) return;

    this.shelfCurrentPage--;
    await this.loadShelves(true);
  }

  onShelfSearch(event: any): void {
    this.shelfSearchTerm = event.filter || '';
    this.loadShelves(true);
  }
  //#endregion

  loadScreenOptions(): void {
    this.screenLoading = true;

    this.deviceService.getAvailableScreens().subscribe({
      next: (screens) => {
        this.screenOptions = screens;
        this.screenLoading = false;
      },
      error: (error) => {
        console.error('Failed to load screen options:', error);
        this.screenLoading = false;
      }
    });
  }

  loadInitialStores(): void {
    // Trigger initial lazy load
    this.loadStoresLazy({
      first: 0,
      rows: this.storeRows,
      filter: this.storeSearchTerm
    });
  }
  // ============ DEBOUNCED SEARCH SETUP ============

  private setupDebouncedSearch(): void {
    // Device search debouncing (500ms)
    this.deviceSearchSubject$.pipe(
      takeUntil(this.destroy$),
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(() => {
      this.onDeviceSearch();
    });

    // Template search debouncing
    this.templateSearchSubject$.pipe(
      takeUntil(this.destroy$),
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(() => {
      console.log('Template search triggered with term:', this.templateSearchTerm);
      this.onTemplateSearch();
    });

    // Combo search debouncing
    this.comboSearchSubject$.pipe(
      takeUntil(this.destroy$),
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(() => {
      console.log('Combo search triggered with term:', this.comboSearchTerm);
      this.onComboSearch();
    });

    // Assignment search debouncing
    this.assignmentSearchSubject$.pipe(
      takeUntil(this.destroy$),
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(() => {
      console.log('Assignment search triggered with term:', this.assignmentSearchTerm);
      this.onAssignmentSearch();
    });

    // Message combo search debouncing
    this.messageComboSearchSubject$.pipe(
      takeUntil(this.destroy$),
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(() => {
      console.log('Message Combo search triggered with term:', this.messageComboSearchTerm);
      this.onMessageComboSearch();
    });
  }

  loadScreenDimensions(deviceId: number): void {
    if (!deviceId) return;

    this.deviceService.getDeviceScreenDimensions(deviceId).subscribe({
      next: (dimensions) => {
        this.screenDimensions = dimensions;
      },
      error: (error) => {
        this.showError('Failed to load screen dimensions');
      }
    });
  }


  // ============ DROPDOWN DATA LOADING ============

  initializeAddDeviceOptions(): void {
    this.addDeviceOptions = [
      {
        label: 'Add Single Device',
        icon: 'pi pi-plus',
        command: () => this.openDeviceDialog(),
        tooltipOptions: {
          tooltipLabel: 'Add a single device manually',
          tooltipPosition: 'right'
        }
      },
      {
        label: 'Batch Add Minew Devices',
        icon: 'pi pi-cloud-upload',
        command: () => this.openMinewBatchDialog(),
        tooltipOptions: {
          tooltipLabel: 'Add multiple Minew devices from cloud',
          tooltipPosition: 'right'
        }
      },
    ];
  }

  loadDeviceOptions(): void {
    // Load devices for combo dropdown
    this.deviceService.getLocalDevicesPagedbyStore(
      this.storeId,
      1,
      100, // Load more for dropdown
      ''
    ).subscribe({
      next: (result) => {
        this.deviceOptions = result.items.map(device => ({
          label: `${device.deviceName} (${device.mac})`,
          value: device.id
        }));
      },
      error: (error) => {
        console.error('Failed to load device options:', error);
      }
    });
  }

  loadTemplateOptions(): void {
    // Load templates for combo dropdown
    const searchParams: SearchParams = {
      pageNumber: 1,
      pageSize: 100, // Load more for dropdown
      storeId: this.storeId
    };

    this.deviceService.getLocalTemplatesPaged(searchParams).subscribe({
      next: (response) => {
        if (response.success && response.result) {
          this.templateOptions = response.result.items.map(template => ({
            label: `${template.name} (${template.screenWidth}x${template.screenHeight})`,
            value: template.id
          }));
        }
      },
      error: (error) => {
        console.error('Failed to load template options:', error);
      }
    });
  }

  loadComboOptions(): void {
    // Load combos for assignment dropdown
    const searchParams: SearchParams = {
      pageNumber: 1,
      pageSize: 100 // Load more for dropdown
    };

    this.deviceService.getCombosPaged(searchParams).subscribe({
      next: (response) => {
        console.log("comOpt", response.result)
        if (response.success && response.result) {
          this.comboOptions = response.result.items.map(combo => ({
            label: `${combo.deviceName} - ${combo.templateName}`,
            value: combo.id,
            type: 'TEMPLATE'
          }));
        }
      },
      error: (error) => {
        console.error('Failed to load combo options:', error);
      }
    });
  }

  loadMessageOptions(): void {
    // Load messages for message combo dropdown
    const request: MessagePagedRequest = {
      pageNumber: 1,
      pageSize: 100,
      isActive: true, // Only load active messages
      sortBy: 'title',
      sortDescending: false
    };

    this.messageService.getMessagesPaged(request).subscribe({
      next: (response) => {
        if (response.success && response.result) {
          this.messageOptions = response.result.items.map(message => ({
            label: `${message.title} (${this.getContentTypeDisplay(message.contentType)})`,
            value: message.id,
            contentType: message.contentType,
            messageTitle: message.title,
            type: 'MESSAGE'
          }));
        } else {
          this.messageOptions = [];
          console.warn('No messages found or API returned unsuccessful response');
        }
      },
      error: (error) => {
        console.error('Failed to load message options:', error);
        this.showError('Failed to load messages');
      }
    });
  }

  loadMessageComboOptions(): void {
    // Load message combos for assignment dropdown
    const searchParams: SearchParams = {
      pageNumber: 1,
      pageSize: 100
    };

    this.deviceService.getDeviceMessageCombosPaged(searchParams).subscribe({
      next: (response) => {
        if (response.success && response.result) {
          this.messageComboOptions = response.result.items.map(combo => ({
            label: `${combo.deviceName} - ${combo.messageTitle}`,
            value: combo.id,
            type: 'MESSAGE'
          }));
        }
      },
      error: (error) => {
        console.error('Failed to load message combo options:', error);
      }
    });
  }

  // ============ SERVER-SIDE PAGINATION METHODS ============

  loadStoresLazy(event: any): void {
    console.log("Store Lazy Called")
    if (this.storeLoading) {
      return;
    }

    this.storeLoading = true;

    const pageNumber = Math.floor((event.first || 0) / (event.rows || this.storeRows)) + 1;
    const pageSize = event.rows || this.storeRows;
    const searchTerm = event.filter || '';

    const params: StoreFilterParams = {
      pageNumber,
      pageSize,
      searchTerm,
      isActive: true,
      sortBy: 'storeName',
      sortDirection: 'asc'
    };

    this.storeService.getStoresLazy(params).subscribe({
      next: (result) => {
        this.storeOptions = result.items.map(store => ({
          label: `${store.storeName} (${store.storeCode || store.id})`,
          value: store.id,
          storeName: store.storeName,
          storeCode: store.storeCode,
          address: store.address,
          isActive: store.isActive
        }));
        this.storeTotalRecords = result.totalCount;
        this.storeLoading = false;
        console.log("store lzy", this.storeOptions)
      },
      error: (error) => {
        console.error('Failed to load stores:', error);
        this.storeOptions = [];
        this.storeTotalRecords = 0;
        this.storeLoading = false;
      }
    });
  }


  // Devices - Server-side pagination with lazy loading
  // loadDevicesLazy(event: TableLazyLoadEvent): void {
  //   if (this.devicesLoading) {
  //     return;
  //   }

  //   this.devicesLoading = true;

  //   const pageNumber = Math.floor((event.first || 0) / (event.rows || this.devicesRows)) + 1;
  //   const pageSize = event.rows || this.devicesRows;

  //   // Get sort parameters
  //   let sortBy = '';
  //   let sortDescending = false;
  //   if (event.sortField) {
  //     sortBy = Array.isArray(event.sortField) ? event.sortField[0] : event.sortField;
  //     sortDescending = event.sortOrder === -1;
  //   }

  //   // Call service with all parameters
  //   this.deviceService.getLocalDevicesPagedbyStore(
  //     this.storeId,
  //     pageNumber,
  //     pageSize,
  //     this.deviceSearchTerm,
  //     sortBy,
  //   ).subscribe({
  //     next: (result: PagedResult<LocalDeviceDto>) => {
  //       this.devices = result.items;
  //       this.devicesTotalRecords = result.totalCount;
  //       this.devicesLoading = false;
  //     },
  //     error: (error) => {
  //       this.showError('Failed to load devices');
  //       this.devicesLoading = false;
  //     }
  //   });
  // }

  loadDevicesLazy(event: TableLazyLoadEvent): void {
    if (this.devicesLoading) {
      return;
    }

    this.devicesLoading = true;

    const pageNumber = Math.floor((event.first || 0) / (event.rows || this.devicesRows)) + 1;
    const pageSize = event.rows || this.devicesRows;

    // Get sort parameters
    let sortBy = '';
    let sortDescending = false;
    if (event.sortField) {
      sortBy = Array.isArray(event.sortField) ? event.sortField[0] : event.sortField;
      sortDescending = event.sortOrder === -1;
    }

    // Prepare filters object
    const filters: any = {};

    // Add status filter if selected
    if (this.deviceStatusFilter && this.deviceStatusFilter !== '') {
      filters.Status = this.deviceStatusFilter;
    }

    this.deviceService.getLocalDevicesPagedbyStore(
      this.storeId,
      pageNumber,
      pageSize,
      this.deviceSearchTerm,
      sortBy,
      sortDescending,
      filters
    ).subscribe({
      next: (result: PagedResult<LocalDeviceDto>) => {
        this.devices = result.items;
        this.devicesTotalRecords = result.totalCount;
        this.devicesLoading = false;
      },
      error: (error) => {
        this.showError('Failed to load devices');
        this.devicesLoading = false;
      }
    });
  }

  // Templates - Server-side pagination with lazy loading
  loadLocalTemplatesLazy(event: TableLazyLoadEvent): void {
    if (this.templatesLoading) {
      return;
    }

    this.templatesLoading = true;

    const pageNumber =
      Math.floor((event.first || 0) / (event.rows || this.templatesRows)) + 1;

    const pageSize = event.rows || this.templatesRows;

    const storeId = this.storeId || 5; // fallback if store not loaded yet

    this.deviceService
      .getLocalTemplatesPagedByStore(
        storeId,
        pageNumber,
        pageSize,
        this.templateSearchTerm
      )
      .subscribe({
        next: result => {
          this.templates = result.items;
          this.templatesTotalRecords = result.totalCount;
          this.templatesLoading = false;
        },
        error: () => {
          this.showError('Failed to load templates');
          this.templatesLoading = false;
        }
      });
  }



  // Combos - Server-side pagination with lazy loading 
  loadCombosLazy(event: TableLazyLoadEvent): void {
    if (this.combosLoading) {
      return;
    }

    this.combosLoading = true;

    const pageNumber = Math.floor((event.first || 0) / (event.rows || this.combosRows)) + 1;
    const pageSize = event.rows || this.combosRows;

    let sortBy = '';
    let sortDescending = false;

    if (event.sortField) {
      sortBy = Array.isArray(event.sortField) ? event.sortField[0] : event.sortField;
      sortDescending = event.sortOrder === -1;
    }

    // Use the extended ComboSearchParams interface
    const searchParams: ComboSearchParams = {
      pageNumber,
      pageSize,
      searchTerm: this.comboSearchTerm,
      sortBy,
      sortDescending
    };

    // Add filters using the extended interface properties
    if (this.comboDeviceFilter) {
      searchParams.deviceId = this.comboDeviceFilter;
      console.log('Setting device filter:', this.comboDeviceFilter);
    }

    if (this.comboTemplateFilter) {
      searchParams.templateId = this.comboTemplateFilter;
      console.log('Setting template filter:', this.comboTemplateFilter);
    }

    this.deviceService.getCombosPaged(searchParams).subscribe({
      next: response => {
        if (response.success && response.result) {
          this.combos = response.result.items;
          console.log("Loaded combos:", this.combos);
          this.combosTotalRecords = response.result.totalCount;
        } else {
          this.combos = [];
          this.combosTotalRecords = 0;
        }
        this.combosLoading = false;
      },
      error: (error) => {
        console.error('Error loading combos:', error);
        this.showError('Failed to load combos');
        this.combosLoading = false;
      }
    });
  }
  // In the loadAssignmentsLazy method
  // loadAssignmentsLazy(event: TableLazyLoadEvent): void {
  //   debugger
  //   if (this.assignmentsLoading) {
  //     return;
  //   }

  //   this.assignmentsLoading = true;

  //   const pageNumber = Math.floor((event.first || 0) / (event.rows || this.assignmentsRows)) + 1;
  //   const pageSize = event.rows || this.assignmentsRows;
  //   let sortBy = '';
  //   let sortDescending = false;

  //   if (event.sortField) {
  //     sortBy = Array.isArray(event.sortField) ? event.sortField[0] : event.sortField;
  //     sortDescending = event.sortOrder === -1;
  //   }

  //   const searchParams: AssignmentSearchParams = {
  //     pageNumber,
  //     pageSize,
  //     searchTerm: this.assignmentSearchTerm,
  //     sortBy,
  //     sortDescending,
  //     assignmentType: this.assignmentTypeFilter as 'TEMPLATE' | 'MESSAGE' | undefined,
  //     storeId: this.storeId
  //   };

  //   if (this.assignmentLocationTypeFilter) {
  //     searchParams.locationType = this.assignmentLocationTypeFilter;
  //   }

  //   if (this.assignmentComboFilter) {
  //     const selectedOption = this.comboOptions.find(opt => opt.value == this.assignmentComboFilter);
  //     if (selectedOption?.type === 'TEMPLATE') {
  //       searchParams.deviceTemplateComboId = parseInt(this.assignmentComboFilter);
  //     } else if (selectedOption?.type === 'MESSAGE') {
  //       searchParams.deviceMessageComboId = parseInt(this.assignmentComboFilter);
  //     }
  //   }

  //   this.deviceService.getAssignmentsPaged(searchParams).subscribe({
  //     next: (result) => {
  //       this.assignments = result.items;
  //       this.assignmentsTotalRecords = result.totalCount;
  //       this.assignmentsLoading = false;
  //     },
  //     error: (error) => {
  //       this.showError('Failed to load assignments');
  //       this.assignmentsLoading = false;
  //     }
  //   });
  // }

  loadAssignmentsLazy(event: TableLazyLoadEvent): void {
    if (this.assignmentsLoading) {
      return;
    }

    this.assignmentsLoading = true;

    const pageNumber = Math.floor((event.first || 0) / (event.rows || this.assignmentsRows)) + 1;
    const pageSize = event.rows || this.assignmentsRows;
    let sortBy = '';
    let sortDescending = false;

    if (event.sortField) {
      sortBy = Array.isArray(event.sortField) ? event.sortField[0] : event.sortField;
      sortDescending = event.sortOrder === -1;
    }

    const searchParams: AssignmentSearchParams = {
      pageNumber,
      pageSize,
      searchTerm: this.assignmentSearchTerm,
      sortBy,
      sortDescending,
      assignmentType: this.assignmentTypeFilter as 'TEMPLATE' | 'MESSAGE' | undefined,
      storeId: this.storeId
    };

    if (this.assignmentLocationTypeFilter) {
      searchParams.locationType = this.assignmentLocationTypeFilter;
    }

    if (this.assignmentComboFilter) {
      const selectedOption = this.comboOptions.find(opt => opt.value == this.assignmentComboFilter);
      console.log('Selected combo option:', selectedOption);
      console.log('All combo options:', this.comboOptions);

      if (selectedOption) {
        if (selectedOption.type === 'TEMPLATE') {
          searchParams.deviceTemplateComboId = parseInt(this.assignmentComboFilter);
          console.log('Setting deviceTemplateComboId:', searchParams.deviceTemplateComboId);
        } else if (selectedOption.type === 'MESSAGE') {
          searchParams.deviceMessageComboId = parseInt(this.assignmentComboFilter);
          console.log('Setting deviceMessageComboId:', searchParams.deviceMessageComboId);
        }
      } else {
        console.warn('Selected combo option not found in comboOptions');
      }
    }

    console.log('Sending assignment search params:', searchParams);

    this.deviceService.getAssignmentsPaged(searchParams).subscribe({
      next: (result) => {
        console.log('Assignments loaded:', result.items.length);
        this.assignments = result.items;
        this.assignmentsTotalRecords = result.totalCount;
        this.assignmentsLoading = false;
      },
      error: (error) => {
        console.error('Error loading assignments:', error);
        this.showError('Failed to load assignments');
        this.assignmentsLoading = false;
      }
    });
  }

  loadMessageCombosLazy(event: TableLazyLoadEvent): void {
    if (this.messageCombosLoading) {
      return;
    }

    this.messageCombosLoading = true;

    const pageNumber = Math.floor((event.first || 0) / (event.rows || this.messageCombosRows)) + 1;
    const pageSize = event.rows || this.messageCombosRows;

    let sortBy = '';
    let sortDescending = false;

    if (event.sortField) {
      sortBy = Array.isArray(event.sortField) ? event.sortField[0] : event.sortField;
      sortDescending = event.sortOrder === -1;
    }

    const searchParams: DeviceMessageComboPagedRequest = {
      pageNumber,
      pageSize,
      searchTerm: this.messageComboSearchTerm,
      sortBy,
      sortDescending,
      deviceId: this.messageComboDeviceFilter || undefined,
      messageId: this.messageComboMessageFilter ? parseInt(this.messageComboMessageFilter) : undefined
    };

    this.deviceService.getDeviceMessageCombosPaged(searchParams).subscribe({
      next: (response) => {
        if (response.success && response.result) {
          this.messageCombos = response.result.items;
          console.log("messagecombos", this.messageCombos)
          this.messageCombosTotalRecords = response.result.totalCount;
        } else {
          this.messageCombos = [];
          this.messageCombosTotalRecords = 0;
        }
        this.messageCombosLoading = false;
      },
      error: (error) => {
        this.showError('Failed to load message combos');
        this.messageCombosLoading = false;
      }
    });
  }

  loadGatewaysLazy(event: TableLazyLoadEvent): void {
    if (this.gatewaysLoading) {
      return;
    }

    this.gatewaysLoading = true;

    const pageNumber = Math.floor((event.first || 0) / (event.rows || this.gatewaysRows)) + 1;
    const pageSize = event.rows || this.gatewaysRows;

    let sortBy = '';
    let sortDescending = false;

    if (event.sortField) {
      sortBy = Array.isArray(event.sortField) ? event.sortField[0] : event.sortField;
      sortDescending = event.sortOrder === -1;
    }

    const searchParams: GatewayPagedRequest = {
      pageNumber,
      pageSize,
      searchTerm: this.gatewaySearchTerm,
      sortBy,
      sortDescending,
      storeId: this.storeId
    };

    this.gatewayService.getGatewaysPaged(searchParams).subscribe({
      next: (response) => {
        if (response.success && response.result) {
          this.gateways = response.result.items;
          this.gatewaysTotalRecords = response.result.totalCount;
        } else {
          this.gateways = [];
          this.gatewaysTotalRecords = 0;
        }
        this.gatewaysLoading = false;
      },
      error: (error) => {
        this.showError('Failed to load gateways');
        this.gatewaysLoading = false;
      }
    });
  }

  // ============ SEARCH TRIGGER METHODS ============

  onDeviceSearchInput(): void {
    this.deviceSearchSubject$.next();
  }

  onTemplateSearchInput(event?: any): void {
    console.log('Template search input changed:', this.templateSearchTerm);
    // If search term becomes empty, trigger immediate search
    if (!this.templateSearchTerm || this.templateSearchTerm.trim() === '') {
      this.onTemplateSearch();
    } else {
      this.templateSearchSubject$.next();
    }
  }

  onComboSearchInput(event?: any): void {
    console.log('Combo search input changed:', this.comboSearchTerm);
    // If search term becomes empty, trigger immediate search
    if (!this.comboSearchTerm || this.comboSearchTerm.trim() === '') {
      this.onComboSearch();
    } else {
      this.comboSearchSubject$.next();
    }
  }

  onAssignmentSearchInput(event?: any): void {
    console.log('Assignment search input changed:', this.assignmentSearchTerm);
    // If search term becomes empty, trigger immediate search
    if (!this.assignmentSearchTerm || this.assignmentSearchTerm.trim() === '') {
      this.onAssignmentSearch();
    } else {
      this.assignmentSearchSubject$.next();
    }
  }

  onMessageComboSearchInput(event?: any): void {
    console.log('Message Combo search input changed:', this.messageComboSearchTerm);
    // If search term becomes empty, trigger immediate search
    if (!this.messageComboSearchTerm || this.messageComboSearchTerm.trim() === '') {
      this.onMessageComboSearch();
    } else {
      this.messageComboSearchSubject$.next();
    }
  }

  onGatewaySearch(): void {
    if (this.gatewaysTable) {
      this.gatewaysTable.first = 0;
      this.gatewaysTable.clearFilterValues();
      this.loadGatewaysLazy({ first: 0, rows: this.gatewaysRows });
    }
  }

  // Assignments pagination
  // onAssignmentsPageChange(event: any) {
  //   this.assignmentsRows = event.rows;
  //   // this.assignmentsFirst = event.first;
  //   this.assignmentsTable?.reset();
  // }

  // Gateways pagination
  onGatewaysPageChange(event: any) {
    this.gatewaysRows = event.rows;
    // this.gatewaysFirst = event.first;
    this.gatewaysTable?.reset();
  }

  // Add pagination change handler for devices
  onDevicesPageChange(event: any): void {
    this.devicesRows = event.rows;
    this.loadDevicesLazy({
      first: event.first,
      rows: event.rows,
      sortField: this.devicesTable?.sortField,
      sortOrder: this.devicesTable?.sortOrder
    });
  }

  onTemplatesPageChange(event: any): void {
    this.templatesRows = event.rows;
    this.loadLocalTemplatesLazy({
      first: event.first,
      rows: event.rows,
      sortField: this.templatesTable?.sortField,
      sortOrder: this.templatesTable?.sortOrder
    });
  }

  onCombosPageChange(event: any): void {
    this.templatesRows = event.rows;
    this.loadCombosLazy({
      first: event.first,
      rows: event.rows,
      sortField: this.templatesTable?.sortField,
      sortOrder: this.templatesTable?.sortOrder
    });
  }
  onMessageCombosPageChange(event: any): void {
    this.templatesRows = event.rows;
    this.loadMessageCombosLazy({
      first: event.first,
      rows: event.rows,
      sortField: this.templatesTable?.sortField,
      sortOrder: this.templatesTable?.sortOrder
    });
  }
  onAssignmentsPageChange(event: any): void {
    this.templatesRows = event.rows;
    this.loadAssignmentsLazy({
      first: event.first,
      rows: event.rows,
      sortField: this.templatesTable?.sortField,
      sortOrder: this.templatesTable?.sortOrder
    });
  }
  // ============ SEARCH EXECUTION METHODS ============

  public onDeviceSearch(): void {
    // Reset to first page and trigger lazy load with proper filters
    if (this.devicesTable) {
      // Clear any existing table filters
      this.devicesTable.clearFilterValues();

      // Reset to first page
      this.devicesTable.first = 0;

      // Trigger lazy load with current search parameters
      this.loadDevicesLazy({
        first: 0,
        rows: this.devicesRows,
        sortField: this.devicesTable.sortField,
        sortOrder: this.devicesTable.sortOrder
      });
    }
  }

  public onTemplateSearch(): void {
    console.log('Executing template search for term:', this.templateSearchTerm);
    if (this.templatesTable) {
      // Reset to first page
      this.templatesTable.first = 0;
      // Clear any existing filters
      this.templatesTable.clearFilterValues();
      // Trigger lazy load
      this.loadLocalTemplatesLazy({ first: 0, rows: this.templatesRows });
    }
  }

  public onComboSearch(): void {
    console.log('Executing combo search for term:', this.comboSearchTerm);
    if (this.combosTable) {
      // Reset to first page
      this.combosTable.first = 0;
      // Clear any existing filters
      this.combosTable.clearFilterValues();
      // Trigger lazy load
      this.loadCombosLazy({ first: 0, rows: this.combosRows });
    }
  }

  public onAssignmentSearch(): void {
    console.log('Executing assignment search for term:', this.assignmentSearchTerm);
    if (this.assignmentsTable) {
      // Reset to first page
      this.assignmentsTable.first = 0;
      // Clear any existing filters
      this.assignmentsTable.clearFilterValues();
      // Trigger lazy load
      this.loadAssignmentsLazy({ first: 0, rows: this.assignmentsRows });
    }
  }

  public onMessageComboSearch(): void {
    console.log('Executing message combo search for term:', this.messageComboSearchTerm);
    if (this.messageCombosTable) {
      // Reset to first page
      this.messageCombosTable.first = 0;
      // Clear any existing filters
      this.messageCombosTable.clearFilterValues();
      // Trigger lazy load
      this.loadMessageCombosLazy({ first: 0, rows: this.messageCombosRows });
    }
  }

  clearMessageComboFilters(): void {
    this.messageComboSearchTerm = '';
    this.messageComboDeviceFilter = 0;
    this.messageComboMessageFilter = '';
    if (this.messageCombosTable) {
      this.messageCombosTable.reset();
      this.messageCombosTable.clearFilterValues();
      this.loadMessageCombosLazy({ first: 0, rows: this.messageCombosRows });
    }
  }

  //handle when search term becomes empty
  private handleEmptySearch(): void {
    switch (this.activeTabKey) {
      case 'devices':
        this.deviceSearchTerm = '';
        this.onDeviceSearch();
        break;
      case 'templates':
        this.templateSearchTerm = '';
        this.onTemplateSearch();
        break;
      case 'combos':
        this.comboSearchTerm = '';
        this.onComboSearch();
        break;
      case 'messageCombos':
        this.messageComboSearchTerm = '';
        this.onMessageComboSearch();
        break;
      case 'assignments':
        this.assignmentSearchTerm = '';
        this.onAssignmentSearch();
        break;
    }
  }
  // ============ TAB HANDLING ============

  onTabChange(event: any): void {
    this.activeTabIndex = event.index;

    // Load data when switching tabs
    switch (this.visibleTabs[event.index]) {
      case 'devices':
        if (this.devices.length === 0) {
          this.loadDevicesLazy({ first: 0, rows: this.devicesRows });
        }
        break;
      case 'templates':
        if (this.templates.length === 0) {
          this.loadLocalTemplatesLazy({ first: 0, rows: this.templatesRows });
        }
        break;
      case 'combos':
        if (this.combos.length === 0) {
          this.loadCombosLazy({ first: 0, rows: this.combosRows });
        }
        // Load combo options for assignment dialog
        this.loadComboOptions();
        break;
      case 'messageCombos':
        if (this.messageCombos.length === 0) {
          this.loadMessageCombosLazy({ first: 0, rows: this.messageCombosRows });
        }
        // Load message combo options for assignment dialog
        this.loadMessageComboOptions();
        break;
      case 'assignments':
        if (this.assignments.length === 0) {
          this.loadAssignmentsLazy({ first: 0, rows: this.assignmentsRows });
        }
        this.loadComboOptions();
        this.loadMessageComboOptions();
        break;
      case 'gateways':
        if (this.gateways.length === 0) {
          this.loadGatewaysLazy({ first: 0, rows: this.gatewaysRows });
        }
        break;
    }
  }


  onDeviceStatusFilterChange(): void {
    this.onDeviceSearch();
  }

  // ============ CLEAR FILTERS ============

  clearDeviceFilters(): void {
    this.deviceSearchTerm = '';
    this.deviceStatusFilter = '';
    if (this.devicesTable) {
      this.devicesTable.reset();
      this.devicesTable.clearFilterValues();
      this.loadDevicesLazy({ first: 0, rows: this.devicesRows });
    }
  }

  clearTemplateFilters(): void {
    this.templateSearchTerm = '';
    this.templateActiveFilter = null;
    if (this.templatesTable) {
      this.templatesTable.reset();
      this.templatesTable.clearFilterValues();
      this.loadLocalTemplatesLazy({ first: 0, rows: this.templatesRows });
    }
  }

  clearComboFilters(): void {
    this.comboSearchTerm = '';
    this.comboDeviceFilter = 0;
    this.comboTemplateFilter = '';
    if (this.combosTable) {
      this.combosTable.reset();
      this.combosTable.clearFilterValues();
      this.loadCombosLazy({ first: 0, rows: this.combosRows });
    }
  }

  clearAssignmentFilters(): void {
    this.assignmentSearchTerm = '';
    this.assignmentLocationTypeFilter = '';
    this.assignmentComboFilter = '';
    this.assignmentComboFilter = '';
    this.assignmentActiveFilter = null;
    if (this.assignmentsTable) {
      this.assignmentsTable.reset();
      this.assignmentsTable.clearFilterValues();
      this.loadAssignmentsLazy({ first: 0, rows: this.assignmentsRows });
    }
  }

  clearGatewayFilters(): void {
    this.gatewaySearchTerm = '';
    if (this.gatewaysTable) {
      this.gatewaysTable.reset();
      this.gatewaysTable.clearFilterValues();
      this.loadGatewaysLazy({ first: 0, rows: this.gatewaysRows });
    }
  }


  // ============ DIALOG METHODS ============

  openDeviceDialog(device?: LocalDeviceDto): void {
    if (device) {
      this.isEditMode = true;
      this.selectedDevice = device;
      this.deviceForm.patchValue({
        id: device.id,
        macAddress: device.mac,
        deviceName: device.deviceName,
        // Forced rather than carried over: the device type picker is hidden
        // (see showDeviceTypeSelector) and everything is Minew for now, so
        // saving an existing Standard device normalises it to Minew.
        deviceType: 'Minew',
        storeId: device.storeId,
        screenId: device.screenId || null,
        ipAddress: device.ipAddress || '',
        networkName: device.networkName || '',
        firmware: device.firmware || '',
        hardware: device.hardware || '',
        battery: device.battery || 100,
        statusId: device.statusId || 1,
        isActive: device.isActive || true,
        isOnline: device.isOnline || false
      });
    } else {
      this.isEditMode = false;
      this.selectedDevice = null;
      this.deviceForm.reset({
        deviceType: 'Minew',
        storeId: this.storeId,
        battery: 100,
        statusId: 1,
        isActive: true,
        isOnline: false
      });
    }

    // Load screen options when opening dialog
    this.loadInitialStores();
    this.loadScreenOptions();
    this.displayDeviceDialog = true;
    this.openTplDialog('displayDeviceDialog', this.displayDeviceDialogTpl, '750px');
  }

  /**
   * Opens one of this page's dialog templates in a Material dialog. Re-opening
   * an already-open key closes the previous instance first so the map never
   * leaks a stale ref.
   */
  private openTplDialog(
    key: string,
    tpl: TemplateRef<unknown>,
    width: string,
  ): void {
    this.tplDialogRefs.get(key)?.close();
    const ref = this.dialog.open(tpl, {
      width,
      maxWidth: '95vw',
      maxHeight: '90vh',
    });
    this.tplDialogRefs.set(key, ref);
    ref.afterClosed().subscribe(() => {
      if (this.tplDialogRefs.get(key) === ref) {
        this.tplDialogRefs.delete(key);
      }
    });
  }

  closeTplDialog(key: string): void {
    this.tplDialogRefs.get(key)?.close();
    this.tplDialogRefs.delete(key);
    (this as unknown as Record<string, unknown>)[key] = false;
  }

  openMinewBatchDialog(): void {
    if (this.minewBatchAddComponent) {
      this.minewBatchAddComponent.openDialog();
    } else {
      console.error('MinewBatchAddComponent not found');
    }
  }

  onMinewDevicesAdded(count: number): void {
    this.showSuccess(`${count} Minew devices added and synced successfully`);

    // Refresh devices list
    if (this.devicesTable) {
      this.devicesTable.reset();
      this.loadDevicesLazy({ first: 0, rows: this.devicesRows });
    }
  }

  openTemplateDialog(template?: LocalTemplateDto): void {
    if (template) {
      this.isEditMode = true;
      this.selectedTemplate = template;
      this.templateForm.patchValue({
        id: template.id,
        name: template.name,
        description: template.description || '',
        screenInch: template.screenInch || 0,
        screenWidth: template.screenWidth || 0,
        screenHeight: template.screenHeight || 0,
        color: template.color || '',
        orientation: template.orientation || 0,
        storeId: template.storeId || '',
        isActive: template.isActive || true
      });
    } else {
      this.isEditMode = false;
      this.selectedTemplate = null;
      this.templateForm.reset({
        isActive: true,
        storeId: this.storeId
      });
    }
    this.displayTemplateDialog = true;
    this.openTplDialog('displayTemplateDialog', this.displayTemplateDialogTpl, '600px');
  }

  openComboDialog(): void {
    this.comboForm.reset({
      isDefault: false
    });
    this.displayComboDialog = true;
    this.openTplDialog('displayComboDialog', this.displayComboDialogTpl, '500px');
  }

  // openAssignmentDialog(): void {
  //   this.assignmentForm.reset({
  //     displayOrder: 0,
  //     isActive: true
  //   });
  //   this.displayAssignmentDialog = true;
  // }

  openAssignmentDialog(type: 'TEMPLATE' | 'MESSAGE' = 'TEMPLATE', combo?: any): void {
    this.assignmentForm.reset({
      displayOrder: 0,
      isActive: true
    });

    // If a specific combo is provided, preselect it
    if (combo) {
      if (type === 'TEMPLATE') {
        this.assignmentForm.patchValue({
          comboId: combo.id
        });
      } else if (type === 'MESSAGE') {
        // For message combos, you might need a different approach
        // since the assignment form expects deviceTemplateComboId
        // You might need to modify your assignment form to handle both types
      }
    }

    this.displayAssignmentDialog = true;
    this.openTplDialog('displayAssignmentDialog', this.displayAssignmentDialogTpl, '500px');
  }


  /**
   * Fills in screen size for devices in the active store. A device added from
   * the portal has no screen - the panel size is only knowable from Minew, so
   * this reads the store's labels back and maps each one onto the matching
   * DeviceScreens row, creating that row when the size is new.
   */
  refreshDeviceScreens(): void {
    if (!this.storeId) {
      this.showError('Select a store first.');
      return;
    }

    if (!this.minewStoreId) {
      this.showError(
        'This store is not linked to Minew yet. Sync the store to the cloud first.',
      );
      return;
    }

    this.screensRefreshing = true;

    this.deviceService.refreshDeviceScreens(this.storeId).subscribe({
      next: (res) => {
        this.screensRefreshing = false;
        if (res?.updated > 0) {
          this.showSuccess(res.message || 'Screen details updated.');
          this.loadDevicesLazy({ first: 0, rows: this.devicesRows });
        } else {
          this.showSuccess(res?.message || 'No devices needed a screen update.');
        }
      },
      error: (err) => {
        this.screensRefreshing = false;
        this.showError(
          err?.error?.message || 'Failed to refresh screen details',
        );
      },
    });
  }

  openSyncDialog(): void {
    this.selectedSyncType = 'localToCloud';
    this.loading = false; // Reset loading state
    this.displayDeviceSyncDialog = true;
    this.openTplDialog('displayDeviceSyncDialog', this.displayDeviceSyncDialogTpl, '500px');
  }

  openScreenDimensionDialog(device?: any) {
    this.selectedDevice = device;   // so your *ngIf="selectedDevice" works
    this.loadScreenDimensions(device.id); // optional
    this.displayScreenDimensionDialog = true;
    this.openTplDialog('displayScreenDimensionDialog', this.displayScreenDimensionDialogTpl, '600px');
  }


  syncTemplates(): void {
    this.displayTemplateSyncDialog = true;
    this.openTplDialog('displayTemplateSyncDialog', this.displayTemplateSyncDialogTpl, '500px');
  }

  syncGateways(): void {
    this.gatewayService.syncGateways(this.storeId).subscribe({
      next: (response) => {
        this.showSuccess('Gateways synced successfully');
        if (this.gatewaysTable) {
          this.gatewaysTable.reset();
        }
      },
      error: (error) => {
        this.showError('Failed to sync gateways');
      }
    });
  }

  openMessageComboDialog(): void {
    this.messageComboForm.reset({
      displayOrder: 0,
      isActive: true
    });
    this.displayMessageComboDialog = true;
  }

  openGatewayDialog(gateway?: GatewayDto): void {
    if (gateway) {
      this.isEditMode = true;
      this.selectedGateway = gateway;
      this.gatewayForm.patchValue({
        id: gateway.id,
        macAddress: gateway.macAddress,
        name: gateway.name,
        description: gateway.description,
        storeId: gateway.storeId,
        gatewayType: gateway.gatewayType || 'Minew',
        hardwareVersion: gateway.hardwareVersion,
        firmwareVersion: gateway.firmwareVersion,
        battery: gateway.battery || 100,
        statusId: gateway.statusId,
        isActive: gateway.isActive
      });
    } else {
      this.isEditMode = false;
      this.selectedGateway = null;
      this.gatewayForm.reset({
        gatewayType: 'Minew',
        storeId: this.storeId,
        battery: 100,
        statusId: 1,
        isActive: true
      });
    }

    this.loadInitialStores();
    this.displayGatewayDialog = true;
    this.openTplDialog('displayGatewayDialog', this.displayGatewayDialogTpl, '600px');
  }


  // ============ SAVE METHODS ============

  saveDevice(): void {
    if (this.deviceForm.invalid) {
      this.markFormGroupTouched(this.deviceForm);
      return;
    }

    const formValue = this.deviceForm.value;
    const userId = this.currentUserId;

    const request = {
      macAddress: formValue.macAddress,
      name: formValue.deviceName,
      deviceType: formValue.deviceType,
      storeId: formValue.storeId,
      screenId: formValue.screenId,
      ipAddress: formValue.deviceType === 'Standard' ? formValue.ipAddress : '',
      networkName: formValue.networkName,
      firmware: formValue.firmware,
      hardware: formValue.hardware,
      battery: formValue.battery,
      statusId: formValue.statusId,
      isActive: formValue.isActive,
      createdUser: userId
    };

    if (this.isEditMode) {
      const updateRequest = {
        id: formValue.id,
        ...request,
        updatedUser: userId
      };

      this.deviceService.updateDevice(formValue.id, updateRequest).subscribe({
        next: (device) => {
          this.showSuccess('Device updated successfully');
          this.displayDeviceDialog = false;
          this.closeTplDialog('displayDeviceDialog');
          if (this.devicesTable) {
            this.devicesTable.reset();
          }
          this.loadDeviceOptions();
        },
        error: (error) => {
          this.showError('Failed to update device');
        }
      });
    } else {
      this.deviceService.createDevice(request).subscribe({
        next: (device) => {
          this.showSuccess('Device created successfully');
          this.displayDeviceDialog = false;
          this.closeTplDialog('displayDeviceDialog');
          if (this.devicesTable) {
            this.devicesTable.reset();
          }
          this.loadDeviceOptions();
        },
        error: (error) => {
          this.showError('Failed to create device');
        }
      });
    }
  }

  saveTemplate(): void {
    if (this.templateForm.invalid) {
      this.markFormGroupTouched(this.templateForm);
      return;
    }

    // Implement save logic here
    if (this.isEditMode) {
      this.showSuccess('Template updated successfully');
    } else {
      this.showSuccess('Template created successfully');
    }

    this.displayTemplateDialog = false;
    this.closeTplDialog('displayTemplateDialog');
    // Refresh templates list
    if (this.templatesTable) {
      this.templatesTable.reset();
    }
    // Refresh template options
    this.loadTemplateOptions();
  }

  saveCombo(): void {
    if (this.comboForm.invalid) {
      this.markFormGroupTouched(this.comboForm);
      return;
    }

    const formValue = this.comboForm.value;

    this.deviceService.createDeviceTemplateCombo(
      formValue.deviceId,
      formValue.templateId,
      formValue.isDefault
    ).subscribe({
      next: (combo) => {
        this.showSuccess('Combo created successfully');
        this.displayComboDialog = false;
        this.closeTplDialog('displayComboDialog');
        // Refresh combos list
        if (this.combosTable) {
          this.combosTable.reset();
        }
        // Refresh combo options
        this.loadComboOptions();
      },
      error: (error) => {
        this.showError('Failed to create combo');
      }
    });
  }

  saveAssignment(): void {
    if (this.assignmentForm.invalid) {
      this.markFormGroupTouched(this.assignmentForm);
      return;
    }

    const formValue = this.assignmentForm.value;
    console.log('Saving assignment with values:', formValue);
    this.deviceService.assignComboToLocationWithDetails(
      'TEMPLATE',
      formValue.locationType,
      formValue.locationId,
      this.currentUserId,
      formValue.displayOrder,
      this.storeId
      // formValue.displayOrder,
      // formValue.isActive
    ).subscribe({
      next: (assignment) => {
        this.showSuccess('Assignment created successfully');
        this.displayAssignmentDialog = false;
        this.closeTplDialog('displayAssignmentDialog');
        // Refresh assignments list
        if (this.assignmentsTable) {
          this.assignmentsTable.reset();
        }
      },
      error: (error) => {
        console.error('API error:', error);

        const apiMessage =
          error?.error?.message ||
          error?.error?.Message ||
          'Failed to create assignment';

        this.showError(apiMessage);
      }
    });
  }

  saveGateway(): void {
    if (this.gatewayForm.invalid) {
      this.markFormGroupTouched(this.gatewayForm);
      return;
    }

    const formValue = this.gatewayForm.value;
    const userId = this.currentUserId;

    if (this.isEditMode) {
      const updateRequest: UpdateGatewayRequest = {
        id: formValue.id,
        name: formValue.name,
        description: formValue.description,
        battery: formValue.battery,
        isOnline: false,
        lastSeen: null,
        isActive: formValue.isActive,
        updatedUser: userId
      };

      this.gatewayService.updateGateway(formValue.id, updateRequest).subscribe({
        next: (gateway) => {
          this.showSuccess('Gateway updated successfully');
          this.displayGatewayDialog = false;
          this.closeTplDialog('displayGatewayDialog');
          if (this.gatewaysTable) {
            this.gatewaysTable.reset();
          }
        },
        error: (error) => {
          this.showError('Failed to update gateway');
        }
      });
    } else {
      const createRequest: CreateGatewayRequest = {
        macAddress: formValue.macAddress,
        name: formValue.name,
        description: formValue.description,
        storeId: formValue.storeId,
        gatewayType: formValue.gatewayType,
        hardwareVersion: formValue.hardwareVersion,
        firmwareVersion: formValue.firmwareVersion,
        battery: formValue.battery,
        statusId: formValue.statusId,
        isActive: formValue.isActive,
        createdUser: userId
      };

      this.gatewayService.createGateway(createRequest).subscribe({
        next: (gateway) => {
          this.showSuccess('Gateway created successfully');
          this.displayGatewayDialog = false;
          this.closeTplDialog('displayGatewayDialog');
          if (this.gatewaysTable) {
            this.gatewaysTable.reset();
          }
        },
        error: (error) => {
          this.showError('Failed to create gateway');
        }
      });
    }
  }


  /**
   * Pushes local-only devices for the active store up to the Minew cloud.
   *
   * Minew has no single-device create - `apis/esl/label/batchAdd` (behind our
   * devices/batch-add-minew) is the only way in, which is the same call the
   * Batch Add dialog makes. Only devices without a MinewDeviceId are sent; the
   * cloud answers per MAC, and a label it already knows about comes back as
   * "already added" rather than as a failure.
   */
  private syncLocalToCloud(): void {
    if (!this.minewStoreId) {
      this.loading = false;
      this.showError(
        'This store is not linked to Minew yet. Sync the store to the cloud first.',
      );
      return;
    }

    this.deviceService.getLocalDevices().subscribe({
      next: (devices) => {
        // Every local device for this store is offered to Minew. MinewDeviceId
        // cannot be used to pre-filter: CreateDeviceAsync sets it to the MAC for
        // any Minew device at creation, whether or not the cloud has ever seen
        // it. Minew dedupes for us, answering per MAC, and the summary below
        // separates genuinely-added from already-present.
        const pending = (devices || []).filter(
          (d) => String(d.storeId) === String(this.storeId) && !!d.mac,
        );

        if (pending.length === 0) {
          this.loading = false;
          this.showSuccess('There are no devices in this store to sync.');
          return;
        }

        this.deviceService
          .batchAddDevicesToMinew({
            storeId: this.minewStoreId,
            macAddresses: pending.map((d) => d.mac),
            type: 1, // 1 = ESL tag (5 = warning light)
            userId: this.currentUserId,
          })
          .subscribe({
            next: (response) => {
              this.loading = false;
              const result = response?.result;

              if (!response?.success || !result) {
                this.showError(response?.message || 'Failed to sync devices to cloud');
                return;
              }

              // Minew answers per MAC in the account's own language, so classify
              // on its wording rather than trusting a single count.
              const verdicts = Object.entries(result.results || {});
              const isAdded = (v: string) => /^(success|成功)$/i.test((v || '').trim());
              const isAlreadyThere = (v: string) => (v || '').includes('已被添加');

              const added = verdicts.filter(([, v]) => isAdded(v)).length;
              const already = verdicts.filter(([, v]) => isAlreadyThere(v)).length;
              const rejected = verdicts.filter(
                ([, v]) => !isAdded(v) && !isAlreadyThere(v),
              );

              const parts: string[] = [];
              if (added) parts.push(`${added} added`);
              if (already) parts.push(`${already} already in Minew`);
              if (rejected.length) parts.push(`${rejected.length} rejected`);

              const summary = parts.length ? parts.join(', ') : 'nothing to do';

              if (rejected.length) {
                // Surface Minew's own wording - it explains why (unknown label,
                // wrong store, and so on).
                this.showError(
                  `Sync to Minew: ${summary}. ` +
                    rejected.map(([mac, reason]) => `${mac}: ${reason}`).join('; '),
                );
              } else {
                this.showSuccess(`Sync to Minew: ${summary}.`);
              }

              this.loadDevicesLazy({ first: 0, rows: this.devicesRows });
            },
            error: () => {
              this.loading = false;
              this.showError('Failed to sync devices to cloud');
            },
          });
      },
      error: () => {
        this.loading = false;
        this.showError('Could not read the local device list');
      },
    });
  }

  /**
   * Reads the MAC off the device's barcode sticker with the camera - webcam on
   * a laptop, rear camera when the page is open on a phone - and drops it into
   * the form. The dialog only returns normalised 12-hex-char MACs.
   */
  scanMacAddress(): void {
    import('../../../shared/components/barcode-scanner/barcode-scanner.component')
      .then(({ BarcodeScannerComponent }) => {
        const ref = this.dialog.open(BarcodeScannerComponent, {
          panelClass: 'barcode-scanner-dialog',
          autoFocus: false,
          restoreFocus: true
        });

        ref.afterClosed().subscribe((macs?: string[]) => {
          const mac = macs?.[0];
          if (!mac) return;
          this.deviceForm.patchValue({ macAddress: mac });
          this.deviceForm.get('macAddress')?.markAsDirty();
          this.showSuccess(`Scanned MAC ${mac}`);
        });
      })
      .catch(() => this.showError('Could not load the barcode scanner'));
  }

  private syncFromCloud(): void {
    this.deviceService.syncDevicesFromCloud(this.storeId).subscribe({
      next: (devices) => {
        this.loading = false;
        this.showSuccess('Devices synced from cloud successfully');
        this.loadDevicesLazy({ first: 0, rows: this.devicesRows });
      },
      error: (error) => {
        this.loading = false;
        this.showError('Failed to sync devices from cloud');
      }
    });
  }
  saveScreenDimension(): void {
    if (this.screenDimensionForm.invalid || !this.selectedDevice) {
      this.markFormGroupTouched(this.screenDimensionForm);
      return;
    }

    const formValue = this.screenDimensionForm.value;
    const userId = 1; // Get from auth service

    const request: CreateDeviceScreenDimensionRequest = {
      deviceId: this.selectedDevice.id,
      screenWidth: formValue.screenWidth,
      screenHeight: formValue.screenHeight,
      orientation: formValue.orientation,
      refreshRate: formValue.refreshRate,
      colorDepth: formValue.colorDepth,
      pixelDensity: formValue.pixelDensity,
      createdUser: userId
    };

    this.deviceService.createDeviceScreenDimension(
      this.selectedDevice.id,
      request
    ).subscribe({
      next: (dimension) => {
        this.showSuccess('Screen dimension added successfully');
        this.displayScreenDimensionDialog = false;
        this.closeTplDialog('displayScreenDimensionDialog');
        this.loadScreenDimensions(this.selectedDevice!.id);
      },
      error: (error) => {
        this.showError('Failed to add screen dimension');
      }
    });
  }

  confirmTemplateSync(): void {
    this.displayTemplateSyncDialog = false;
    this.closeTplDialog('displayTemplateSyncDialog');

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '420px',
      data: {
        title: 'Sync Templates',
        message: 'This will sync templates from the cloud for this store. Do you want to continue?',
        confirmText: 'Sync',
        cancelText: 'Cancel',
        confirmColor: 'primary'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) {
        return;
      }

      this.syncingTemplates = true;

      const storeId = this.storeId;

      this.deviceService.syncTemplatesFromCloud(storeId).subscribe({
        next: (templates) => {
          this.showSuccess(`Templates synced successfully (${templates.length})`);
          this.syncingTemplates = false;

          // Reload templates list after sync
          if (this.templatesTable) {
            this.templatesTable.reset();
          }
        },
        error: (error) => {
          console.error('Template sync failed:', error);
          const reason = error?.error?.message || error?.message;
          this.showError(
            reason
              ? `Failed to sync templates from cloud: ${reason}`
              : 'Failed to sync templates from cloud',
          );
          this.syncingTemplates = false;
        }
      });
    });
  }

  confirmDeviceSync(): void {
    if (!this.selectedSyncType) {
      this.showError('Please select a sync type');
      return;
    }

    this.displayDeviceSyncDialog = false;
    this.closeTplDialog('displayDeviceSyncDialog');

    // Confirmation before sync
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '450px',
      data: {
        title: 'Confirm Sync',
        message: `Are you sure you want to sync devices ${this.selectedSyncType === 'localToCloud' ? 'to cloud' : 'from cloud'}?`,
        confirmText: 'Start Sync',
        cancelText: 'Cancel',
        confirmColor: 'primary'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loading = true;

        if (this.selectedSyncType === 'localToCloud') {
          this.syncLocalToCloud();
        } else {
          this.syncFromCloud();
        }
      }
    });
  }

  saveMessageCombo(): void {
    if (this.messageComboForm.invalid) {
      this.markFormGroupTouched(this.messageComboForm);
      return;
    }

    const formValue = this.messageComboForm.value;
    const dto = {
      deviceId: formValue.deviceId,
      messageId: formValue.messageId,
      storeId: this.storeId,
      isActive: formValue.isActive ?? true
    };

    this.deviceService.createDeviceMessageCombo(dto).subscribe({
      next: (response) => {
        if (response.success && response.result) {
          this.showSuccess('Message combo created successfully');
          this.displayMessageComboDialog = false;
          // Refresh message combos list
          if (this.messageCombosTable) {
            this.messageCombosTable.reset();
          }
          // Refresh message combo options
          this.loadMessageComboOptions();
        } else {
          this.showError(response.message || 'Failed to create message combo');
        }
      },
      error: (error) => {
        this.showError('Failed to create message combo: ' + (error.error?.message || error.message));
      }
    });
  }

  // ============ DELETE METHODS ============

  deleteDevice(device: LocalDeviceDto): void {
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Device',
        message: `Are you sure you want to delete "${device.deviceName}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      },
      panelClass: ['rounded-lg'],
      disableClose: true
    });
    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const response = await firstValueFrom(this.deviceService.deleteDevice(device.id, this.currentUserId));
        if (response.success) {
          this.showSuccess(response.message);
          this.devicesTable?.reset();
        } else {
          this.showError(response.message);
        }
      }
    });
  }

  isDeviceRowMinew(device: LocalDeviceDto): boolean {
    return (device.deviceType || '').toLowerCase() === 'minew';
  }

  blinkDevice(device: LocalDeviceDto): void {
    this.deviceService.lightUpDevice(device.mac, Number(device.storeId)).subscribe({
      next: () => {
        this.showSuccess(`Blinking "${device.deviceName}"`);
      },
      error: (err) => {
        // The API returns Minew's own reason (gateway offline, unknown label,
        // store not linked). Swallowing it left only "Failed to blink", which
        // says nothing about what to fix.
        const reason = err?.error?.message || err?.message;
        this.showError(
          reason
            ? `Failed to blink "${device.deviceName}": ${reason}`
            : `Failed to blink "${device.deviceName}"`,
        );
      },
    });
  }

  deleteTemplate(template: LocalTemplateDto): void {
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Template',
        message: `Are you sure you want to delete "${template.name}"`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      },
      panelClass: ['rounded-lg'],
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const response = await firstValueFrom(this.deviceService.deleteTemplate(template.id, this.currentUserId));
        if (response.success) {
          this.showSuccess(response.message);
          this.devicesTable?.reset();
        } else {
          this.showError(response.message);
        }
      }
    });
  }


  deleteCombo(combo: DeviceTemplateComboDto): void {
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Combo',
        message: `Are you sure you want to delete "${combo.deviceName} - ${combo.templateName}" combo?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      },
      panelClass: ['rounded-lg'],
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const response = await firstValueFrom(this.deviceService.deleteCombo(combo.id, this.currentUserId));
        if (response.success) {
          this.showSuccess(response.message);
          this.devicesTable?.reset();
        } else {
          this.showError(response.message);
        }
      }
    });
  }

  deleteAssignment(assignment: DeviceAssignmentDto): void {
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Assignment',
        message: `Are you sure you want to delete the "${assignment.locationName || this.getLocationName(assignment)}" assignment?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      },
      panelClass: ['rounded-lg'],
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result === true && assignment?.id) {
        try {
          const response = await firstValueFrom(
            this.deviceService.deleteAssignment(assignment.id)
          );

          if (response.success) {
            this.showSuccess(response.message || 'Assignment deleted successfully');
            // Refresh table
            this.assignmentsTable?.reset();
          } else {
            this.showError(response.message || 'Cannot delete assignment');
          }
        } catch (error: any) {
          console.error(error);
          this.showError(`Failed to delete assignment: ${error.message || error}`);
        }
      }
    });
  }

  deleteMessageCombo(msgcombo: DeviceMessageComboDto): void {
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Message Combo',
        message: `Are you sure you want to delete the "${msgcombo.deviceName} - ${msgcombo.messageTitle}" combo?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      },
      panelClass: ['rounded-lg'],
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result === true && msgcombo?.id) {
        try {
          const response = await firstValueFrom(
            this.deviceService.deleteMessageCombo(msgcombo.id, this.currentUserId)
          );

          if (response.success) {
            this.showSuccess(response.message || 'Message Combo deleted successfully');
            // Refresh table
            this.messageCombosTable?.reset();
          } else {
            this.showError(response.message || 'Cannot delete Message combo');
          }
        } catch (error: any) {
          console.error(error);
          this.showError(`Failed to delete message combo: ${error.message || error}`);
        }
      }
    });
  }


  // deleteCombo(combo: DeviceTemplateComboDto): void {
  //   this.confirmationService.confirm({
  //     message: `Are you sure you want to delete combo "${combo.deviceName} - ${combo.templateName}"?`,
  //     header: 'Confirm Deletion',
  //     icon: 'pi pi-exclamation-triangle',
  //     accept: () => {
  //       // Implement delete logic here
  //       this.showSuccess('Combo deleted successfully');
  //       // Refresh combos list
  //       if (this.combosTable) {
  //         this.combosTable.reset();
  //       }
  //     }
  //   });
  // }

  // deleteAssignment(assignment: DeviceAssignmentDto): void {
  //   this.confirmationService.confirm({
  //     message: `Are you sure you want to delete this assignment?`,
  //     header: 'Confirm Deletion',
  //     icon: 'pi pi-exclamation-triangle',
  //     accept: () => {
  //       this.deviceService.removeAssignment(assignment.id).subscribe({
  //         next: () => {
  //           this.showSuccess('Assignment deleted successfully');
  //           // Refresh assignments list
  //           if (this.assignmentsTable) {
  //             this.assignmentsTable.reset();
  //           }
  //         },
  //         error: (error) => {
  //           this.showError('Failed to delete assignment');
  //         }
  //       });
  //     }
  //   });
  // }

  deleteScreenDimension(dimension: DeviceScreenDimensionResponse): void {
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Confirm Deletion',
        message: `Are you sure you want to delete screen dimension ${dimension.screenSize}?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const userId = 1; // Get from auth service
        this.deviceService.deleteDeviceScreenDimension(dimension.id, userId).subscribe({
          next: () => {
            this.showSuccess(`Screen dimension deleted successfully`);
            if (this.selectedDevice) {
              this.loadScreenDimensions(this.selectedDevice.id);
            }
          },
          error: (error) => {
            this.showError('Failed to delete screen dimension');
          }
        });
      }
    });
  }

  deleteGateway(gateway: GatewayDto): void {
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Gateway',
        message: `Are you sure you want to delete "${gateway.name}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      },
      panelClass: ['rounded-lg'],
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const response = await firstValueFrom(this.gatewayService.deleteGateway(gateway.id, this.currentUserId));
        if (response.success) {
          this.showSuccess(response.message);
          this.gatewaysTable?.reset();
        } else {
          this.showError(response.message);
        }
      }
    });
  }

  // ============ HELPER METHODS ============

  getStatusBadge(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'online':
        return 'success';
      case 'inactive':
      case 'offline':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  getBatteryClass(battery: number): string {
    if (battery > 70) return 'bg-green-500';
    if (battery > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  getScreenSize(device: LocalDeviceDto): string {
    return `${device.screenWidth || 0}x${device.screenHeight || 0}`;
  }

  getLocationName(assignment: DeviceAssignmentDto): string {
    if (assignment.locationName) {
      return assignment.locationName;
    }

    switch (assignment.locationType?.toLowerCase()) {
      case 'shelf':
        return `Shelf ${assignment.locationId}`;
      case 'aisle':
        return `Aisle ${assignment.locationId}`;
      case 'product':
        return `Product ${assignment.locationId}`;
      default:
        return `Location ${assignment.locationId}`;
    }
  }

  getLocationTypeBadge(locationType: string): string {
    if (!locationType) return 'secondary';

    switch (locationType.toLowerCase()) {
      case 'shelf':
        return 'info';
      case 'aisle':
        return 'warning';
      case 'product':
        return 'success';
      default:
        return 'secondary';
    }
  }

  // getDeviceName(assignment: AssignmentDto): string {
  //   return assignment.combo?.deviceName || 'Unknown Device';
  // }
  getDeviceName(assignment: DeviceAssignmentDto): string {
    return assignment.deviceName || 'Unknown Device';
  }

  getTemplateName(assignment: DeviceAssignmentDto): string {
    if (assignment.isTemplateAssignment) {
      return assignment.templateName || 'Template';
    }

    if (assignment.isMessageAssignment) {
      return assignment.messageTitle || 'Message';
    }

    return 'Unknown Assignment';
  }

  //   getTemplateName(assignment: AssignmentDto): string {
  //  if (assignment.assignmentType === 'TEMPLATE') {
  //     return assignment.combo.templateName;
  //   }

  //   if (assignment.assignmentType === 'MESSAGE') {
  //     return assignment.combo.messageTitle!;
  //   }

  //   return 'Unknown';  }

  //Template Preview
  loadTemplatePreview(template: LocalTemplateDto): void {
    this.selectedTemplateForPreview = template;
    this.isLoadingPreview = true;
    this.displayTemplatePreviewDialog = true;
    this.openTplDialog('displayTemplatePreviewDialog', this.displayTemplatePreviewDialogTpl, '700px');
    this.templatePreviewImage = null;

    // Assuming your device service has a method to get template preview
    // If not, you might need to implement it in the service
    this.deviceService.getTemplatePreview(template.name).subscribe({
      next: (previewData) => {
        this.templatePreviewImage = previewData;
        this.isLoadingPreview = false;
      },
      error: (error) => {
        console.error('Failed to load template preview:', error);
        this.showError('Failed to load template preview');
        this.isLoadingPreview = false;
      }
    });
  }

  // Add this method to close the preview dialog
  closeTemplatePreview(): void {
    this.displayTemplatePreviewDialog = false;
    this.closeTplDialog('displayTemplatePreviewDialog');
    this.selectedTemplateForPreview = null;
    this.templatePreviewImage = null;
    this.isLoadingPreview = false;
  }

  // Add this method to get template info for display in preview dialog
  getTemplateInfo(template: LocalTemplateDto): string {
    const infoParts = [];

    if (template.screenWidth && template.screenHeight) {
      infoParts.push(`${template.screenWidth}x${template.screenHeight}`);
    }

    if (template.screenInch) {
      infoParts.push(`${template.screenInch}"`);
    }

    if (template.color) {
      infoParts.push(template.color);
    }

    if (template.orientation !== undefined) {
      infoParts.push(template.orientation === 0 ? 'Portrait' : 'Landscape');
    }

    return infoParts.join(' | ');
  }
  loadTemplatePreviewFromCombo(combo: DeviceTemplateComboDto): void {

    // You need to find the template from your templates list
    const template = this.templates.find(t => t.id === combo.templateId);
    console.log("template", template)
    if (template) {
      this.loadTemplatePreview(template);
    } else {
      // Template not found locally, fetch it from API
      this.fetchTemplateById(combo.templateId).then(fetchedTemplate => {
        if (fetchedTemplate) {
          this.loadTemplatePreview(fetchedTemplate);
        } else {
          this.showWarning('Template not found');
        }
      });
    }
  }

  private fetchTemplateById(templateId: string): Promise<LocalTemplateDto | null> {
    return new Promise((resolve) => {
      this.deviceService.getTemplateById(templateId).subscribe({
        next: (template) => {
          // Add to local templates array for future use
          if (!this.templates.find(t => t.id === template.id)) {
            this.templates.push(template);
          }
          resolve(template);
        },
        error: (error) => {
          console.error('Error fetching template:', error);
          this.showWarning(`Unable to load template: ${error.message || 'Template not found'}`);
          resolve(null);
        }
      });
    });
  }

  getStoreName(): string {
    return this.storeName?.trim() || 'Unknown Store';
  }

  viewAssignmentDetails(assignment: DeviceAssignmentDto): void {
    let message = `
    <div class="space-y-3">
      <div><strong>Device:</strong> ${assignment.deviceName}</div>
      <div><strong>Assignment Type:</strong> ${assignment.assignmentType}</div>
      ${assignment.isTemplateAssignment ? `<div><strong>Template:</strong> ${assignment.templateName}</div>` : ''}
      ${assignment.isMessageAssignment ? `
        <div><strong>Message Title:</strong> ${assignment.messageTitle}</div>
        <div><strong>Message Content:</strong> ${assignment.messageContent}</div>
      ` : ''}
      <div><strong>Location:</strong> ${assignment.locationType} - ${assignment.locationName || assignment.locationId}</div>
      <div><strong>Store:</strong> ${assignment.storeName}</div>
      <div><strong>Active:</strong> ${assignment.isActive ? 'Yes' : 'No'}</div>
      <div><strong>Created:</strong> ${assignment.createdDate} by ${assignment.createdUser}</div>
    </div>
  `;

    this.primeMessageService.add({
      severity: 'info',
      summary: 'Assignment Details',
      detail: message,
      life: 5000
    });
  }


  getComboDisplay(assignment: DeviceAssignmentDto): string {
    if (assignment.isTemplateAssignment && assignment.isMessageAssignment) {
      return 'Template & Message';
    } else if (assignment.isTemplateAssignment) {
      return 'Template';
    } else if (assignment.isMessageAssignment) {
      return 'Message';
    }
    return 'Unknown';
  }

  isMinewDevice(): boolean {
    return this.deviceForm.get('deviceType')?.value === 'Minew';
  }

  getScreenDisplay(screenId: number): string {
    const screen = this.screenOptions.find(s => s.id === screenId);
    if (screen) {
      return `${screen.name} (${screen.width}x${screen.height})`;
    }
    return 'Select screen';
  }

  getSelectedStoreName(): string {
    const storeId = this.deviceForm.get('storeId')?.value;
    if (!storeId) return 'Select Store';

    const selectedStore = this.storeOptions.find(store => store.value === storeId);
    return selectedStore ? selectedStore.storeName : 'Store #' + storeId;
  }

  getContentTypeName(messageCombo: DeviceMessageComboDto): string {
    if (messageCombo.messageType) {
      return messageCombo.messageType;
    }

    // Fallback based on messageId or other properties
    switch (messageCombo.messageContentType) {
      case 1: return 'Text';
      case 2: return 'Image';
      case 3: return 'Video';
      case 4: return 'HTML';
      default: return 'Unknown';
    }
  }

  getContentTypeSeverity(messageCombo: DeviceMessageComboDto): string {
    switch (messageCombo.messageContentType) {
      case 1: return 'info';    // Text
      case 2: return 'success'; // Image
      case 3: return 'warning'; // Video
      case 4: return 'help';    // HTML
      default: return 'secondary';
    }
  }

  // viewMessageDetails(messageCombo: DeviceMessageComboDto): void {
  //   let message = `
  //     <div class="space-y-3">
  //       <div><strong>Device:</strong> ${messageCombo.deviceName} (${messageCombo.deviceMac})</div>
  //       <div><strong>Message Title:</strong> ${messageCombo.messageTitle || 'No title'}</div>
  //       <div><strong>Content Type:</strong> ${this.getContentTypeName(messageCombo)}</div>
  //       ${messageCombo.contentTypeName ? `<div><strong>Content:</strong> ${messageCombo.contentTypeName}</div>` : ''}
  //       <div><strong>Display Order:</strong> ${messageCombo.displayOrder || 0}</div>
  //       <div><strong>Status:</strong> ${messageCombo.isActive ? 'Active' : 'Inactive'}</div>
  //       ${messageCombo.createdDate ? `<div><strong>Created:</strong> ${messageCombo.createdDate}</div>` : ''}
  //     </div>
  //   `;

  //   this.primeMessageService.add({
  //     severity: 'info',
  //     summary: 'Message Combo Details',
  //     detail: message,
  //     life: 5000
  //   });
  // }
  viewMessageDetails(messageCombo: DeviceMessageComboDto): void {
    this.primeMessageService.add({
      severity: 'info',
      summary: 'Message Combo Details',
      life: 6000,
      data: {
        deviceName: messageCombo.deviceName,
        deviceMac: messageCombo.deviceMac,
        messageTitle: messageCombo.messageTitle,
        contentType: this.getContentTypeName(messageCombo),
        content: messageCombo.contentTypeName,
        displayOrder: messageCombo.displayOrder ?? 0,
        isActive: messageCombo.isActive,
        createdDate: messageCombo.createdDate
      }
    });
  }


  private getContentTypeDisplay(contentType: number): string {
    switch (contentType) {
      case 1: return 'Text';
      case 2: return 'Image';
      case 3: return 'Video';
      case 4: return 'HTML';
      default: return 'Unknown';
    }
  }

  // Add gateway status badge method
  getGatewayStatusBadge(gateway: GatewayDto): string {
    if (gateway.isOnline) return 'success';
    if (!gateway.isActive) return 'danger';
    return 'warning';
  }

  // Add gateway status text method
  getGatewayStatusText(gateway: GatewayDto): string {
    if (gateway.isOnline) return 'Online';
    if (!gateway.isActive) return 'Inactive';
    return 'Offline';
  }

  // Add battery class method for gateways (if battery is available)
  getGatewayBatteryClass(battery?: number): string {
    if (!battery) return 'bg-gray-300';
    if (battery > 70) return 'bg-green-500';
    if (battery > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  // Add last seen display method
  getLastSeenDisplay(gateway: GatewayDto): string {
    if (!gateway.lastSeen) return 'Never';

    const lastSeen = new Date(gateway.lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return lastSeen.toLocaleDateString();
  }

  // In DeviceManagementComponent - Add this method
  viewGatewayDetails(gateway: GatewayDto): void {
    let message = `
    <div class="space-y-3">
      <div class="flex items-center">
        <i class="pi pi-wifi text-blue-500 mr-2"></i>
        <div>
          <strong class="text-lg">${gateway.name}</strong>
          <p class="text-sm text-gray-600">${gateway.gatewayType || 'Minew Gateway'}</p>
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-3">
        <div>
          <p class="text-sm text-gray-600">MAC Address:</p>
          <p class="font-mono text-sm bg-gray-100 p-2 rounded">${gateway.macAddress}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Status:</p>
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${gateway.isOnline ? 'bg-green-100 text-green-800' :
        gateway.isActive ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
      }">
            ${this.getGatewayStatusText(gateway)}
          </span>
        </div>
      </div>
      
      <div>
        <p class="text-sm text-gray-600">Store:</p>
        <p class="font-medium">${gateway.storeName || 'Store #' + gateway.storeId}</p>
      </div>
      
      <div class="grid grid-cols-2 gap-3">
        <div>
          <p class="text-sm text-gray-600">Hardware:</p>
          <p class="font-medium">${gateway.hardwareVersion || 'Not specified'}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Firmware:</p>
          <p class="font-medium">${gateway.firmwareVersion || 'Not specified'}</p>
        </div>
      </div>
      
      <div>
        <p class="text-sm text-gray-600">Last Seen:</p>
        <p class="font-medium">${gateway.lastSeen ? (new Date(gateway.lastSeen)).toLocaleString() : 'Never'}</p>
      </div>
      
      <div class="grid grid-cols-2 gap-3">
        <div>
          <p class="text-sm text-gray-600">Created:</p>
          <p class="font-medium">${new Date(gateway.createdDate).toLocaleDateString()}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Active:</p>
          <p class="font-medium">${gateway.isActive ? 'Yes' : 'No'}</p>
        </div>
      </div>
      
      ${gateway.description ? `
        <div>
          <p class="text-sm text-gray-600">Description:</p>
          <p class="font-medium">${gateway.description}</p>
        </div>
      ` : ''}
      
      ${gateway.battery !== undefined ? `
        <div>
          <p class="text-sm text-gray-600">Battery:</p>
          <div class="flex items-center">
            <div class="w-32 bg-gray-200 rounded-full h-2 mr-2">
              <div class="h-full rounded-full ${gateway.battery > 70 ? 'bg-green-500' :
          gateway.battery > 30 ? 'bg-yellow-500' : 'bg-red-500'
        }" style="width: ${gateway.battery}%"></div>
            </div>
            <span class="font-medium">${gateway.battery}%</span>
          </div>
        </div>
      ` : ''}
    </div>
  `;

    this.primeMessageService.add({
      severity: 'info',
      summary: 'Gateway Details',
      detail: message,
      life: 10000,
      closable: true
    });
  }

  // Add help method
  showGatewayHelp(): void {
    const helpMessage = `
      <div class="space-y-3">
        <h3 class="font-bold text-lg text-blue-700">Gateway Management Help</h3>
        
        <div class="space-y-2">
          <p><strong>What are Gateways?</strong></p>
          <p class="text-sm">Gateways act as communication hubs that connect your ESL devices to the cloud network.</p>
        </div>
        
        <div class="space-y-2">
          <p><strong>Key Functions:</strong></p>
          <ul class="list-disc list-inside text-sm space-y-1">
            <li>Bridge communication between devices and cloud</li>
            <li>Manage device connections and data transmission</li>
            <li>Monitor device status and battery levels</li>
            <li>Enable remote updates and configuration</li>
          </ul>
        </div>
        
        <div class="space-y-2">
          <p><strong>Status Indicators:</strong></p>
          <ul class="list-none space-y-1 text-sm">
            <li><span class="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span> Online: Gateway is connected</li>
            <li><span class="inline-block w-3 h-3 bg-red-500 rounded-full mr-2"></span> Offline: Gateway is disconnected</li>
            <li><span class="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-2"></span> Inactive: Gateway is disabled</li>
          </ul>
        </div>
        
        <div class="space-y-2">
          <p><strong>Recommended Actions:</strong></p>
          <ul class="list-disc list-inside text-sm space-y-1">
            <li>Add gateways for each physical location/store</li>
            <li>Regularly sync gateways from cloud for updates</li>
            <li>Monitor battery levels for wireless gateways</li>
            <li>Keep firmware updated for security and performance</li>
          </ul>
        </div>
      </div>
    `;

    this.primeMessageService.add({
      severity: 'info',
      summary: 'Gateway Help',
      detail: helpMessage,
      life: 15000,
      closable: true
    });
  }

  // ============ TOAST METHODS ============
  private showSuccess(message: string): void {
    console.log('showSuccess called from:', new Error().stack); // Debug which function is calling
    this.primeMessageService.add({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 5000
    });
  }

  private showError(message: string): void {
    this.primeMessageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000
    });
  }

  private showWarning(message: string): void {
    this.primeMessageService.add({
      severity: 'warn',
      summary: 'Warning',
      detail: message,
      life: 5000
    });
  }

  private showInfo(message: string): void {
    this.primeMessageService.add({
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

  // ============ FORM VALIDATION ============

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
}