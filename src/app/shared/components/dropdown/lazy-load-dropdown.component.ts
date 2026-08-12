// lazy-load-dropdown.component.ts
import { Component, Input, Output, EventEmitter, forwardRef, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'app-lazy-load-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative" #dropdownContainer>
      <select
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        [class.border-red-500]="invalid"
        [disabled]="disabled"
        [(ngModel)]="selectedValue"
        (ngModelChange)="onValueChange($event)"
        (focus)="onFocus()"
        (blur)="onBlur()"
        (scroll)="onScroll($event)"
      >
        <option [ngValue]="null">{{ placeholder }}</option>
        <ng-container *ngFor="let item of items">
          <option [ngValue]="item.id" [disabled]="isDisabled(item)">
            {{ getDisplayText(item) }}
            <span *ngIf="isDisabled(item) && showDisabledText"> - {{ disabledText }}</span>
          </option>
        </ng-container>
        <option *ngIf="hasMore && !loading" disabled class="text-center text-gray-500">
          Scroll to load more...
        </option>
      </select>
      
      <div *ngIf="loading" class="absolute right-8 top-1/2 transform -translate-y-1/2">
        <i class="fas fa-spinner fa-spin text-gray-400 text-sm"></i>
      </div>
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LazyLoadDropdownComponent),
      multi: true
    }
  ]
})
export class LazyLoadDropdownComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() items: any[] = [];
  @Input() placeholder: string = 'Select option';
  @Input() displayField: string = 'name';
  @Input() valueField: string = 'id';
  @Input() disabled: boolean = false;
  @Input() invalid: boolean = false;
  @Input() loading: boolean = false;
  @Input() hasMore: boolean = false;
  @Input() disabledChecker?: (item: any) => boolean;
  @Input() disabledText: string = 'Already selected';
  @Input() showDisabledText: boolean = true;
  
  @Output() loadMore = new EventEmitter<void>();
  @Output() search = new EventEmitter<string>();
  
  @ViewChild('dropdownContainer', { static: false }) dropdownContainer!: ElementRef;
  
  selectedValue: any = null;
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.search.emit(searchTerm);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  writeValue(value: any): void {
    this.selectedValue = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onValueChange(value: any): void {
    this.selectedValue = value;
    this.onChange(value);
    this.onTouched();
  }

  onFocus(): void {
    this.onTouched();
  }

  onBlur(): void {
    this.onTouched();
  }

  onScroll(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const atBottom = select.scrollTop + select.clientHeight >= select.scrollHeight - 10;
    
    if (atBottom && this.hasMore && !this.loading) {
      this.loadMore.emit();
    }
  }

  getDisplayText(item: any): string {
    if (typeof this.displayField === 'string') {
      return item[this.displayField];
    }
    return String(item);
  }

  isDisabled(item: any): boolean {
    if (this.disabledChecker) {
      return this.disabledChecker(item);
    }
    return false;
  }
}