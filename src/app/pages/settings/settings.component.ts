import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

/**
 * One row of the payload the server sends to Minew when a product is bound to
 * an ESL label.
 */
export interface MinewBindingField {
  /** The key Minew expects in its `goodsMap`. Spelling is theirs, not ours. */
  key: string;
  /** Human label for the product detail behind the key. */
  source: string;
  /** Where the value comes from - a product column, or a fixed value. */
  origin: 'product' | 'fixed' | 'context';
  /** The exact expression the server uses, for anyone cross-checking the code. */
  expression: string;
  /** What a bound label actually receives. */
  notes: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, TableModule, TagModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  /**
   * Mirrors `EslBindingService.BuildGoodsMap` in the API - the map used when a
   * product is bound from Product Management and by the queue processor.
   *
   * This is a reference view, not a live read: it documents what the server
   * builds today. If the binding code changes, this table has to change with
   * it.
   */
  readonly bindingFields: MinewBindingField[] = [
    {
      key: 'id',
      source: 'Product ID',
      origin: 'product',
      expression: 'ProductMaster.Id',
      notes: 'Identifies the product on the label.',
    },
    {
      key: 'p_name',
      source: 'Product Name',
      origin: 'product',
      expression: 'ProductMaster.ProductName',
      notes: 'Sent as-is.',
    },
    {
      key: 'p_code',
      source: 'Product Code',
      origin: 'product',
      expression: 'ProductMaster.ProductCode ?? ""',
      notes: 'Empty string when the product has no code.',
    },
    {
      key: 'price',
      source: 'Selling Price',
      origin: 'product',
      expression: 'ProductMaster.SellingPrice.ToString("0.00")',
      notes: 'Always two decimal places.',
    },
    {
      key: 'discount',
      source: 'Discount Price',
      origin: 'product',
      expression: 'ProductMaster.DiscountPrice.ToString("0.00")',
      notes: 'Always two decimal places. Sent even when there is no discount.',
    },
    {
      key: 'barcoode',
      source: 'Barcode',
      origin: 'product',
      expression: 'ProductMaster.BarCode ?? ""',
      notes:
        'The misspelling is required - it is the key name Minew’s API expects.',
    },
    {
      key: 'image',
      source: 'Template image',
      origin: 'context',
      expression: 'imageBase64',
      notes:
        'Only on the device-binding path; base64 of the rendered template. Not sent by the product or queue paths.',
    },
    {
      key: 'specification',
      source: 'Label size',
      origin: 'fixed',
      expression: '"2.9"',
      notes: 'Hard-coded. Not taken from the device or template.',
    },
    {
      key: 'unit',
      source: 'Unit code',
      origin: 'fixed',
      expression: '"001f"',
      notes: 'Hard-coded. The product’s own unit is not sent.',
    },
    {
      key: 'memberPrice',
      source: '—',
      origin: 'fixed',
      expression: '""',
      notes: 'Always empty. No member pricing is pushed today.',
    },
    {
      key: 'origin',
      source: '—',
      origin: 'fixed',
      expression: '""',
      notes: 'Always empty.',
    },
    {
      key: 'qrcode',
      source: '—',
      origin: 'fixed',
      expression: '""',
      notes: 'Always empty. No QR payload is generated.',
    },
  ];

  get productFieldCount(): number {
    return this.bindingFields.filter((f) => f.origin === 'product').length;
  }

  get fixedFieldCount(): number {
    return this.bindingFields.filter((f) => f.origin === 'fixed').length;
  }

  originSeverity(origin: MinewBindingField['origin']): string {
    switch (origin) {
      case 'product':
        return 'success';
      case 'context':
        return 'info';
      default:
        return 'secondary';
    }
  }

  originLabel(origin: MinewBindingField['origin']): string {
    switch (origin) {
      case 'product':
        return 'From product';
      case 'context':
        return 'From context';
      default:
        return 'Fixed value';
    }
  }
}
