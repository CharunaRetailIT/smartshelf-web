import { Component, OnInit } from '@angular/core';
import { ProductService } from '../../core/services/product.service';
import { SearchParams } from '../../core/interfaces/pagination-result.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImportsModule } from '../../imports/imports';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-product-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule, ImportsModule, DropdownModule, ButtonModule],
  templateUrl: './product-dropdown.component.html',
  styleUrls: ['./product-dropdown.component.css']
})
export class ProductDropdownComponent implements OnInit {
  products: any[] = [];
  selectedProduct: any;

  pageNumber = 1;
  pageSize = 5;
  totalCount = 0;
  loading = false;
  searchTerm = '';
  Math = Math; 

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadProducts(true);
  }

  loadProducts(reset = false) {
    if (this.loading) return;

    if (reset) {
      this.pageNumber = 1;
      this.products = [];
      this.totalCount = 0;
    }

    this.loading = true;

    const params: SearchParams = {
      pageNumber: this.pageNumber,
      pageSize: this.pageSize,
      searchTerm: this.searchTerm
    };

    this.productService.getProductsPaged(params).subscribe({
      next: res => {
        this.products = res.items;
        console.log("loaded produts ->",this.products)
        this.totalCount = res.totalCount;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  loadNext() {
    if ((this.pageNumber * this.pageSize) >= this.totalCount) return;
    this.pageNumber++;
    this.loadProducts();
  }

  loadPrevious() {
    if (this.pageNumber <= 1) return;
    this.pageNumber--;
    this.loadProducts();
  }

  onSearch(event: any) {
    this.searchTerm = event.filter;
    this.pageNumber = 1;
    this.loadProducts(true);
  }
}
