import { AfterViewInit, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AisleMaster } from '../../../core/interfaces/aisle.interface';
import { AisleService } from '../../../core/services/aisle.service';
import { AuthService } from '../../../core/services/auth.service';
import { Store, StoreFilterParams } from '../../../core/interfaces/store.interface';
import { DeviceService } from '../../../core/services/device.service';
import { LocalDeviceDto, LocalTemplateDto } from '../../../core/interfaces/device.interface';
import { ConfirmationService, MessageService } from 'primeng/api';
import { StoreService } from '../../../core/services/store.service';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, firstValueFrom } from 'rxjs';
import { ImportsModule } from '../../../imports/imports';
import { PagedResult } from '../../../core/interfaces/pagination-result.interface';
import { MessageWithUser } from '../../../core/interfaces/message.interface';
// import { MessageService } from '../../../core/services/message.service';
import { SearchParams } from '../../../core/interfaces/pagination-result.interface';
import { CustomSnackbarComponent, SnackbarData } from '../../../shared/components/alert/custom-snackbar.component';
import { SettingsService } from '../../../core/services/settings.service';
import { ConfirmationDialogComponent } from '../../../shared/components/dialog/confirmation-dialog/confirmation-dialog.component';
import { CustomMessageService } from '../../../core/services/message.service';

// Interfaces
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

@Component({
  selector: 'app-create-rack',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ImportsModule
  ],
  templateUrl: './create-rack.component.html',
  styleUrls: ['./create-rack.component.css'],
  providers: [ConfirmationService]
})
export class CreateRackComponent implements OnInit, AfterViewInit, OnDestroy {
  rackForm: FormGroup;
  isSubmitting = false;
  currentUserId!: number;
  visible = true;
  activeTabIndex = 0;
  isLoading = false;
  storeId: number = 0;

  // Store selection with lazy loading
  stores: Store[] = [];
  selectedStore: Store | null = null;

  // Pagination for stores
  storePageNumber = 1;
  storePageSize = 10;
  storeTotalCount = 0;
  storeTotalPages = 0;
  storeHasNextPage = false;
  storeHasPreviousPage = false;
  storeSearchTerm = '';
  isStoreLoading = false;

  // Store filter params
  storeFilterParams: StoreFilterParams = {
    pageNumber: 1,
    pageSize: 10,
    isActive: true
  };

  // Search subject for debouncing
  private storeSearchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // Device & Template data
  localDevices: LocalDeviceDto[] = [];
  localTemplates: LocalTemplateDto[] = [];
  messages: MessageWithUser[] = [];
  filteredDevices: LocalDeviceDto[] = [];
  filteredTemplates: LocalTemplateDto[] = [];
  isDevicesLoading = false;
  isTemplatesLoading = false;
  messageLoading = false;

  // Existing combos data
  existingCombos: ExistingCombo[] = [];
  existingMessageCombos: any[] = [];
  existingComboLoading = false;
  existingMessageComboLoading = false;

  // Combo mode per shelf (stored as shelfIndex => mode)
  shelfComboModes: Map<number, 'device-template' | 'device-message'> = new Map();
  selectedExistingCombos: Map<number, any[]> = new Map(); // shelfIndex => selected combos

  comboModeOptions: ComboModeOption[] = [
    { label: 'Device + Template', value: 'device-template', icon: 'pi pi-sliders-h' },
    { label: 'Device + Message', value: 'device-message', icon: 'pi pi-comment' }
  ];

  // Pagination
  existingComboPage = 1;
  existingMessageComboPage = 1;
  pageSize = 10;
  existingComboHasMore = true;
  existingMessageComboHasMore = true;

  //dialog control
  private allowClose = false;


  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateRackComponent>,
    private snackBar: MatSnackBar,
    private auth: AuthService,
    private aisleService: AisleService,
    private deviceService: DeviceService,
    private storeService: StoreService,
    private messageService: CustomMessageService,
    private primeMessageService: MessageService,
    private confirmationService: ConfirmationService,
    private settingsService: SettingsService,
    private cdRef: ChangeDetectorRef,
    private dialog: MatDialog,
  ) {
    this.rackForm = this.createForm();
  }

  canEdit(): boolean {
    return this.auth.hasAnyRole(['Admin', 'Manager', 'Operator']);
  }

  isReadOnlyMode(): boolean {
    return !this.canEdit();
  }

  getRackHeaderText(): string {
    return 'Create New Rack';
  }

  getRackDescriptionText(): string {
    return 'Create a new rack with complete details, shelves, and device assignments';
  }


  ngOnInit(): void {
    this.initCurrentUser();

    // Initialize the form 
    this.rackForm = this.createForm();

    // get default store (which will patch the form)
    this.getDefaultStore();

    this.setupStoreSearch();
    this.loadStoresLazy();

    // Debug: Check form value after setting default
    setTimeout(() => {
      console.log('Form storeId value:', this.rackForm.get('storeId')?.value);
      console.log('Selected store:', this.selectedStore);
      console.log('Stores loaded:', this.stores);
    }, 1000);

    // if storeId changes in the form
    this.rackForm.get('storeId')?.valueChanges.subscribe(storeId => {
      if (storeId && !this.selectedStore) {
        const store = this.stores.find(s => s.id === storeId);
        if (store) {
          this.selectedStore = store;
        }
      }
    });
  }

  getDefaultStore() {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    if (currentStore) {
      this.storeId = currentStore.id;
      console.log("CurrentStore", currentStore)
      this.selectedStore = currentStore;
      // Set the form control value
      this.rackForm.patchValue({
        storeId: currentStore.id
      });

      // Load data for this store
      this.loadDevicesForStore(currentStore.id);
      this.loadTemplatesForStore(currentStore.id);
      this.loadMessagesForStore();
      this.loadExistingCombos();
      this.loadExistingMessageCombos();
    }
  }

  ngAfterViewInit(): void {
    this.cdRef.detectChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initCurrentUser(): void {
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      this.showError('User not authenticated');
      return;
    }
    this.currentUserId = user.id;
  }

  private setupStoreSearch(): void {
    this.storeSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.storeFilterParams.searchTerm = searchTerm;
      this.storeFilterParams.pageNumber = 1;
      this.loadStoresLazy();
    });
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(75)]],
      description: ['', [Validators.maxLength(50)]],
      location: ['', [Validators.required, Validators.maxLength(75)]],
      coordinates: ['', [Validators.maxLength(75)]],
      storeId: [null, [Validators.required]],
      isActive: [true],
      shelves: this.fb.array([])
    });
  }

  private createShelfForm(): FormGroup {
    return this.fb.group({
      id: [null],
      name: ['', [Validators.required]],
      location: ['', [Validators.required]],
      coordinates: [''],
      ipAddress: [''],
      deviceName: [''],
      macAddress: [''],
      description: [''],
      isActive: [true],
      deviceCombos: this.fb.array([])
    });
  }

  private createDeviceComboForm(mode: 'device-template' | 'device-message' = 'device-template'): FormGroup {
    if (mode === 'device-template') {
      return this.fb.group({
        deviceId: [null, [Validators.required]],
        templateId: ['', [Validators.required]],
        displayOrder: [1, [Validators.required, Validators.min(1)]],
        isActive: [true],
        isDefault: [false],
        deviceTemplateComboId: [null]
      });
    } else {
      return this.fb.group({
        deviceId: [null, [Validators.required]],
        messageId: [null, [Validators.required]],
        displayOrder: [1, [Validators.required, Validators.min(1)]],
        isActive: [true],
        isDefault: [false],
        deviceMessageComboId: [null]
      });
    }
  }

  // Getters for form arrays
  get shelves(): FormArray {
    return this.rackForm.get('shelves') as FormArray;
  }

  getShelfCombos(shelfIndex: number): FormArray {
    const shelf = this.shelves.at(shelfIndex) as FormGroup;
    return shelf?.get('deviceCombos') as FormArray;
  }

  getShelfComboMode(shelfIndex: number): 'device-template' | 'device-message' {
    return this.shelfComboModes.get(shelfIndex) || 'device-template';
  }

  setShelfComboMode(shelfIndex: number, mode: 'device-template' | 'device-message'): void {
    const currentMode = this.getShelfComboMode(shelfIndex);

    if (currentMode !== mode) {
      // Clear existing combos when switching modes
      const combos = this.getShelfCombos(shelfIndex);
      while (combos.length) {
        combos.removeAt(0);
      }

      // Clear selections
      this.selectedExistingCombos.set(shelfIndex, []);
    }

    this.shelfComboModes.set(shelfIndex, mode);
  }

  // Store methods with lazy loading
  loadStoresLazy(): void {
    this.isStoreLoading = true;

    this.storeService.getStoresLazy(this.storeFilterParams).subscribe({
      next: (response: PagedResult<Store>) => {
        if (this.storeFilterParams.pageNumber === 1) {
          this.stores = response.items || [];
        } else {
          this.stores = [...this.stores, ...(response.items || [])];
        }

        this.storeTotalCount = response.totalCount || 0;
        this.storeTotalPages = response.totalPages || 0;
        this.storeHasNextPage = response.hasNextPage || false;
        this.storeHasPreviousPage = response.hasPreviousPage || false;
        this.storePageNumber = response.pageNumber || 1;
        this.storePageSize = response.pageSize || 10;
        this.isLoading = false;
        this.isStoreLoading = false;

        const selectedStoreId = this.rackForm.get('storeId')?.value;
        if (selectedStoreId && !this.selectedStore) {
          this.selectedStore = this.stores.find(store => store.id === selectedStoreId) || null;
        }

        this.cdRef.detectChanges();
      },
      error: (error) => {
        console.error('Error loading stores:', error);
        this.showError('Failed to load stores');
        this.stores = [];
        this.isStoreLoading = false;
        this.cdRef.detectChanges();
      }
    });
  }

  loadMoreStores(): void {
    if (this.isStoreLoading || !this.storeHasNextPage) {
      return;
    }

    this.storeFilterParams.pageNumber++;
    this.loadStoresLazy();
  }

  onStoreSearch(event: any): void {
    this.storeSearchSubject.next(event.filter || '');
  }

  onStoreChange(event?: any): void {
    if (event && event.value) {
      this.selectedStore = event.value;
      const storeId = this.selectedStore?.id;

      if (storeId) {
        this.loadDevicesForStore(storeId);
        this.loadTemplatesForStore(storeId);
        this.loadMessagesForStore();
        this.loadExistingCombos();
        this.loadExistingMessageCombos();
      }
    } else if (event && event.value === null) {
      // Handle clear
      this.onStoreClear();
    }
  }

  onStoreClear(): void {
    this.selectedStore = null;
    this.localDevices = [];
    this.localTemplates = [];
    this.messages = [];
    this.filteredDevices = [];
    this.filteredTemplates = [];
    this.existingCombos = [];
    this.existingMessageCombos = [];
    this.existingMessageCombos = [];
  }
  // Add this method to your component class
  compareStores(store1: Store, store2: Store): boolean {
    // Compare stores by their ID
    return store1 && store2 ? store1.id === store2.id : store1 === store2;
  }
  loadDevicesForStore(storeId: number): void {
    this.isDevicesLoading = true;

    this.deviceService.getLocalDevicesPagedbyStore(storeId, 1, 100).subscribe({
      next: (response) => {
        this.localDevices = response.items || [];
        this.filteredDevices = [...this.localDevices];
        this.isDevicesLoading = false;
        this.cdRef.detectChanges();
      },
      error: (error) => {
        console.error('Error loading devices:', error);
        this.isDevicesLoading = false;
        this.localDevices = [];
        this.filteredDevices = [];
      }
    });
  }

  loadTemplatesForStore(storeId: number): void {
    this.isTemplatesLoading = true;

    this.deviceService.getLocalTemplatesPagedByStore(storeId, 1, 100).subscribe({
      next: (response) => {
        this.localTemplates = response.items || [];
        this.filteredTemplates = [...this.localTemplates];
        this.isTemplatesLoading = false;
        this.cdRef.detectChanges();
      },
      error: (error) => {
        console.error('Error loading templates:', error);
        this.isTemplatesLoading = false;
        this.localTemplates = [];
        this.filteredTemplates = [];
      }
    });
  }

  async loadMessagesForStore(): Promise<void> {
    this.messageLoading = true;

    try {
      const request: SearchParams = {
        pageNumber: 1,
        pageSize: 100,
        searchTerm: '',
      };

      const response = await firstValueFrom(
        this.messageService.getMessagesPaged(request)
      );

      if (response.success && response.result) {
        this.messages = response.result.items || [];
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      this.messages = [];
    } finally {
      this.messageLoading = false;
    }
  }

  async loadExistingCombos(): Promise<void> {
    this.existingComboLoading = true;

    try {
      const request: SearchParams = {
        pageNumber: this.existingComboPage,
        pageSize: this.pageSize,
        searchTerm: ''
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
        battery: combo.battery
      }));

      this.existingCombos = mappedCombos;
      this.existingComboHasMore = this.existingCombos.length < (result?.totalCount || 0);
    } catch (error) {
      console.error('Error loading existing combos:', error);
      this.existingCombos = [];
    } finally {
      this.existingComboLoading = false;
    }
  }

  async loadExistingMessageCombos(): Promise<void> {
    this.existingMessageComboLoading = true;

    try {
      const request: SearchParams & { deviceId?: number; messageId?: number; isActive?: boolean } = {
        pageNumber: this.existingMessageComboPage,
        pageSize: this.pageSize,
        searchTerm: '',
        isActive: true
      };

      const pagedResult = await firstValueFrom(
        this.deviceService.getDeviceMessageCombosPagedByParams(request)
      );

      const newCombos = pagedResult.items || [];

      const mappedCombos = await Promise.all(newCombos.map(async (combo: any) => {
        let deviceName = 'Unknown Device';
        let messageTitle = 'Unknown Message';

        if (combo.deviceId) {
          const device = this.localDevices.find(d => d.id === combo.deviceId);
          if (device) deviceName = device.deviceName;
        }

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

      this.existingMessageCombos = mappedCombos;
      this.existingMessageComboHasMore = this.existingMessageCombos.length < (pagedResult.totalCount || 0);
    } catch (error) {
      console.error('Error loading existing message combos:', error);
      this.existingMessageCombos = [];
    } finally {
      this.existingMessageComboLoading = false;
    }
  }

  // Shelf Management
  addShelf(): void {
    const newShelf = this.createShelfForm();
    const shelfIndex = this.shelves.length;
    this.shelves.push(newShelf);

    // Initialize combo mode for this shelf
    this.shelfComboModes.set(shelfIndex, 'device-template');
    this.selectedExistingCombos.set(shelfIndex, []);

    setTimeout(() => {
      this.cdRef.detectChanges();
    }, 0);
  }

  removeShelf(index: number): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to remove this shelf?',
      header: 'Confirm Removal',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.shelves.removeAt(index);
        this.shelfComboModes.delete(index);
        this.selectedExistingCombos.delete(index);
        this.showSuccess('Shelf removed successfully');
      }
    });
  }

  // Device Combo Management
  addDeviceComboToShelf(shelfIndex: number): void {
    const combos = this.getShelfCombos(shelfIndex);
    const mode = this.getShelfComboMode(shelfIndex);

    if (combos) {
      const newCombo = this.createDeviceComboForm(mode);
      newCombo.patchValue({ displayOrder: combos.length + 1 });
      combos.push(newCombo);

      setTimeout(() => {
        this.cdRef.detectChanges();
      }, 0);
    }
  }

  removeDeviceComboFromShelf(shelfIndex: number, comboIndex: number): void {
    const combos = this.getShelfCombos(shelfIndex);
    if (combos && combos.length > 0) {
      combos.removeAt(comboIndex);
    }
  }

  addSelectedExistingCombosToShelf(shelfIndex: number): void {
    const selectedCombos = this.selectedExistingCombos.get(shelfIndex) || [];
    const mode = this.getShelfComboMode(shelfIndex);

    if (selectedCombos.length === 0) {
      this.showError('Please select at least one combo');
      return;
    }

    const combos = this.getShelfCombos(shelfIndex);

    selectedCombos.forEach(combo => {
      const newCombo = this.createDeviceComboForm(mode);
      newCombo.patchValue({
        deviceId: combo.deviceId,
        templateId: mode === 'device-template' ? combo.templateId : undefined,
        messageId: mode === 'device-message' ? combo.messageId : undefined,
        displayOrder: combos.length + 1,
        isActive: combo.isActive,
        isDefault: combo.isDefault || false,
        deviceTemplateComboId: mode === 'device-template' ? combo.id : null,
        deviceMessageComboId: mode === 'device-message' ? combo.id : null
      });
      combos.push(newCombo);
    });

    this.showSuccess(`Added ${selectedCombos.length} combo(s) to shelf`);
    this.selectedExistingCombos.set(shelfIndex, []);
  }

  // Helper methods for UI
  getDeviceName(deviceId: number): string {
    const device = this.localDevices.find(d => d.id === deviceId);
    return device?.deviceName || 'Unknown Device';
  }

  getTemplateName(templateId: string): string {
    const template = this.localTemplates.find(t => t.id === templateId);
    return template?.name || 'Unknown Template';
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
    const device = this.localDevices.find(d => d.id === deviceId);
    return device?.status || 'Unknown';
  }

  // Form Validation & Navigation
  canGoToNextTab(currentTab: number): boolean {
    if (currentTab === 0) {
      this.rackForm.markAllAsTouched();

      if (this.rackForm.get('name')?.invalid) {
        this.showError('Rack name is required');
        return false;
      }

      if (this.rackForm.get('location')?.invalid) {
        this.showError('Location is required');
        return false;
      }

      if (!this.selectedStore) {
        this.showError('Please select a store');
        return false;
      }

      return true;
    } else if (currentTab === 1) {
      if (this.shelves.length === 0) {
        this.showError('Please add at least one shelf');
        return false;
      }

      for (let i = 0; i < this.shelves.length; i++) {
        const shelf = this.shelves.at(i) as FormGroup;
        if (!shelf.get('name')?.value || !shelf.get('location')?.value) {
          this.showError(`Shelf ${i + 1} requires name and location`);
          return false;
        }
      }

      return true;
    }

    return true;
  }

  goToNextTab(): void {
    if (this.canGoToNextTab(this.activeTabIndex)) {
      this.activeTabIndex++;

      if (this.activeTabIndex === 1 && this.shelves.length === 0) {
        this.addShelf();
      }
    }
  }

  goToPreviousTab(): void {
    if (this.activeTabIndex > 0) {
      this.activeTabIndex--;
    }
  }

  // Form Submission
  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    this.isSubmitting = true;

    const formValue = this.rackForm.value;
    const rackData: AisleMaster = {
      name: formValue.name,
      description: formValue.description || '',
      location: formValue.location,
      coordinates: formValue.coordinates || '',
      storeId: formValue.storeId,
      isActive: formValue.isActive,
      createdUser: this.currentUserId,
      shelves: formValue.shelves.map((shelf: any) => {
        const shelfData: any = {
          name: shelf.name,
          location: shelf.location,
          coordinates: shelf.coordinates || '',
          description: shelf.description || '',
          isActive: shelf.isActive !== false,
          createdUser: this.currentUserId,
          aisleId: 0,
          deviceAssignments: []
        };

        if (shelf.deviceCombos && shelf.deviceCombos.length > 0) {
          shelfData.deviceAssignments = shelf.deviceCombos
            .filter((combo: any) => combo.deviceId && (combo.templateId || combo.messageId))
            .map((combo: any) => {
              const assignment: any = {
                assignmentType: shelf.comboMode || 'TEMPLATE',
                displayOrder: combo.displayOrder || 1,
                isActive: combo.isActive !== false,
                isDefault: combo.isDefault || false
              };

              if (combo.deviceTemplateComboId) {
                // Use existing template combo
                assignment.deviceTemplateComboId = combo.deviceTemplateComboId;
              } else if (combo.deviceMessageComboId) {
                // Use existing message combo
                assignment.deviceMessageComboId = combo.deviceMessageComboId;
              } else {
                // Create new combo
                assignment.deviceId = combo.deviceId;
                if (shelf.comboMode === 'device-template') {
                  assignment.templateId = combo.templateId;
                } else {
                  assignment.messageId = combo.messageId;
                }
              }

              return assignment;
            });
        }
        return shelfData;
      })
    };

    this.aisleService.createAisle(rackData).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.showSuccess('Rack created successfully!');
        this.dialogRef.close({ success: true, data: response });
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Error creating rack:', err);
        this.showError('Failed to create rack. Please try again.');
      }
    });
  }

  private validateForm(): boolean {
    this.rackForm.markAllAsTouched();

    if (this.rackForm.invalid) {
      const errors = [];
      if (this.rackForm.get('name')?.invalid) errors.push('Rack name is required');
      if (this.rackForm.get('location')?.invalid) errors.push('Location is required');
      if (!this.selectedStore) errors.push('Store selection is required');

      this.showError(errors.join(', '));
      return false;
    }

    if (this.shelves.length === 0) {
      this.showError('At least one shelf is required');
      return false;
    }

    for (let i = 0; i < this.shelves.length; i++) {
      const shelf = this.shelves.at(i) as FormGroup;
      if (!shelf.get('name')?.value || !shelf.get('location')?.value) {
        this.showError(`Shelf ${i + 1} requires name and location`);
        return false;
      }
    }

    return true;
  }



  onCancel(): void {
    if (this.rackForm.dirty || this.shelves.length > 0) {
      const confirmDialog = this.dialog.open(ConfirmationDialogComponent, {
        width: '400px',
        disableClose: true,
        data: {
          title: 'Confirm Cancel',
          message: 'You have unsaved changes. Are you sure you want to cancel?',
          confirmText: 'Yes, Cancel',
          cancelText: 'No',
          confirmColor: 'warn'
        }
      });

      confirmDialog.afterClosed().subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.visible = false;              // ✅ NOW close PrimeNG dialog
          this.dialogRef.close({ success: false });
        }
        // ❌ DO NOTHING if NO — dialog stays open
      });
    } else {
      this.visible = false;
      this.dialogRef.close({ success: false });
    }
  }


  // Helper Methods
  getFieldError(fieldName: string): string {
    const control = this.rackForm.get(fieldName);

    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return `${this.getFieldLabel(fieldName)} is required`;
      }
      if (control.errors['maxlength']) {
        return `${this.getFieldLabel(fieldName)} is too long`;
      }
    }
    return '';
  }

  getShelfFieldError(shelfIndex: number, fieldName: string): string {
    const shelf = this.shelves.at(shelfIndex) as FormGroup;
    const control = shelf.get(fieldName);

    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return `${fieldName === 'name' ? 'Shelf Name' : 'Location'} is required`;
      }
    }
    return '';
  }

  getDeviceComboFieldError(shelfIndex: number, comboIndex: number, fieldName: string): string {
    const combos = this.getShelfCombos(shelfIndex);
    const combo = combos.at(comboIndex) as FormGroup;
    const control = combo?.get(fieldName);

    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return `${fieldName === 'deviceId' ? 'Device' :
          fieldName === 'templateId' ? 'Template' :
            fieldName === 'messageId' ? 'Message' :
              fieldName} is required`;
      }
      if (control.errors['min']) {
        return 'Display order must be at least 1';
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      'name': 'Rack Name',
      'description': 'Description',
      'location': 'Location',
      'coordinates': 'Coordinates',
      'storeId': 'Store'
    };
    return labels[fieldName] || fieldName;
  }

  getDeviceCount(shelfIndex: number): number {
    const combos = this.getShelfCombos(shelfIndex);
    return combos ? combos.length : 0;
  }

  isShelfValid(shelfIndex: number): boolean {
    const shelf = this.shelves.at(shelfIndex) as FormGroup | null;
    return !!(shelf && shelf.get('name')?.valid && shelf.get('location')?.valid);
  }

  // Snackbar Methods
  private showSuccess(message: string): void {
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
  //     icon: 'pi pi-check-circle',
  //     type: 'success'
  //   });
  // }

  // private showError(message: string): void {
  //   this.openSnackbar({
  //     message: message,
  //     icon: 'pi pi-times-circle',
  //     type: 'error'
  //   });
  // }

  // private openSnackbar(data: SnackbarData): void {
  //   this.snackBar.openFromComponent(CustomSnackbarComponent, {
  //     data: data,
  //     duration: 3000,
  //     horizontalPosition: 'end',
  //     verticalPosition: 'top',
  //     panelClass: [`${data.type}-snackbar`]
  //   });
  // }

  // Get shelf form group safely
  getShelfFormGroup(shelfIdx: number): FormGroup {
    return this.shelves.at(shelfIdx) as FormGroup;
  }
}