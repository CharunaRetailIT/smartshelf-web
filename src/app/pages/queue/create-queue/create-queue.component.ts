import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { DeviceService } from '../../../core/services/device.service';
import { ProductService } from '../../../core/services/product.service';
import { QueueService } from '../../../core/services/queue.service';
import { ShelfService } from '../../../core/services/shelf.service';
import { CustomMessageService } from '../../../core/services/message.service';
import { SettingsService } from '../../../core/services/settings.service';
import { AuthService } from '../../../core/services/auth.service';
import { ImportsModule } from '../../../imports/imports';
import {
  DeviceAssignmentDto,
  DeviceMessageComboDto,
  DeviceTemplateComboDto,
  EslBrandDto,
} from '../../../core/interfaces/device.interface';
import { SearchParams } from '../../../core/interfaces/pagination-result.interface';

@Component({
  selector: 'app-create-queue',
  imports: [ImportsModule],
  templateUrl: './create-queue.component.html',
  styleUrl: './create-queue.component.css'
})
export class CreateQueueComponent implements OnInit {
  @Input() inDialog: boolean = false;
  @Output() onQueueCreated = new EventEmitter<void>();
  @Output() onCancel = new EventEmitter<void>();

  queueForm!: FormGroup;
  sourceOptions: any[] = [
    { label: 'From Existing Assignment', value: 'assignment', icon: 'pi pi-copy' },
    { label: 'Direct Creation', value: 'direct', icon: 'pi pi-plus' }
  ];

  locationTypes: any[] = [
    { label: 'Product', value: 'PRODUCT' },
    { label: 'Shelf', value: 'SHELF' },
  ];

  priorityOptions: any[] = [];
  recurrenceOptions: any[] = [
    { label: 'None', value: null },
    { label: 'Daily', value: 'DAILY' },
    { label: 'Weekly', value: 'WEEKLY' },
    { label: 'Monthly', value: 'MONTHLY' },
    { label: 'Yearly', value: 'YEARLY' }
  ];

  // Dropdown data
  assignments: any[] = [];
  eslBrandOptions: EslBrandDto[] = [];
  devices: any[] = [];
  templates: any[] = [];
  messages: any[] = [];
  products: any[] = [];
  shelves: any[] = [];

  // 'existing' lets the queue reuse an already-created DeviceTemplateCombos /
  // DeviceMessageCombos row instead of pairing a device+template/message from
  // scratch - same two modes the product ESL assignment form offers.
  comboSourceMode: 'new' | 'existing' = 'new';
  existingCombos: DeviceTemplateComboDto[] = [];
  existingMessageCombos: DeviceMessageComboDto[] = [];
  // Confirms exactly which device+template/message an "existing combo" pick resolved to.
  existingComboPreview: { device: string; binding: string } | null = null;

  // Selected values
  selectedDevice: any = null;
  selectedAssignment: any = null;
  selectedLocation: any = null;

  // UI state
  loading: boolean = false;

  storeId = 0;
  currentUserId = 0;

  //StartDate validation
  minStartDate: Date = new Date();

  visible: boolean = false;

  constructor(
    private fb: FormBuilder,
    private queueService: QueueService,
    private deviceService: DeviceService,
    private productService: ProductService,
    private shelfService: ShelfService,
    private messageService: CustomMessageService,
    private settingsService: SettingsService,
    private auth: AuthService,
    private toastService: MessageService
  ) { }

  ngOnInit() {
    this.initForm();
    this.setDefaultStore();
    this.initCurrentUser();
    this.loadPriorities();
    this.loadAssignments();
    this.loadBrands();
    this.loadLocationData(this.queueForm.get('locationType')?.value);
  }

  private setDefaultStore(): void {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    this.storeId = currentStore?.id || 0;
  }

  private initCurrentUser(): void {
    const user = this.auth.getCurrentUserValue();
    this.currentUserId = user?.id || 0;
  }

  initForm() {
    this.queueForm = this.fb.group({
      sourceType: ['assignment', Validators.required],
      assignmentId: [null],

      // Direct fields
      brandId: [null],
      deviceId: [null],
      templateId: [null],
      messageId: [null],
      deviceTemplateComboId: [null],
      deviceMessageComboId: [null],
      locationType: ['PRODUCT', Validators.required],
      locationId: [null],

      // Schedule
      startDate: [new Date(), Validators.required],
      endDate: [null],
      priorityId: [4],
      displayOrder: [1],

      // Recurrence
      isRecurring: [false],
      recurrencePattern: [null]
    });

    // Watch for changes
    this.queueForm.get('sourceType')?.valueChanges.subscribe(val => {
      this.onSourceTypeChange(val);
    });

    this.queueForm.get('locationType')?.valueChanges.subscribe(val => {
      this.queueForm.patchValue({ locationId: null }, { emitEvent: false });
      this.loadLocationData(val);
    });

    this.applySourceValidators('assignment');
  }

  open(): void {
    this.visible = true;
  }

  cancel(): void {
    this.visible = false;  // ← was probably just emitting, change to set visible
  }

  //#region Brand-driven content selection

  // Templates are Minew-cloud designs (MinewTemplates) - a Standard device has
  // no template concept, so the Template field is only shown for Minew rows.
  // Messages are brand-agnostic/local-only, so they're available either way.
  brandSupportsTemplate(): boolean {
    const brandId = this.queueForm?.get('brandId')?.value;
    if (!brandId) return true;
    return this.brandCode(brandId) !== 'standard';
  }

  isMinewBrand(): boolean {
    const brandId = this.queueForm?.get('brandId')?.value;
    if (!brandId) return false;
    return this.brandCode(brandId) === 'minew';
  }

  isStandardBrand(): boolean {
    const brandId = this.queueForm?.get('brandId')?.value;
    if (!brandId) return false;
    return this.brandCode(brandId) === 'standard';
  }

  private brandCode(brandId: number): string {
    const brand = this.eslBrandOptions.find(b => b.id === brandId);
    return (brand?.code || '').toLowerCase();
  }

  getBrandName(id: number | null): string {
    return this.eslBrandOptions.find(x => x.id === id)?.name || 'No Brand';
  }

  loadBrands() {
    this.deviceService.getBrands().subscribe({
      next: (brands) => {
        this.eslBrandOptions = brands || [];
      },
      error: () => this.showError('Failed to load ESL brands')
    });
  }

  onBrandChange() {
    this.queueForm.patchValue({
      deviceId: null,
      templateId: null,
      messageId: null,
      deviceTemplateComboId: null,
      deviceMessageComboId: null
    });

    this.devices = [];
    this.existingCombos = [];
    this.existingMessageCombos = [];
    this.existingComboPreview = null;
    this.selectedDevice = null;

    if (this.comboSourceMode === 'existing') {
      this.loadExistingCombos();
    } else {
      this.loadDevices();
      // Templates are Minew-only; messages apply to every brand.
      if (this.brandSupportsTemplate()) {
        this.loadTemplates();
      }
      this.loadMessages();
    }

    this.applyDirectValidators();
  }

  toggleComboSourceMode(mode: 'new' | 'existing') {
    if (this.comboSourceMode === mode) return;

    this.comboSourceMode = mode;

    this.queueForm.patchValue({
      deviceId: null,
      templateId: null,
      messageId: null,
      deviceTemplateComboId: null,
      deviceMessageComboId: null
    });

    this.existingComboPreview = null;

    if (mode === 'existing') {
      // Minew reuses a Device+Template combo; Standard has no template concept
      // and reuses a Device+Message combo instead. Picking a combo resolves its
      // own device, so there's no separate device picker in that mode.
      this.loadExistingCombos();
    } else {
      this.loadDevices();
      if (this.brandSupportsTemplate()) {
        this.loadTemplates();
      }
      this.loadMessages();
    }

    this.applyDirectValidators();
  }

  private loadExistingCombos() {
    if (this.brandSupportsTemplate()) {
      this.loadExistingTemplateCombos();
    } else {
      this.loadExistingMessageCombos();
    }
  }

  loadExistingTemplateCombos(search?: string) {
    this.deviceService.getCombosPaged({
      pageNumber: 1,
      pageSize: 10,
      searchTerm: search,
      isActive: true
    }).subscribe({
      next: (res: any) => {
        this.existingCombos = res?.result?.items || [];
      },
      error: () => this.showError('Failed to load existing device+template combos')
    });
  }

  loadExistingMessageCombos(search?: string) {
    this.deviceService.getDeviceMessageCombosPagedByParams({
      pageNumber: 1,
      pageSize: 10,
      searchTerm: search,
      isActive: true
    }).subscribe({
      next: (res) => {
        this.existingMessageCombos = res?.items || [];
      },
      error: () => this.showError('Failed to load existing device+message combos')
    });
  }

  onExistingComboSelected() {
    const comboId = this.queueForm.get('deviceTemplateComboId')?.value;
    const combo = this.existingCombos.find(c => c.id === comboId);

    if (!combo) {
      this.existingComboPreview = null;
      this.queueForm.patchValue({ deviceId: null, templateId: null });
      return;
    }

    this.queueForm.patchValue({
      deviceId: Number(combo.deviceId),
      templateId: combo.templateId
    });
    this.existingComboPreview = {
      device: combo.deviceName || 'Unknown device',
      binding: combo.templateName || 'Unknown template'
    };
  }

  onExistingMessageComboSelected() {
    const comboId = this.queueForm.get('deviceMessageComboId')?.value;
    const combo = this.existingMessageCombos.find(c => c.id === comboId);

    if (!combo) {
      this.existingComboPreview = null;
      this.queueForm.patchValue({ deviceId: null, messageId: null });
      return;
    }

    this.queueForm.patchValue({
      deviceId: Number(combo.deviceId),
      messageId: combo.messageId
    });
    this.existingComboPreview = {
      device: combo.deviceName || 'Unknown device',
      binding: combo.messageTitle || 'Unknown message'
    };
  }

  //#endregion

  onSourceTypeChange(type: string) {
    if (type === 'assignment') {
      this.loadAssignments();
    }

    this.applySourceValidators(type);
  }

  // Validity has to follow the chosen source: an assignment-sourced queue needs
  // only the assignment, a direct one needs brand + device + a binding that
  // matches the brand (template for Minew, message for Standard) + a location.
  private applySourceValidators(type: string) {
    const assignment = this.queueForm.get('assignmentId');
    const brand = this.queueForm.get('brandId');
    const device = this.queueForm.get('deviceId');
    const locationId = this.queueForm.get('locationId');

    if (type === 'assignment') {
      assignment?.setValidators([Validators.required]);
      brand?.clearValidators();
      device?.clearValidators();
      locationId?.clearValidators();
      this.queueForm.get('templateId')?.clearValidators();
      this.queueForm.get('messageId')?.clearValidators();
    } else {
      assignment?.clearValidators();
      brand?.setValidators([Validators.required]);
      device?.setValidators([Validators.required]);
      locationId?.setValidators([Validators.required]);
    }

    assignment?.updateValueAndValidity({ emitEvent: false });
    brand?.updateValueAndValidity({ emitEvent: false });
    device?.updateValueAndValidity({ emitEvent: false });
    locationId?.updateValueAndValidity({ emitEvent: false });

    if (type === 'direct') {
      this.applyDirectValidators();
    }
  }

  private applyDirectValidators() {
    const template = this.queueForm.get('templateId');
    const message = this.queueForm.get('messageId');

    if (this.isStandardBrand()) {
      template?.clearValidators();
      message?.setValidators([Validators.required]);
    } else if (this.isMinewBrand()) {
      template?.setValidators([Validators.required]);
      message?.clearValidators();
    } else {
      template?.clearValidators();
      message?.clearValidators();
    }

    template?.updateValueAndValidity({ emitEvent: false });
    message?.updateValueAndValidity({ emitEvent: false });
  }

  onDeviceChange(deviceId: number) {
    // Changing the device invalidates whatever binding was picked for the
    // previous one.
    this.queueForm.patchValue({ templateId: null, messageId: null });

    if (!deviceId) {
      this.selectedDevice = null;
      return;
    }

    this.selectedDevice = this.devices.find(d => d.id === deviceId) || null;

    if (this.brandSupportsTemplate()) {
      this.loadTemplates();
    }
    this.loadMessages();
  }

  loadAssignments() {
    this.deviceService.getAssignmentsPaged({ pageSize: 100 }).subscribe({
      next: (res: any) => {
        this.assignments = (res.items || []).map((a: DeviceAssignmentDto) => ({
          ...a,
          displayName: `${a.deviceDisplay} - ${a.comboName || a.messageTitle} [${a.assignmentType}]`
        }));
      }
    });
  }

  loadDevices(event?: any) {
    const brandId = this.queueForm.get('brandId')?.value;

    const request: SearchParams = {
      pageNumber: 1,
      pageSize: 10,
      searchTerm: event?.filter || event?.query || '',
      storeId: this.storeId || undefined,
      brandId: brandId || undefined
    } as SearchParams;

    this.deviceService.getLocalDevicesPaged(request).subscribe({
      next: (res: any) => {
        this.devices = res?.result?.items || [];
      },
      error: () => this.showError('Failed to load devices')
    });
  }

  loadTemplates(search?: string) {
    this.deviceService.getLocalTemplatesPaged({
      searchTerm: search,
      pageNumber: 1,
      pageSize: 10,
      storeId: this.storeId || undefined
    } as SearchParams).subscribe({
      next: (res: any) => {
        this.templates = res?.result?.items || [];
      },
      error: () => this.showError('Failed to load templates')
    });
  }

  loadMessages(search?: string) {
    this.messageService.getMessagesPaged({ searchTerm: search, pageSize: 10 }).subscribe({
      next: (res: any) => {
        this.messages = res?.result?.items || [];
      },
      error: () => this.showError('Failed to load messages')
    });
  }

  loadLocationData(locationType: string) {
    if (locationType === 'PRODUCT') {
      this.loadProducts();
    } else if (locationType === 'SHELF') {
      this.loadShelves();
    }
  }

  loadProducts(search?: string) {
    this.productService.getProductsPaged({ searchTerm: search, pageSize: 10 }).subscribe({
      next: (res: any) => {
        this.products = res.items || [];
      }
    });
  }

  loadShelves(search?: string) {
    this.shelfService.getAllShelves(this.storeId || 2).subscribe({
      next: (res: any) => {
        this.shelves = res || [];
      }
    });
  }

  loadPriorities() {
    this.queueService.getPriorityTypes().subscribe({
      next: (res: any) => {
        this.priorityOptions = res.result || [];
      }
    });
  }

  onAssignmentSelect(assignment: any) {
    this.selectedAssignment = assignment;

    if (!assignment) return;

    // Auto-fill form from assignment
    this.queueForm.patchValue({
      deviceId: assignment.deviceId,
      templateId: assignment.templateId,
      messageId: assignment.messageId,
      locationType: assignment.locationType,
      locationId: assignment.locationId
    });
  }

  createQueue() {
    if (!this.queueForm.valid) {
      this.queueForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const formValue = this.queueForm.value;

    let request;
    if (formValue.sourceType === 'assignment') {
      request = {
        assignmentId: formValue.assignmentId?.id ?? formValue.assignmentId,
        startDate: formValue.startDate,
        endDate: formValue.endDate,
        priorityId: formValue.priorityId,
        displayOrder: formValue.displayOrder,
        isRecurring: formValue.isRecurring,
        recurrencePattern: formValue.recurrencePattern,
        userId: this.currentUserId
      };

      this.queueService.createQueueFromAssignment(request).subscribe({
        next: this.handleSuccess.bind(this),
        error: this.handleError.bind(this)
      });
    } else {
      const queueType: 'TEMPLATE_QUEUE' | 'MESSAGE_QUEUE' =
        this.isStandardBrand() ? 'MESSAGE_QUEUE' : 'TEMPLATE_QUEUE';

      request = {
        deviceId: formValue.deviceId,
        templateId: formValue.templateId,
        messageId: formValue.messageId,
        locationType: formValue.locationType,
        locationId: formValue.locationId,
        startDate: formValue.startDate,
        endDate: formValue.endDate,
        priorityId: formValue.priorityId,
        isRecurring: formValue.isRecurring,
        recurrencePattern: formValue.recurrencePattern,
        queueType,
        userId: this.currentUserId
      };

      this.queueService.createDirectQueue(request).subscribe({
        next: this.handleSuccess.bind(this),
        error: this.handleError.bind(this)
      });
    }
  }

  handleSuccess(res: any) {
    this.toastService.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Queue created successfully'
    });
    this.loading = false;
    setTimeout(() => {
      window.location.href = '#/queue';
    }, 1500);
  }

  handleError(err: any) {
    this.showError(err.error?.message || err.message || 'Failed to create queue');
    this.loading = false;
  }

  private showError(detail: string) {
    this.toastService.add({ severity: 'error', summary: 'Error', detail });
  }
}
