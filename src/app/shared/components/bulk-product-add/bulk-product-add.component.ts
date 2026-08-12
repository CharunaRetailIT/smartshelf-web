import { SelectionModel } from '@angular/cdk/collections';
import { Component, Inject, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CreateQueueEntryRequest } from '../../../core/interfaces/queue.interface';
import { Product } from '../../../core/interfaces/shelf.interface';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Shelf } from '../../../core/interfaces/aisle.interface';

interface DialogData {
  aisleId: number;
  shelfId?: number | null;
  shelves: Shelf[];
  availableProducts: Product[];
}

interface TargetConfiguration {
  type: 'all-shelves' | 'specific-shelves' | 'aisle-level';
  shelfIds?: number[];
}


@Component({
  selector: 'app-bulk-product-add',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatCheckboxModule],
  templateUrl: './bulk-product-add.component.html',
  styleUrl: './bulk-product-add.component.css'
})
export class BulkProductAddComponent implements OnInit {
form!: FormGroup;
  productSelection = new SelectionModel<Product>(true, []);
  selectedShelfIds: number[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<BulkProductAddComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    const defaultTargetType = this.data.shelves.length > 0 ? 'all-shelves' : 'aisle-level';
    
    this.form = this.fb.group({
      targetType: [defaultTargetType, Validators.required],
      displayDuration: [10, [Validators.required, Validators.min(1), Validators.max(3600)]],
      priority: [5, [Validators.required, Validators.min(1), Validators.max(10)]],
      startTime: [null],
      endTime: [null],
      isActive: [true]
    });

    // Initialize shelf selection for all-shelves
    if (defaultTargetType === 'all-shelves') {
      this.selectedShelfIds = this.data.shelves.map(s => s.id!);
    }
  }

  onShelfSelectionChange(shelfId: number, event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      if (!this.selectedShelfIds.includes(shelfId)) {
        this.selectedShelfIds.push(shelfId);
      }
    } else {
      this.selectedShelfIds = this.selectedShelfIds.filter(id => id !== shelfId);
    }
  }

  selectAllProducts(): void {
    this.data.availableProducts.forEach(product => {
      this.productSelection.select(product);
    });
  }

  selectNoProducts(): void {
    this.productSelection.clear();
  }

  trackByProductId(index: number, product: Product): number {
    return product.id;
  }

  getTargetSummary(): string {
    const targetType = this.form.get('targetType')?.value;
    
    switch (targetType) {
      case 'all-shelves':
        return `All ${this.data.shelves.length} shelves in aisle`;
      case 'specific-shelves':
        return `${this.selectedShelfIds.length} selected shelves`;
      case 'aisle-level':
        return 'Aisle level (no shelves)';
      default:
        return 'Not configured';
    }
  }

  getTotalEntries(): number {
    const selectedProducts = this.productSelection.selected.length;
    const targetType = this.form.get('targetType')?.value;
    
    switch (targetType) {
      case 'all-shelves':
        return selectedProducts * this.data.shelves.length;
      case 'specific-shelves':
        return selectedProducts * this.selectedShelfIds.length;
      case 'aisle-level':
        return selectedProducts;
      default:
        return 0;
    }
  }

  canSubmit(): boolean {
    const hasProducts = this.productSelection.selected.length > 0;
    const formValid = this.form.valid;
    const targetType = this.form.get('targetType')?.value;
    
    if (targetType === 'specific-shelves') {
      return hasProducts && formValid && this.selectedShelfIds.length > 0;
    }
    
    return hasProducts && formValid;
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  onSubmit(): void {
    if (!this.canSubmit()) {
      return;
    }

    const formValue = this.form.value;
    const targetType = formValue.targetType;
    const selectedProducts = this.productSelection.selected;
    
    const requests: CreateQueueEntryRequest[] = [];
    
    // Determine target shelf IDs
    let targetShelfIds: number[] = [];
    
    switch (targetType) {
      case 'all-shelves':
        targetShelfIds = this.data.shelves.map(s => s.id!);
        break;
      case 'specific-shelves':
        targetShelfIds = this.selectedShelfIds;
        break;
      case 'aisle-level':
        targetShelfIds = [this.data.aisleId]; // Use aisle ID for aisle-level entries
        break;
    }

    // Create requests for each product and target combination
    selectedProducts.forEach(product => {
      targetShelfIds.forEach(shelfId => {
        requests.push({
          shelfId: shelfId,
          entryType: 'Product',
          productId: product.id,
          displayDuration: formValue.displayDuration,
          startTime: formValue.startTime || undefined,
          endTime: formValue.endTime || undefined,
          priority: formValue.priority
        });
      });
    });

    this.dialogRef.close(requests);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
