import { Pipe, PipeTransform } from '@angular/core';

/**
 * Simple filter pipe for finding items in arrays
 * Usage: array | filter: 'propertyName' : value
 */
@Pipe({
  name: 'filter',
  standalone: true
})
export class FilterPipe implements PipeTransform {
  transform(items: any[], field: string, value: any): any[] {
    if (!items || !field) {
      return items;
    }
    
    return items.filter(item => item[field] === value);
  }
}