import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { MessageService } from 'primeng/api';

import { ImportsModule } from '../../../imports/imports';
import { RouterModule } from '@angular/router';
import {
  Product,
  ProductCategory,
  ProductSubCategory,
} from '../../../core/interfaces/product.interface';
import {
  LocalDeviceDto,
  LocalTemplateDto,
  EslBrandDto,
  DeviceTemplateComboDto,
  DeviceMessageComboDto,
} from '../../../core/interfaces/device.interface';
import { ProductService } from '../../../core/services/product.service';
import { DeviceService } from '../../../core/services/device.service';
import { CategoryService } from '../../../core/services/category.service';
import { SettingsService } from '../../../core/services/settings.service';
import { AuthService } from '../../../core/services/auth.service';
import { CustomMessageService } from '../../../core/services/message.service';
import { SearchParams } from '../../../core/interfaces/pagination-result.interface';
import { MessageWithUser } from '../../../core/interfaces/message.interface';

// A row represents one device. Minew devices can carry a Template binding, a
// Message binding, or both at once; Standard devices can only carry a Message
// binding (Standard has no template concept - templates are Minew-cloud
// designs). Each binding maps to its own DeviceAssignment record, so a row
// tracks the two possible assignment ids independently.
interface EslAssignmentFormValue {
  brandId: number | null;
  deviceId: number | null;
  templateId: string | null;
  messageId: number | null;
  deviceTemplateComboId: number | null;
  deviceMessageComboId: number | null;
  templateAssignmentId: number | null;
  messageAssignmentId: number | null;
  displayOrder: number;
  isActive: boolean;
  isDeleted: boolean;
}

@Component({
  selector: 'app-product-form-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImportsModule, RouterModule],
  templateUrl: './product-form-page.component.html',
  styleUrls: ['./product-form-page.component.css'],
})
export class ProductFormPageComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private productService = inject(ProductService);
  private deviceService = inject(DeviceService);
  private categoryService = inject(CategoryService);
  private settingsService = inject(SettingsService);
  private customMessageService = inject(CustomMessageService);
  private toast = inject(MessageService);

  public auth = inject(AuthService);

  loading = false;
  isEditMode = false;
  productId = 0;
  storeId = 0;
  currentUserId = 0;

  categoryOptions: ProductCategory[] = [];
  subCategoryOptions: ProductSubCategory[] = [];

  deviceOptions: Record<number, LocalDeviceDto[]> = {};
  templateOptions: Record<number, LocalTemplateDto[]> = {};
  messageOptions: Record<number, MessageWithUser[]> = {};

  categoryPagination = {
    pageNumber: 1,
    pageSize: 10,
    totalCount: 0,
    searchTerm: '',
    hasMore: true,
    loading: false,
  };

  subCategoryStore: Record<number, ProductSubCategory[]> = {};
  subCategoryPaginationStore: Record<number, any> = {};

  devicePagination: Record<number, any> = {};
  templatePagination: Record<number, any> = {};
  messagePagination: Record<number, any> = {};

  // 'existing' lets a row reuse an already-created DeviceTemplateCombos /
  // DeviceMessageCombos row instead of pairing a device+template/message from scratch.
  comboSourceMode: Record<number, 'new' | 'existing'> = {};
  existingCombos: Record<number, DeviceTemplateComboDto[]> = {};
  existingMessageCombos: Record<number, DeviceMessageComboDto[]> = {};
  // Confirms exactly which device+template/message an "existing combo" pick resolved to.
  existingComboPreview: Record<
    number,
    { device: string; binding: string } | null
  > = {};
  existingComboPagination: Record<number, any> = {};
  existingMessageComboPagination: Record<number, any> = {};

  // Per-row in-flight flag for the Minew bind actions.
  bindingRow: Record<number, boolean> = {};

  private subscriptions = new Subscription();

  eslBrandOptions: EslBrandDto[] = [];

  // Templates are Minew-cloud designs (MinewTemplates) - a Standard device has
  // no template concept, so the Template field is only shown for Minew rows.
  // Messages are brand-agnostic/local-only, so they're available either way.
  private isTemplateCapableBrand(brandId: number | null): boolean {
    if (!brandId) return true;
    const brand = this.eslBrandOptions.find((b) => b.id === brandId);
    return (brand?.code || '').toLowerCase() !== 'standard';
  }

  // Message pairing is available on the product form: a Minew row binds through
  // its device+template combo and may carry a message on top, which the bind
  // sends as the dynamic image. Template-only stays valid - the message is
  // optional for a template-capable brand and required only for 'standard'
  // brands, which have no template path.
  showDeviceMessageCombos = true;

  // Barcode is hidden for now. Nothing requires it: neither Create nor Update
  // ProductDto validates it, and Minew accepts an empty barcode on
  // goods/updateToStore (verified against the live cloud). The control stays in
  // the form, so the payload shape is unchanged and an existing product keeps
  // whatever barcode it already had. Flip to true to show the field again.
  showBarcodeField = false;

  brandSupportsTemplate(index: number): boolean {
    const brandId = this.eslAssignments.at(index)?.get('brandId')?.value;
    return this.isTemplateCapableBrand(brandId);
  }

  // Binding pushes data to the physical label via the Minew cloud, so it only
  // applies to a row whose brand is explicitly Minew (unlike
  // brandSupportsTemplate, which defaults to true before a brand is picked).
  isMinewRow(index: number): boolean {
    const brandId = this.eslAssignments.at(index)?.get('brandId')?.value;
    if (!brandId) return false;
    const brand = this.eslBrandOptions.find((b) => b.id === brandId);
    return (brand?.code || '').toLowerCase() === 'minew';
  }

  // bind-unified addresses the label through its DeviceTemplateCombos id, which
  // only exists once the assignment has been persisted - so an unsaved row has
  // nothing to bind against yet.
  canBindRow(index: number): boolean {
    if (!this.isMinewRow(index)) return false;
    if (!this.productId) return false;
    const group = this.eslAssignments.at(index);
    return (
      !!group?.get('deviceTemplateComboId')?.value && !this.bindingRow[index]
    );
  }

  bindDisabledReason(index: number): string {
    if (!this.productId) return 'Save the product before binding';
    const group = this.eslAssignments.at(index);
    if (!group?.get('deviceTemplateComboId')?.value)
      return 'Save the product to create the device + template combo first';
    return '';
  }

  private async bindRow(index: number, includeMessage: boolean): Promise<void> {
    const group = this.eslAssignments.at(index);
    const comboId = group?.get('deviceTemplateComboId')?.value;
    if (!comboId) return;

    const messageId = includeMessage ? group?.get('messageId')?.value || 0 : 0;

    if (includeMessage && !messageId) {
      this.showError('This row has no message to bind');
      return;
    }

    this.bindingRow[index] = true;

    try {
      await firstValueFrom(
        this.deviceService.bindDataUnified({
          comboId,
          // This row always binds through its device+template combo.
          comboType: 'TEMPLATE',
          bindingType: 'product',
          productId: this.productId,
          messageId,
          color: 1,
          total: 5,
          period: 500,
          interval: 900,
          brightness: 100,
        }),
      );

      this.toast.add({
        severity: 'success',
        summary: 'Bound',
        detail: includeMessage
          ? 'Product data and message bound to device'
          : 'Product data bound to device (no message)',
      });
    } catch (error: any) {
      const detail =
        typeof error === 'string' ? error : error?.message || 'Unknown error';
      this.showError('Failed to bind: ' + detail);
    } finally {
      this.bindingRow[index] = false;
    }
  }

  quickBindRow(index: number): Promise<void> {
    return this.bindRow(index, false);
  }

  bindRowWithMessage(index: number): Promise<void> {
    return this.bindRow(index, true);
  }

  unitOfMeasureOptions = [
    { label: 'Each', value: 'EA' },
    { label: 'Piece', value: 'PC' },
    { label: 'Pack', value: 'PK' },
    { label: 'Box', value: 'BX' },
    { label: 'Kilogram', value: 'KG' },
    { label: 'Gram', value: 'G' },
    { label: 'Liter', value: 'L' },
    { label: 'Unit', value: 'UNIT' },
  ];

  form = this.fb.group({
    product: this.fb.group({
      id: [0],
      productCode: [''],
      // Kept in the form even while the field is hidden, so create/edit keep
      // sending barCode and an existing product's value survives a save.
      barCode: [''],
      productName: ['', Validators.required],
      quantity: [0],
      reorderPoint: [0],
      unitOfMeasure: ['EA'],
      categoryId: [null as number | null, Validators.required],
      subCategoryId: [null as number | null],
      costPrice: [0],
      sellingPrice: [0, [Validators.required, Validators.min(0)]],
      discountPrice: [0],
      discountedPrice: [0],
      discountPercentage: [0],
      wholesalePrice: [0],
      minimumPrice: [0],
      maximumPrice: [0],
      description: [''],
      isActive: [true],
      storeId: [null as number | null],
      createdUser: [0],
      updatedUser: [0],
    }),
    eslAssignments: this.fb.array<FormGroup>([]),
  });

  get productGroup(): FormGroup {
    return this.form.get('product') as FormGroup;
  }

  get eslAssignments(): FormArray<FormGroup> {
    return this.form.get('eslAssignments') as FormArray<FormGroup>;
  }

  get visibleAssignments(): FormGroup[] {
    return this.eslAssignments.controls.filter(
      (x) => !x.get('isDeleted')?.value,
    );
  }

  ngOnInit(): void {
    this.initCurrentUser();
    this.setDefaultStore();

    this.productId = Number(this.route.snapshot.paramMap.get('id') || 0);
    this.isEditMode = this.productId > 0;

    this.productGroup.patchValue({
      storeId: this.storeId,
      createdUser: this.currentUserId,
      updatedUser: this.currentUserId,
    });

    this.loadInitialCategories();

    // Brands must be loaded before existing assignments so a device's brand
    // can be resolved from its deviceType when reconstructing rows.
    this.loadBrands().then(() => {
      if (this.isEditMode) {
        this.loadProduct();
      }
      // No default empty ESL row - ESL assignment is optional, user adds one via "Add ESL".
    });

    if (!this.canEdit()) {
      this.form.disable();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initCurrentUser(): void {
    const user = this.auth.getCurrentUserValue();
    this.currentUserId = user?.id || 0;
  }

  private setDefaultStore(): void {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    this.storeId = currentStore?.id || 0;
  }

  canEdit(): boolean {
    return this.auth.hasAnyRole(['Admin', 'Manager', 'Operator']);
  }

  // Recalculate discount amount + final price from the entered percentage.
  onDiscountPercentageChange(): void {
    const sellingPrice = this.productGroup.get('sellingPrice')?.value || 0;
    const discountPercentage =
      this.productGroup.get('discountPercentage')?.value || 0;

    if (discountPercentage > 0) {
      const discountAmount = (sellingPrice * discountPercentage) / 100;
      this.productGroup.patchValue(
        {
          discountPrice: discountAmount,
          discountedPrice: Math.max(0, sellingPrice - discountAmount),
        },
        { emitEvent: false },
      );
    } else {
      this.productGroup.patchValue(
        {
          discountPrice: 0,
          discountedPrice: sellingPrice,
        },
        { emitEvent: false },
      );
    }
  }

  // Recalculate discount percentage + final price from the entered amount.
  onDiscountPriceChange(): void {
    const sellingPrice = this.productGroup.get('sellingPrice')?.value || 0;
    const discountPrice = this.productGroup.get('discountPrice')?.value || 0;

    if (sellingPrice > 0 && discountPrice > 0) {
      this.productGroup.patchValue(
        {
          discountPercentage: (discountPrice / sellingPrice) * 100,
          discountedPrice: Math.max(0, sellingPrice - discountPrice),
        },
        { emitEvent: false },
      );
    } else {
      this.productGroup.patchValue(
        {
          discountPercentage: 0,
          discountedPrice: sellingPrice,
        },
        { emitEvent: false },
      );
    }
  }

  // Keep the discount amount/final price in sync when selling price changes.
  onSellingPriceChange(): void {
    const discountPercentage =
      this.productGroup.get('discountPercentage')?.value || 0;

    if (discountPercentage > 0) {
      this.onDiscountPercentageChange();
    } else {
      this.onDiscountPriceChange();
    }
  }

  private async loadProduct(): Promise<void> {
    this.loading = true;

    try {
      // Use your actual get-by-id method name here.
      const response: any = await firstValueFrom(
        this.productService.getProductById(this.productId, this.storeId),
      );

      const product: Product = response?.result || response;

      this.productGroup.patchValue({
        id: product.id,
        productCode: product.productCode || '',
        barCode: product.barCode || '',
        productName: product.productName || '',
        quantity: product.quantity || 0,
        unitOfMeasure: product.unitOfMeasure || 'EA',
        categoryId: product.categoryId || null,
        subCategoryId: product.subCategoryId || null,
        costPrice: product.costPrice || 0,
        sellingPrice: product.sellingPrice || 0,
        // discountPrice comes back from the backend holding the final discounted
        // price (see save()), so re-derive the amount-off for the UI from
        // sellingPrice - discountedPrice rather than trusting it directly.
        discountPrice: Math.max(
          0,
          (product.sellingPrice || 0) - (product.discountedPrice || 0),
        ),
        discountedPrice: product.discountedPrice || 0,
        discountPercentage: product.discountPercentage || 0,
        wholesalePrice: product.wholesalePrice || 0,
        minimumPrice: product.minimumPrice || 0,
        maximumPrice: product.maximumPrice || 0,
        description: product.description || '',
        isActive: product.isActive !== false,
        storeId: product.storeId || this.storeId,
        updatedUser: this.currentUserId,
      });

      if (product.categoryId) {
        this.ensureCategoryInOptions(product.categoryId);
        this.loadSubCategoriesByCategory(product.categoryId, true);
      }

      await this.loadExistingAssignments();
      // No default empty ESL row when the product has no existing assignments -
      // ESL assignment is optional, user adds one via "Add ESL".
    } catch (error) {
      console.error(error);
      this.showError('Failed to load product');
    } finally {
      this.loading = false;
    }
  }

  private async loadExistingAssignments(): Promise<void> {
    const params: SearchParams = {
      pageNumber: 1,
      pageSize: 100,
      locationType: 'Product',
      locationId: this.productId,
      storeId: this.storeId,
    };

    const response: any = await firstValueFrom(
      this.deviceService.getAssignmentsPaged(params),
    );

    const items = response?.items || response?.result?.items || [];

    // Merge TEMPLATE and MESSAGE assignments for the same device into one row.
    const byDevice = new Map<number, EslAssignmentFormValue>();

    items.forEach((a: any) => {
      const deviceId = a.deviceId;
      if (!deviceId) return;

      if (!byDevice.has(deviceId)) {
        byDevice.set(deviceId, {
          brandId: null,
          deviceId,
          templateId: null,
          messageId: null,
          deviceTemplateComboId: null,
          deviceMessageComboId: null,
          templateAssignmentId: null,
          messageAssignmentId: null,
          displayOrder: a.displayOrder || 1,
          isActive: true,
          isDeleted: false,
        });
      }

      const merged = byDevice.get(deviceId)!;

      if (a.assignmentType === 'MESSAGE') {
        merged.messageId = a.messageId || null;
        merged.deviceMessageComboId = a.deviceMessageComboId || null;
        merged.messageAssignmentId = a.id || a.assignmentId || null;
      } else {
        merged.templateId = a.templateId || null;
        merged.deviceTemplateComboId = a.deviceTemplateComboId || null;
        merged.templateAssignmentId = a.id || a.assignmentId || null;
      }

      merged.displayOrder = a.displayOrder || merged.displayOrder;
      merged.isActive = merged.isActive && a.isActive !== false;
    });

    Array.from(byDevice.values()).forEach((merged, index) => {
      merged.displayOrder = merged.displayOrder || index + 1;

      const group = this.createEslAssignmentGroup(merged);

      this.eslAssignments.push(group);
      const rowIndex = this.eslAssignments.length - 1;

      this.initializeAssignmentDropdowns(rowIndex);

      if (merged.deviceId) {
        this.ensureDeviceInOptions(rowIndex, merged.deviceId);
      }

      if (merged.templateId) {
        this.ensureTemplateInOptions(rowIndex, merged.templateId);
      }

      if (merged.messageId) {
        this.ensureMessageInOptions(rowIndex, merged.messageId);
      }
    });
  }

  addEslAssignment(): void {
    const group = this.createEslAssignmentGroup({
      brandId: null,
      deviceId: null,
      templateId: null,
      messageId: null,
      deviceTemplateComboId: null,
      deviceMessageComboId: null,
      templateAssignmentId: null,
      messageAssignmentId: null,
      displayOrder: this.visibleAssignments.length + 1,
      isActive: true,
      isDeleted: false,
    });

    this.eslAssignments.push(group);
    this.initializeAssignmentDropdowns(this.eslAssignments.length - 1);
  }

  private atLeastOneBindingValidator(
    group: AbstractControl,
  ): ValidationErrors | null {
    const templateId = group.get('templateId')?.value;
    const messageId = group.get('messageId')?.value;
    return templateId || messageId ? null : { noBinding: true };
  }

  private createEslAssignmentGroup(value: EslAssignmentFormValue): FormGroup {
    const group = this.fb.group(
      {
        brandId: [value.brandId, Validators.required],
        deviceId: [value.deviceId, Validators.required],
        templateId: [value.templateId],
        messageId: [value.messageId],
        deviceTemplateComboId: [value.deviceTemplateComboId],
        deviceMessageComboId: [value.deviceMessageComboId],
        templateAssignmentId: [value.templateAssignmentId],
        messageAssignmentId: [value.messageAssignmentId],
        displayOrder: [
          value.displayOrder,
          [Validators.required, Validators.min(1)],
        ],
        isActive: [value.isActive],
        isDeleted: [value.isDeleted],
      },
      { validators: this.atLeastOneBindingValidator },
    );

    return group;
  }

  hasNoBindingError(index: number): boolean {
    const group = this.eslAssignments.at(index);
    return !!group && group.touched && !!group.errors?.['noBinding'];
  }

  removeAssignment(index: number): void {
    const group = this.eslAssignments.at(index);

    if (!group) return;

    const hasExisting =
      group.get('templateAssignmentId')?.value ||
      group.get('messageAssignmentId')?.value;

    if (hasExisting) {
      group.patchValue({ isDeleted: true });
    } else {
      this.eslAssignments.removeAt(index);
    }

    this.reorderAssignments();
  }

  private reorderAssignments(): void {
    this.visibleAssignments.forEach((group, index) => {
      group.patchValue({ displayOrder: index + 1 }, { emitEvent: false });
    });
  }

  onBrandChange(index: number): void {
    const group = this.eslAssignments.at(index);
    group.patchValue({
      deviceId: null,
      templateId: null,
      messageId: null,
      deviceTemplateComboId: null,
      deviceMessageComboId: null,
    });

    this.deviceOptions[index] = [];
    this.existingCombos[index] = [];
    this.existingMessageCombos[index] = [];
    this.existingComboPreview[index] = null;

    if (this.comboSourceMode[index] === 'existing') {
      if (this.brandSupportsTemplate(index)) {
        this.loadExistingCombosForAssignment(index);
      } else {
        this.loadExistingMessageCombosForAssignment(index);
      }
    } else {
      this.loadDevicesForAssignment(index);
    }
  }

  // The Device dropdown only appears in "New Pairing" mode - changing it
  // invalidates whatever template/message was picked for the previous device.
  onDeviceChange(index: number): void {
    const group = this.eslAssignments.at(index);
    group.patchValue({
      templateId: null,
      messageId: null,
    });
  }

  private initializeAssignmentDropdowns(index: number): void {
    this.devicePagination[index] = {
      pageNumber: 1,
      pageSize: 10,
      totalCount: 0,
      searchTerm: '',
      hasMore: true,
      loading: false,
    };

    this.templatePagination[index] = {
      pageNumber: 1,
      pageSize: 10,
      totalCount: 0,
      searchTerm: '',
      hasMore: true,
      loading: false,
    };

    this.messagePagination[index] = {
      pageNumber: 1,
      pageSize: 10,
      totalCount: 0,
      searchTerm: '',
      hasMore: true,
      loading: false,
    };

    this.deviceOptions[index] = [];
    this.templateOptions[index] = [];
    this.messageOptions[index] = [];

    this.comboSourceMode[index] = 'new';
    this.existingCombos[index] = [];
    this.existingMessageCombos[index] = [];
    this.existingComboPreview[index] = null;
    this.existingComboPagination[index] = {
      pageNumber: 1,
      pageSize: 10,
      totalCount: 0,
      searchTerm: '',
      hasMore: true,
      loading: false,
    };
    this.existingMessageComboPagination[index] = {
      pageNumber: 1,
      pageSize: 10,
      totalCount: 0,
      searchTerm: '',
      hasMore: true,
      loading: false,
    };

    // Device (and template) options depend on the selected ESL Brand's
    // DeviceType - don't fetch an unfiltered list before a brand is chosen.
    // onBrandChange() loads them once the user picks a brand; for existing
    // rows, ensureDeviceInOptions() triggers the filtered load once the
    // brand is resolved from the assigned device's DeviceType.
    this.loadTemplatesForAssignment(index);
    this.loadMessagesForAssignment(index);
  }

  toggleComboSourceMode(index: number, mode: 'new' | 'existing'): void {
    if (this.comboSourceMode[index] === mode) return;

    this.comboSourceMode[index] = mode;

    const group = this.eslAssignments.at(index);
    group.patchValue({
      deviceId: null,
      templateId: null,
      messageId: null,
      deviceTemplateComboId: null,
      deviceMessageComboId: null,
    });

    this.existingComboPreview[index] = null;

    if (mode === 'existing') {
      // Minew reuses a Device+Template combo; Standard has no template
      // concept and reuses a Device+Message combo instead. Picking a combo
      // resolves its own device, so there's no separate device picker here.
      if (this.brandSupportsTemplate(index)) {
        this.loadExistingCombosForAssignment(index);
      } else {
        this.loadExistingMessageCombosForAssignment(index);
      }
    }
  }

  loadExistingCombosForAssignment(index: number, append = false): void {
    const pagination = this.existingComboPagination[index];
    if (!pagination || pagination.loading) return;

    pagination.loading = true;

    this.deviceService
      .getCombosPaged({
        pageNumber: pagination.pageNumber,
        pageSize: pagination.pageSize,
        searchTerm: pagination.searchTerm,
      })
      .subscribe({
        next: (response) => {
          const result = response?.result;
          const newItems = result?.items || [];

          this.existingCombos[index] = append
            ? [...(this.existingCombos[index] || []), ...newItems]
            : newItems;

          pagination.totalCount = result?.totalCount || 0;
          pagination.hasMore =
            this.existingCombos[index].length < pagination.totalCount;
          pagination.loading = false;
        },
        error: () => {
          pagination.loading = false;
          this.showError('Failed to load existing device+template combos');
        },
      });
  }

  loadExistingMessageCombosForAssignment(index: number, append = false): void {
    const pagination = this.existingMessageComboPagination[index];
    if (!pagination || pagination.loading) return;

    pagination.loading = true;

    this.deviceService
      .getDeviceMessageCombosPagedByParams({
        pageNumber: pagination.pageNumber,
        pageSize: pagination.pageSize,
        searchTerm: pagination.searchTerm,
        isActive: true,
      })
      .subscribe({
        next: (result) => {
          const newItems = result?.items || [];

          this.existingMessageCombos[index] = append
            ? [...(this.existingMessageCombos[index] || []), ...newItems]
            : newItems;

          pagination.totalCount = result?.totalCount || 0;
          pagination.hasMore =
            this.existingMessageCombos[index].length < pagination.totalCount;
          pagination.loading = false;
        },
        error: () => {
          pagination.loading = false;
          this.showError('Failed to load existing device+message combos');
        },
      });
  }

  onExistingComboFilter(index: number, event: any): void {
    const pagination = this.existingComboPagination[index];
    pagination.searchTerm = event.filter || '';
    pagination.pageNumber = 1;
    this.loadExistingCombosForAssignment(index);
  }

  onExistingMessageComboFilter(index: number, event: any): void {
    const pagination = this.existingMessageComboPagination[index];
    pagination.searchTerm = event.filter || '';
    pagination.pageNumber = 1;
    this.loadExistingMessageCombosForAssignment(index);
  }

  onExistingComboSelected(index: number): void {
    const group = this.eslAssignments.at(index);
    const comboId = group.get('deviceTemplateComboId')?.value;
    const combo = this.existingCombos[index]?.find((c) => c.id === comboId);

    if (!combo) {
      this.existingComboPreview[index] = null;
      group.patchValue({ templateId: null });
      return;
    }

    group.patchValue({
      deviceId: Number(combo.deviceId),
      templateId: combo.templateId,
    });
    this.existingComboPreview[index] = {
      device: combo.deviceName,
      binding: combo.templateName,
    };
  }

  onExistingMessageComboSelected(index: number): void {
    const group = this.eslAssignments.at(index);
    const comboId = group.get('deviceMessageComboId')?.value;
    const combo = this.existingMessageCombos[index]?.find(
      (c) => c.id === comboId,
    );

    if (!combo) {
      this.existingComboPreview[index] = null;
      group.patchValue({ messageId: null });
      return;
    }

    group.patchValue({
      deviceId: combo.deviceId,
      messageId: combo.messageId,
    });
    this.existingComboPreview[index] = {
      device: combo.deviceName || 'Unknown device',
      binding: combo.messageTitle || 'Unknown message',
    };
  }

  loadDevicesForAssignment(index: number, append = false): void {
    const pagination = this.devicePagination[index];
    if (!pagination || pagination.loading) return;

    pagination.loading = true;

    const brandId = this.eslAssignments.at(index)?.get('brandId')?.value;

    const request: SearchParams = {
      pageNumber: pagination.pageNumber,
      pageSize: pagination.pageSize,
      searchTerm: pagination.searchTerm,
      storeId: this.storeId,
      brandId: brandId || undefined,
    } as any;

    this.deviceService.getLocalDevicesPaged(request).subscribe({
      next: (response: any) => {
        const result = response?.result || response;
        const newItems = result?.items || [];

        this.deviceOptions[index] = append
          ? [...(this.deviceOptions[index] || []), ...newItems]
          : this.keepSelectedOption(
              this.deviceOptions[index],
              newItems,
              this.eslAssignments.at(index)?.get('deviceId')?.value,
              (d: any) => d.id,
            );

        pagination.totalCount = result?.totalCount || 0;
        pagination.hasMore =
          result?.hasNextPage ??
          this.deviceOptions[index].length < pagination.totalCount;
        pagination.loading = false;
      },
      error: () => {
        pagination.loading = false;
        this.showError('Failed to load devices');
      },
    });
  }

  /**
   * A fresh (non-appended) page replaces the whole option list. When editing,
   * the selected item is often not on page 1 - it was injected separately by
   * ensureDeviceInOptions/ensureTemplateInOptions/ensureMessageInOptions, which
   * race with this load. Whichever resolved first would otherwise be dropped,
   * leaving the dropdown showing its placeholder instead of the saved value.
   */
  private keepSelectedOption<T>(
    previous: T[] | undefined,
    incoming: T[],
    selectedValue: unknown,
    idOf: (item: T) => unknown,
  ): T[] {
    if (selectedValue === null || selectedValue === undefined) return incoming;
    if (incoming.some((item) => idOf(item) === selectedValue)) return incoming;

    const carried = (previous || []).find(
      (item) => idOf(item) === selectedValue,
    );
    return carried ? [carried, ...incoming] : incoming;
  }

  loadTemplatesForAssignment(index: number, append = false): void {
    const pagination = this.templatePagination[index];
    if (!pagination || pagination.loading) return;

    pagination.loading = true;

    const brandId = this.eslAssignments.at(index)?.get('brandId')?.value;
    const deviceId = this.eslAssignments.at(index)?.get('deviceId')?.value;

    const request: SearchParams = {
      pageNumber: pagination.pageNumber,
      pageSize: pagination.pageSize,
      searchTerm: pagination.searchTerm,
      storeId: this.storeId,
      brandId: brandId || undefined,
      deviceId: deviceId || undefined,
    } as any;

    this.deviceService.getLocalTemplatesPaged(request).subscribe({
      next: (response: any) => {
        const result = response?.result || response;
        const newItems = result?.items || [];

        this.templateOptions[index] = append
          ? [...(this.templateOptions[index] || []), ...newItems]
          : this.keepSelectedOption(
              this.templateOptions[index],
              newItems,
              this.eslAssignments.at(index)?.get('templateId')?.value,
              (t: any) => t.id,
            );

        pagination.totalCount = result?.totalCount || 0;
        pagination.hasMore =
          result?.hasNextPage ??
          this.templateOptions[index].length < pagination.totalCount;
        pagination.loading = false;
      },
      error: () => {
        pagination.loading = false;
        this.showError('Failed to load templates');
      },
    });
  }

  loadMessagesForAssignment(index: number, append = false): void {
    const pagination = this.messagePagination[index];
    if (!pagination || pagination.loading) return;

    pagination.loading = true;

    const request: SearchParams = {
      pageNumber: pagination.pageNumber,
      pageSize: pagination.pageSize,
      searchTerm: pagination.searchTerm,
      storeId: this.storeId,
    };

    this.customMessageService.getMessagesPaged(request).subscribe({
      next: (response: any) => {
        const result = response?.result || response;
        const newItems = result?.items || [];

        this.messageOptions[index] = append
          ? [...(this.messageOptions[index] || []), ...newItems]
          : this.keepSelectedOption(
              this.messageOptions[index],
              newItems,
              this.eslAssignments.at(index)?.get('messageId')?.value,
              (m: any) => m.id,
            );

        pagination.totalCount = result?.totalCount || 0;
        pagination.hasMore =
          this.messageOptions[index].length < pagination.totalCount;
        pagination.loading = false;
      },
      error: () => {
        pagination.loading = false;
        this.showError('Failed to load messages');
      },
    });
  }

  onDeviceFilter(index: number, event: any): void {
    const pagination = this.devicePagination[index];
    pagination.searchTerm = event.filter || '';
    pagination.pageNumber = 1;
    this.loadDevicesForAssignment(index);
  }

  onTemplateFilter(index: number, event: any): void {
    const pagination = this.templatePagination[index];
    pagination.searchTerm = event.filter || '';
    pagination.pageNumber = 1;
    this.loadTemplatesForAssignment(index);
  }

  onMessageFilter(index: number, event: any): void {
    const pagination = this.messagePagination[index];
    pagination.searchTerm = event.filter || '';
    pagination.pageNumber = 1;
    this.loadMessagesForAssignment(index);
  }

  private applyBrandFromDeviceType(index: number, deviceType: string): void {
    const group = this.eslAssignments.at(index);
    if (!group || group.get('brandId')?.value) return;

    const brand = this.eslBrandOptions.find(
      (b) => b.code?.toLowerCase() === (deviceType || '').toLowerCase(),
    );
    if (brand) {
      group.patchValue({ brandId: brand.id }, { emitEvent: false });
      this.loadDevicesForAssignment(index);
    }
  }

  private ensureDeviceInOptions(index: number, deviceId: number): void {
    if (!deviceId) return;

    const existing = this.deviceOptions[index]?.find((x) => x.id === deviceId);
    if (existing) {
      this.applyBrandFromDeviceType(index, existing.deviceType);
      return;
    }

    this.deviceService.getDeviceById(deviceId).subscribe((device: any) => {
      if (device) {
        this.deviceOptions[index] = [
          device,
          ...(this.deviceOptions[index] || []),
        ];
        this.applyBrandFromDeviceType(index, device.deviceType);
      }
    });
  }

  private ensureTemplateInOptions(index: number, templateId: string): void {
    if (!templateId) return;

    const exists = this.templateOptions[index]?.some(
      (x) => x.id === templateId,
    );
    if (exists) return;

    this.deviceService
      .getTemplateById(templateId)
      .subscribe((template: any) => {
        if (template) {
          this.templateOptions[index] = [
            template,
            ...(this.templateOptions[index] || []),
          ];
        }
      });
  }

  private ensureMessageInOptions(index: number, messageId: number): void {
    if (!messageId) return;

    const exists = this.messageOptions[index]?.some((x) => x.id === messageId);
    if (exists) return;

    this.customMessageService
      .getMessageById(messageId, this.storeId)
      .subscribe((message: any) => {
        if (message) {
          this.messageOptions[index] = [
            message,
            ...(this.messageOptions[index] || []),
          ];
        }
      });
  }

  loadBrands(): Promise<void> {
    return firstValueFrom(this.deviceService.getBrands())
      .then((brands) => {
        this.eslBrandOptions = brands;
      })
      .catch(() => {
        this.showError('Failed to load ESL brands');
      });
  }

  loadInitialCategories(): void {
    this.categoryPagination.loading = true;

    const params: SearchParams = {
      pageNumber: 1,
      pageSize: 10,
      storeId: this.storeId,
      searchTerm: this.categoryPagination.searchTerm,
    };

    this.categoryService.getCategoriesPaged(params).subscribe({
      next: (response: any) => {
        this.categoryOptions = response.items || response?.result?.items || [];
        this.categoryPagination.totalCount =
          response.totalCount || response?.result?.totalCount || 0;
        this.categoryPagination.hasMore =
          this.categoryOptions.length < this.categoryPagination.totalCount;
        this.categoryPagination.loading = false;
      },
      error: () => {
        this.categoryPagination.loading = false;
        this.showError('Failed to load categories');
      },
    });
  }

  onCategoryChange(event: any): void {
    const categoryId = event.value;

    this.productGroup.patchValue({
      subCategoryId: null,
    });

    this.subCategoryOptions = [];

    if (categoryId) {
      this.loadSubCategoriesByCategory(categoryId, true);
    }
  }

  onCategoryFilter(event: any): void {
    this.categoryPagination.searchTerm = event.filter || '';
    this.categoryPagination.pageNumber = 1;
    this.loadInitialCategories();
  }

  private loadSubCategoriesByCategory(categoryId: number, reset = true): void {
    if (!categoryId) {
      this.subCategoryOptions = [];
      return;
    }

    if (!this.subCategoryStore[categoryId]) {
      this.subCategoryStore[categoryId] = [];
      this.subCategoryPaginationStore[categoryId] = {
        pageNumber: 1,
        pageSize: 10,
        totalCount: 0,
        searchTerm: '',
        hasMore: true,
        loading: false,
      };
    }

    const pagination = this.subCategoryPaginationStore[categoryId];

    if (reset) {
      pagination.pageNumber = 1;
      this.subCategoryStore[categoryId] = [];
    }

    pagination.loading = true;

    const params: SearchParams = {
      pageNumber: pagination.pageNumber,
      pageSize: pagination.pageSize,
      categoryId,
      storeId: this.storeId,
      searchTerm: pagination.searchTerm,
    };

    this.categoryService.getSubCategoriesPaged(params).subscribe({
      next: (response: any) => {
        const items = response.items || response?.result?.items || [];

        this.subCategoryStore[categoryId] = reset
          ? items
          : [...this.subCategoryStore[categoryId], ...items];

        this.subCategoryOptions = this.subCategoryStore[categoryId];

        pagination.totalCount =
          response.totalCount || response?.result?.totalCount || 0;
        pagination.hasMore =
          this.subCategoryOptions.length < pagination.totalCount;
        pagination.loading = false;
      },
      error: () => {
        pagination.loading = false;
        this.showError('Failed to load subcategories');
      },
    });
  }

  onSubCategoryFilter(event: any): void {
    const categoryId = this.productGroup.get('categoryId')?.value;
    if (!categoryId) return;

    const pagination = this.subCategoryPaginationStore[categoryId];
    pagination.searchTerm = event.filter || '';
    pagination.pageNumber = 1;

    this.loadSubCategoriesByCategory(categoryId, true);
  }

  private ensureCategoryInOptions(categoryId: number): void {
    if (!categoryId) return;

    const exists = this.categoryOptions.some((x) => x.id === categoryId);
    if (exists) return;

    this.categoryService
      .getCategoryById(categoryId, this.storeId)
      .subscribe((response: any) => {
        const category = response?.result || response;
        if (category) {
          this.categoryOptions = [category, ...this.categoryOptions];
        }
      });
  }

  /** Friendly names for the controls that are actually blocking a save. */
  private describeInvalidControls(): string[] {
    const labels: Record<string, string> = {
      productName: 'Product Name',
      categoryId: 'Category',
      sellingPrice: 'Selling Price',
      brandId: 'ESL Brand',
      deviceId: 'Device',
      displayOrder: 'Display Order',
    };

    const missing: string[] = [];

    Object.keys(this.productGroup.controls).forEach((key) => {
      if (this.productGroup.get(key)?.invalid) {
        missing.push(labels[key] ?? key);
      }
    });

    this.eslAssignments.controls.forEach((group, index) => {
      if (group.get('isDeleted')?.value || group.valid) return;

      const row = `ESL row ${index + 1}`;
      Object.keys(group.controls).forEach((key) => {
        if (group.get(key)?.invalid) {
          missing.push(`${row}: ${labels[key] ?? key}`);
        }
      });

      // Group-level rule - neither a template nor a message was chosen.
      if (group.errors?.['noBinding']) {
        missing.push(`${row}: Template or Message`);
      }
    });

    return missing;
  }

  save(): void {
    if (!this.canEdit()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Naming the offenders matters here: markAllAsTouched lights up every
      // invalid control across both tabs, so a single missing field looked like
      // "everything is required" with no way to tell what was actually blocking.
      const missing = this.describeInvalidControls();
      this.showError(
        missing.length
          ? `Please complete: ${missing.join(', ')}`
          : 'Please fill required fields',
      );
      return;
    }

    this.loading = true;

    const raw = this.form.getRawValue();

    const payload = {
      product: {
        ...raw.product,
        // Minew reads the "discount" field from DiscountPrice and expects it to hold
        // the final discounted price (not the amount off) - can't rename that field
        // on the Minew side right now, so we send discountedPrice under discountPrice.
        discountPrice: raw.product.discountedPrice,
        categoryName: '',
        subCategoryName: '',
        createdUser: this.currentUserId,
        updatedUser: this.currentUserId,
        storeId: this.storeId,
      },
      eslAssignments: raw.eslAssignments,
      userId: this.currentUserId,
    };

    const request$ = this.isEditMode
      ? this.productService.updateProductWithEsl(this.productId, payload)
      : this.productService.createProductWithEsl(payload);

    request$.subscribe({
      next: () => {
        this.loading = false;
        this.toast.add({
          severity: 'success',
          summary: 'Saved',
          detail: 'Product saved successfully',
        });
        this.router.navigate(['/product-management'], {
          queryParams: { tab: 'products' },
        });
      },
      error: (error: any) => {
        console.error(error);
        this.loading = false;
        this.showError(
          error?.message || 'Failed to save product - no changes were made',
        );
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/product-management'], {
      queryParams: { tab: 'products' },
    });
  }

  isInvalid(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  getBrandName(id: number | null): string {
    return this.eslBrandOptions.find((x) => x.id === id)?.name || 'No Brand';
  }

  getRowBindingLabel(group: AbstractControl): string {
    const hasTemplate = !!group.get('templateId')?.value;
    const hasMessage = !!group.get('messageId')?.value;

    if (hasTemplate && hasMessage) return 'Template + Message';
    if (hasTemplate) return 'Template';
    if (hasMessage) return 'Message';
    return 'No binding selected yet';
  }

  private showError(message: string): void {
    this.toast.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
    });
  }
}
