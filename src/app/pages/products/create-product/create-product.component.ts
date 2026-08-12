import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import {
  DeviceTemplateComboDto,
  LocalDeviceDto,
  LocalTemplateDto,
} from '../../../core/interfaces/device.interface';
import {
  SearchParams,
  PagedResult,
} from '../../../core/interfaces/pagination-result.interface';
import {
  ProductCategory,
  ProductSubCategory,
} from '../../../core/interfaces/product.interface';
import { CategoryService } from '../../../core/services/category.service';
import { DeviceService } from '../../../core/services/device.service';
import { ProductService } from '../../../core/services/product.service';
import {
  DialogService,
  DynamicDialogRef,
  DynamicDialogConfig,
} from 'primeng/dynamicdialog';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextarea } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
// import { VirtualScrollerModule } from 'primeng/virtualscroller';

@Component({
  selector: 'app-create-product',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    InputTextModule,
    InputNumberModule,
    ButtonModule,
    CheckboxModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './create-product.component.html',
  styleUrl: './create-product.component.css',
})
export class CreateProductComponent implements OnInit {
  // Basic Information
  productName: string = '';
  barcode: string = '';
  productCode: string = '';
  description: string = '';
  selectedCategory: ProductCategory | null = null;
  selectedSubcategory: ProductSubCategory | null = null;

  // Device & Template Configuration
  useExistingCombos: boolean = true;
  existingCombos: DeviceTemplateComboDto[] = [];
  selectedExistingCombo: DeviceTemplateComboDto | null = null;

  // Device Assignments
  deviceAssignments: any[] = [];

  // Pricing Information
  sellingPrice: number = 0;
  discountPrice: number = 0;
  wholesalePrice: number = 0;
  minPrice: number = 0;
  maxPrice: number = 0;

  // Status
  isActive: boolean = true;

  // Lazy loading states
  loadingCategories: boolean = false;
  loadingSubcategories: boolean = false;
  loadingDevices: boolean = false;
  loadingTemplates: boolean = false;
  loadingCombos: boolean = false;

  // Paged data
  categories: ProductCategory[] = [];
  subcategories: ProductSubCategory[] = [];
  devices: LocalDeviceDto[] = [];
  templates: LocalTemplateDto[] = [];

  // Pagination
  categorySearchParams: SearchParams = { pageNumber: 1, pageSize: 10 };
  subcategorySearchParams: SearchParams = { pageNumber: 1, pageSize: 10 };
  deviceSearchParams: SearchParams = { pageNumber: 1, pageSize: 10 };
  templateSearchParams: SearchParams = { pageNumber: 1, pageSize: 10 };

  // Totals
  totalCategories: number = 0;
  totalSubcategories: number = 0;
  totalDevices: number = 0;
  totalTemplates: number = 0;

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig,
    private productService: ProductService,
    private categoryService: CategoryService,
    private deviceService: DeviceService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.loadExistingCombos();
    this.loadCategories();
  }

  loadExistingCombos(): void {
    this.loadingCombos = true;
    this.deviceService.getDeviceTemplateCombos().subscribe({
      next: (combos) => {
        this.existingCombos = combos;
        this.loadingCombos = false;
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load device template combos',
        });
        this.loadingCombos = false;
      },
    });
  }

  loadCategories(): void {
    this.loadingCategories = true;
    this.categoryService
      .getCategoriesPaged(this.categorySearchParams)
      .subscribe({
        next: (result: PagedResult<ProductCategory>) => {
          this.categories = [...this.categories, ...result.items];
          this.totalCategories = result.totalCount;
          this.loadingCategories = false;
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load categories',
          });
          this.loadingCategories = false;
        },
      });
  }

  onCategoryScroll(event: any): void {
    const element = event.target;
    if (element.scrollHeight - element.scrollTop === element.clientHeight) {
      if (
        this.categorySearchParams.pageNumber! *
          this.categorySearchParams.pageSize! <
        this.totalCategories
      ) {
        this.categorySearchParams.pageNumber!++;
        this.loadCategories();
      }
    }
  }

  onCategorySearch(event: any): void {
    this.categorySearchParams.searchTerm = event.filter;
    this.categorySearchParams.pageNumber = 1;
    this.categories = [];
    this.loadCategories();
  }

  loadSubcategories(): void {
    if (!this.selectedCategory) return;

    this.loadingSubcategories = true;
    this.subcategorySearchParams.searchTerm = '';
    this.categoryService
      .getSubCategoriesPaged(this.subcategorySearchParams)
      .subscribe({
        next: (result: PagedResult<ProductSubCategory>) => {
          this.subcategories = [...this.subcategories, ...result.items];
          this.totalSubcategories = result.totalCount;
          this.loadingSubcategories = false;
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load subcategories',
          });
          this.loadingSubcategories = false;
        },
      });
  }

  onSubcategoryScroll(event: any): void {
    const element = event.target;
    if (element.scrollHeight - element.scrollTop === element.clientHeight) {
      if (
        this.subcategorySearchParams.pageNumber! *
          this.subcategorySearchParams.pageSize! <
        this.totalSubcategories
      ) {
        this.subcategorySearchParams.pageNumber!++;
        this.loadSubcategories();
      }
    }
  }

  onSubcategorySearch(event: any): void {
    this.subcategorySearchParams.searchTerm = event.filter;
    this.subcategorySearchParams.pageNumber = 1;
    this.subcategories = [];
    this.loadSubcategories();
  }

  loadDevices(): void {
    this.loadingDevices = true;
    this.deviceService.getLocalDevicesPaged(this.deviceSearchParams).subscribe({
      next: (response) => {
        if (response.success && response.result) {
          this.devices = [...this.devices, ...response.result.items];
          this.totalDevices = response.result.totalCount;
        }
        this.loadingDevices = false;
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load devices',
        });
        this.loadingDevices = false;
      },
    });
  }

  onDeviceScroll(event: any): void {
    const element = event.target;
    if (element.scrollHeight - element.scrollTop === element.clientHeight) {
      if (
        this.deviceSearchParams.pageNumber! *
          this.deviceSearchParams.pageSize! <
        this.totalDevices
      ) {
        this.deviceSearchParams.pageNumber!++;
        this.loadDevices();
      }
    }
  }

  loadTemplates(): void {
    this.loadingTemplates = true;
    this.deviceService
      .getLocalTemplatesPaged(this.templateSearchParams)
      .subscribe({
        next: (response) => {
          if (response.success && response.result) {
            this.templates = [...this.templates, ...response.result.items];
            this.totalTemplates = response.result.totalCount;
          }
          this.loadingTemplates = false;
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load templates',
          });
          this.loadingTemplates = false;
        },
      });
  }

  onTemplateScroll(event: any): void {
    const element = event.target;
    if (element.scrollHeight - element.scrollTop === element.clientHeight) {
      if (
        this.templateSearchParams.pageNumber! *
          this.templateSearchParams.pageSize! <
        this.totalTemplates
      ) {
        this.templateSearchParams.pageNumber!++;
        this.loadTemplates();
      }
    }
  }

  onDeviceSearch(event: any, assignment: any): void {
    this.deviceSearchParams.searchTerm = event.filter;
    this.deviceSearchParams.pageNumber = 1;
    this.devices = [];
    this.loadDevices();
  }

  onTemplateSearch(event: any, assignment: any): void {
    this.templateSearchParams.searchTerm = event.filter;
    this.templateSearchParams.pageNumber = 1;
    this.templates = [];
    this.loadTemplates();
  }

  addDeviceAssignment(): void {
    this.deviceAssignments.push({
      device: null,
      template: null,
      displayOrder: this.deviceAssignments.length + 1,
      isActive: true,
    });
  }

  removeDeviceAssignment(index: number): void {
    this.deviceAssignments.splice(index, 1);
    // Update display orders
    this.deviceAssignments.forEach((assignment, i) => {
      assignment.displayOrder = i + 1;
    });
  }

  onCreateProduct(): void {
    // Validate and create product
    const productData = {
      productName: this.productName,
      barcode: this.barcode,
      productCode: this.productCode,
      description: this.description,
      categoryId: this.selectedCategory?.id,
      subcategoryId: this.selectedSubcategory?.id,
      sellingPrice: this.sellingPrice,
      discountPrice: this.discountPrice,
      wholesalePrice: this.wholesalePrice,
      minPrice: this.minPrice,
      maxPrice: this.maxPrice,
      isActive: this.isActive,
      deviceAssignments: this.deviceAssignments,
      useExistingCombo: this.useExistingCombos,
      selectedComboId: this.selectedExistingCombo?.id,
    };

    // Call service to create product
    this.ref.close(productData);
  }

  enforceMaxLength(event: any, maxLength: number): void {
    if (event.target.value.length > maxLength) {
      event.target.value = event.target.value.slice(0, maxLength);
      this.description = event.target.value;
    }
  }

  onPaste(event: ClipboardEvent, maxLength: number): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    const allowedText = pastedText.slice(
      0,
      maxLength - (this.description?.length || 0),
    );
    this.description += allowedText;
  }

  onCancel(): void {
    this.ref.close();
  }
}
