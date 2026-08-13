import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DeviceService } from '../../../core/services/device.service';
import { AisleService } from '../../../core/services/aisle.service';
import { ProductService } from '../../../core/services/product.service';
import { ShelfService } from '../../../core/services/shelf.service';
import { StoreService } from '../../../core/services/store.service';
import { SettingsService } from '../../../core/services/settings.service';
import { CommonModule } from '@angular/common';
import { StoreLookup } from '../../../core/interfaces/store.interface';
import { DeviceSelectionModalComponent } from '../device-selection-modal-component/device-selection-modal-component.component';
import { ComboCreationResult, DeviceSelectionModalData, TemplateSelectionModalData } from '../../../core/interfaces/combo-create.models';
import { MatDialog } from '@angular/material/dialog';
import { TemplateSelectionModalComponent } from '../template-selection-modal-component/template-selection-modal-component.component';
import { LocalDeviceDto } from '../../../core/interfaces/device.interface';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-device-template-management',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule],
    templateUrl: './device-template-management.component.html',
    styleUrls: ['./device-template-management.component.css']
})
export class DeviceTemplateManagementComponent implements OnInit {
    // Data sources
    stores: StoreLookup[] = [];
    minewDevices: any[] = [];
    filteredDevices: any[] = [];
    minewTemplates: any[] = [];
    localDevices: any[] = [];
    aisles: any[] = [];
    shelves: any[] = [];
    filteredShelves: any[] = [];
    products: any[] = [];
    deviceTemplateCombos: any[] = [];
    assignments: any[] = [];
    availableCombos: any[] = [];

    // Selected items
    selectedItem: any = null;
    selectedItemType: string = '';
    selectedAisle: any = null;
    
    // UI State
    activeTab: 'devices' | 'templates' | 'assignments' | 'bind' = 'devices';
    selectedStoreId: number = 0;
    loading = false;
    testPreview: string | null = null;
    
    // Forms
    deviceFilterForm: FormGroup;
    assignmentForm: FormGroup;

    // Add these properties
    bindingInProgress: boolean = false;
    selectedCombos: Set<number> = new Set();
    selectedAssignmentLocationId: number | null = null;
    selectedAssignmentLocationType: string | null = null;
    
    constructor(
        private deviceService: DeviceService,
        private aisleService: AisleService,
        private shelfService: ShelfService,
        private productService: ProductService,
        private storeService: StoreService,
        private settingsService: SettingsService,
        public auth: AuthService,
        private dialog: MatDialog,
        private fb: FormBuilder
    ) {
        this.deviceFilterForm = this.fb.group({
            status: ['all'],
            batteryLevel: ['all'],
            search: ['']
        });
        
        this.assignmentForm = this.fb.group({
            selectedCombo: [''],
            locationType: ['Aisle'],
            locationId: [''],
            assignments: this.fb.array([])
        });

        // Subscribe to form changes for filtering
        this.deviceFilterForm.valueChanges.subscribe(() => {
            this.filterDevices();
        });
    }
    
    ngOnInit() {
        this.loadStores();
        this.loadAisles();
        this.loadLocalData();
        this.loadDeviceTemplateCombos();
        this.loadProducts();
    }

    // ============ STORE MANAGEMENT ============

    // Local stores, not Minew's cloud list. Every endpoint this page calls
    // (devices/sync, templates/sync, light-up) keys off the local StoreMaster
    // id, so listing cloud stores here handed them an id they could not
    // resolve - "Store not found".
    loadStores() {
        this.storeService.getStoreLookup().subscribe({
            next: (stores) => {
                this.stores = stores;

                // Store is mandatory per user now, so preselect theirs and the
                // page is usable without touching the dropdown.
                const currentStore = this.settingsService.getCurrentDefaultStore();
                if (currentStore && stores.some(s => s.id === currentStore.id)) {
                    this.selectedStoreId = currentStore.id;
                } else if (stores.length === 1) {
                    this.selectedStoreId = stores[0].id;
                }
            },
            error: (error) => {
                console.error('Failed to load stores:', error);
            }
        });
    }

    loadStoreData() {
        if (!this.selectedStoreId) {
            alert('Please select a store first');
            return;
        }
        
        this.loading = true;
        // Load devices, templates, and combos for selected store
        this.syncDevicesFromCloud();
        this.syncTemplatesFromCloud();
        this.loadDeviceTemplateCombos();
        this.loading = false;
    }

    // ============ DEVICE MANAGEMENT ============

    syncDevicesFromCloud() {
        if (!this.selectedStoreId) {
            alert('Please select a store first');
            return;
        }
        
        this.loading = true;
        this.deviceService.syncDevicesFromCloud(this.selectedStoreId).subscribe({
            next: (devices) => {
                this.minewDevices = devices;
                this.filteredDevices = devices;
                this.loading = false;
                this.filterDevices(); // Apply initial filters
            },
            error: (error) => {
                console.error('Sync failed:', error);
                this.loading = false;
                alert('Failed to sync devices: ' + error.message);
            }
        });
    }

    filterDevices() {
        const formValue = this.deviceFilterForm.value;
        let filtered = [...this.minewDevices];

        // Filter by status
        if (formValue.status !== 'all') {
            filtered = filtered.filter(device => 
                device.status.toLowerCase() === formValue.status.toLowerCase()
            );
        }

        // Filter by battery level
        if (formValue.batteryLevel !== 'all') {
            switch (formValue.batteryLevel) {
                case 'high':
                    filtered = filtered.filter(device => device.battery > 70);
                    break;
                case 'medium':
                    filtered = filtered.filter(device => device.battery > 30 && device.battery <= 70);
                    break;
                case 'low':
                    filtered = filtered.filter(device => device.battery <= 30);
                    break;
            }
        }

        // Filter by search term
        if (formValue.search) {
            const searchTerm = formValue.search.toLowerCase();
            filtered = filtered.filter(device =>
                device.mac?.toLowerCase().includes(searchTerm) ||
                device.deviceName?.toLowerCase().includes(searchTerm)
            );
        }

        this.filteredDevices = filtered;
    }

    identifyDevice(device: any) {
        this.deviceService.identifyDevice(device.mac, this.selectedStoreId);
    }
    
    lightUpDevice(device: any, color: number) {
        this.deviceService.lightUpDevice(device.mac, this.selectedStoreId, color).subscribe();
    }

    getDeviceStatusClass(status: string): string {
        switch(status.toLowerCase()) {
            case 'online': return 'badge bg-success';
            case 'offline': return 'badge bg-danger';
            case 'low battery': return 'badge bg-warning text-dark';
            default: return 'badge bg-secondary';
        }
    }
    
    getBatteryClass(battery: number): string {
        if (battery > 70) return 'battery-high';
        if (battery > 30) return 'battery-medium';
        return 'battery-low';
    }

    // ============ TEMPLATE MANAGEMENT ============

    syncTemplatesFromCloud() {
        if (!this.selectedStoreId) {
            alert('Please select a store first');
            return;
        }
        
        this.loading = true;
        this.deviceService.syncTemplatesFromCloud(this.selectedStoreId).subscribe({
            next: (templates) => {
                this.minewTemplates = templates;
                this.loading = false;
            },
            error: (error) => {
                console.error('Sync failed:', error);
                this.loading = false;
                alert('Failed to sync templates: ' + error.message);
            }
        });
    }

    loadTemplatePreview(template: any) {
        this.deviceService.getTemplatePreview(template.name).subscribe({
            next: (previewData) => {
                template.previewImage = previewData;
            },
            error: (error) => {
                console.error('Failed to load preview:', error);
            }
        });
    }

    // ============ DEVICE-TEMPLATE COMBOS ============

    loadDeviceTemplateCombos() {
        this.deviceService.getDeviceTemplateCombos().subscribe({
            next: (combos) => {
                this.deviceTemplateCombos = combos;
                this.availableCombos = combos;
            },
            error: (error) => {
                console.error('Failed to load combos:', error);
            }
        });
    }

    createCombo(device: any, template: any) {
        this.deviceService.createDeviceTemplateCombo(device.id, template.id).subscribe({
            next: (combo) => {
                console.log('Combo created:', combo);
                this.loadDeviceTemplateCombos(); // Refresh combos
            },
            error: (error) => {
                console.error('Failed to create combo:', error);
            }
        });
    }

    // createComboWithDevice(device: any) {
    //     // This method should open a modal to select template
    //     console.log('Create combo with device:', device);
    //     // TODO: Implement template selection modal
    // }

    createComboWithDevice(device: any) {
  if (!this.selectedStoreId) {
    alert('Please select a store first');
    return;
  }

  const dialogRef = this.dialog.open(DeviceSelectionModalComponent, {
    width: '900px',
    data: {
      storeId: this.selectedStoreId,
      selectedTemplate: undefined
    } as DeviceSelectionModalData
  });

  dialogRef.afterClosed().subscribe((result: ComboCreationResult) => {
    if (result.success && result.combo) {
      console.log('Combo created successfully:', result.combo);
      this.loadDeviceTemplateCombos(); // Refresh the list
      
      // Now show template selection modal
      this.selectTemplateForCombo(device, result.combo);
    } else if (result.error) {
      alert('Failed to create combo: ' + result.error);
    }
  });
}

createComboWithTemplate(template: any) {
  if (!this.selectedStoreId) {
    alert('Please select a store first');
    return;
  }

  const dialogRef = this.dialog.open(TemplateSelectionModalComponent, {
    width: '900px',
    data: {
      storeId: this.selectedStoreId,
      selectedDevice: undefined
    } as TemplateSelectionModalData
  });

  dialogRef.afterClosed().subscribe((result: ComboCreationResult) => {
    if (result.success && result.combo) {
      console.log('Combo created successfully:', result.combo);
      this.loadDeviceTemplateCombos(); // Refresh the list
      
      // Now show device selection modal
      this.selectDeviceForCombo(template, result.combo);
    } else if (result.error) {
      alert('Failed to create combo: ' + result.error);
    }
  });
}

// Helper methods for two-step combo creation
selectTemplateForCombo(device: any, combo: any) {
  const dialogRef = this.dialog.open(DeviceSelectionModalComponent, {
    width: '900px',
    data: {
      storeId: this.selectedStoreId,
      selectedDevice: device
    } as DeviceSelectionModalData
  });

  dialogRef.afterClosed().subscribe((result: ComboCreationResult) => {
    if (result.success) {
      alert('Device-Template combo created successfully!');
    }
  });
}

selectDeviceForCombo(template: any, combo: any) {
  const dialogRef = this.dialog.open(TemplateSelectionModalComponent, {
    width: '900px',
    data: {
      storeId: this.selectedStoreId,
      selectedTemplate: template
    } as TemplateSelectionModalData
  });

  dialogRef.afterClosed().subscribe((result: ComboCreationResult) => {
    if (result.success) {
      alert('Device-Template combo created successfully!');
    }
  });
}

// Add method to create combo directly with both device and template
createDirectCombo(device: any, template: any) {
  if (!device || !template) {
    alert('Please select both device and template');
    return;
  }

  this.deviceService.createDeviceTemplateCombo(device.id, template.id).subscribe({
    next: (combo) => {
      console.log('Combo created:', combo);
      this.loadDeviceTemplateCombos(); // Refresh combos
      alert('Device-Template combo created successfully!');
    },
    error: (error) => {
      console.error('Failed to create combo:', error);
      alert('Failed to create combo: ' + error.message);
    }
  });
}

    // createComboWithTemplate(template: any) {
    //     // This method should open a modal to select device
    //     console.log('Create combo with template:', template);
    //     // TODO: Implement device selection modal
    // }

    // ============ ASSIGNMENT MANAGEMENT ============

    onLocationTypeChange() {
        const locationType = this.assignmentForm.get('locationType')?.value;
        this.assignmentForm.get('locationId')?.setValue('');
        this.assignments = [];
        this.selectedAssignmentLocationId = null;
        this.selectedAssignmentLocationType = null;
    }

    getLocationsByType(type: string): any[] {
        switch(type) {
            case 'Aisle': return this.aisles;
            case 'Shelf': return this.shelves;
            case 'Product': return this.products;
            default: return [];
        }
    }

    assignCombo() {
        const formValue = this.assignmentForm.value;
        const userId = 1; // TODO: Get actual user ID from auth service
        
        this.deviceService.assignComboToLocation(
            formValue.selectedCombo,
            formValue.locationType,
            formValue.locationId,
            userId
        ).subscribe({
            next: (assignment) => {
                console.log('Assigned successfully:', assignment);
                this.loadAssignments();
                // Reset form
                this.assignmentForm.patchValue({
                    selectedCombo: '',
                    locationId: ''
                });
            },
            error: (error) => {
                console.error('Assignment failed:', error);
                alert('Failed to assign combo: ' + error.message);
            }
        });
    }

    loadAssignments() {
        const formValue = this.assignmentForm.value;
        if (formValue.locationType && formValue.locationId) {
            this.selectedAssignmentLocationId = formValue.locationId;
            this.selectedAssignmentLocationType = formValue.locationType;
            
            this.deviceService.getAssignments(
                formValue.locationType,
                formValue.locationId
            ).subscribe({
                next: (assignments) => {
                    this.assignments = assignments;
                },
                error: (error) => {
                    console.error('Failed to load assignments:', error);
                    this.assignments = [];
                }
            });
        }
    }

    removeAssignment(assignmentId: number) {
        if (confirm('Are you sure you want to remove this assignment?')) {
            this.deviceService.removeAssignment(assignmentId).subscribe({
                next: () => {
                    console.log('Assignment removed');
                    this.loadAssignments();
                },
                error: (error) => {
                    console.error('Failed to remove assignment:', error);
                }
            });
        }
    }

    updateAssignmentOrder(assignmentId: number, newPosition: number) {
        const userId = 1; // TODO: Get actual user ID
        this.deviceService.updateAssignmentOrder(assignmentId, newPosition, userId).subscribe({
            next: () => {
                console.log('Order updated');
                this.loadAssignments();
            },
            error: (error) => {
                console.error('Failed to update order:', error);
            }
        });
    }

    // ============ BIND DATA ============

    selectAisle(aisle: any) {
        this.selectedItem = aisle;
        this.selectedItemType = 'Aisle';
        this.selectedAisle = aisle;
        this.filteredShelves = this.shelves.filter(shelf => shelf.aisleId === aisle.id);
    }

    selectShelf(shelf: any) {
        this.selectedItem = shelf;
        this.selectedItemType = 'Shelf';
    }

    selectProduct(product: any) {
        this.selectedItem = product;
        this.selectedItemType = 'Product';
    }

    getLocationName(locationType: string, locationId: number): string {
        const locations = this.getLocationsByType(locationType);
        const location = locations.find(loc => loc.id === locationId);
        return location ? (location.name || location.productName) : 'Unknown';
    }

    isComboSelected(comboId: number): boolean {
        return this.selectedCombos.has(comboId);
    }

    getSelectedCombos(): number[] {
        return Array.from(this.selectedCombos);
    }

    toggleComboSelection(comboId: number, event: any) {
        const isChecked = event.target.checked;
        if (isChecked) {
            this.selectedCombos.add(comboId);
        } else {
            this.selectedCombos.delete(comboId);
        }
    }

    testBind() {
        if (this.selectedCombos.size === 0) {
            alert('Please select at least one combo');
            return;
        }

        if (!this.selectedItem || !this.selectedItemType) {
            alert('Please select an item to bind');
            return;
        }

        // Test with the first selected combo
        const firstComboId = Array.from(this.selectedCombos)[0];
        const testData = this.createTestData();
        
        this.deviceService.testBindPreview(firstComboId, testData).subscribe({
            next: (preview) => {
                this.testPreview = preview;
            },
            error: (error) => {
                console.error('Test bind failed:', error);
                alert('Test bind failed: ' + error.message);
            }
        });
    }

    applyBind() {
        if (this.selectedCombos.size === 0) {
            alert('Please select at least one combo');
            return;
        }

        if (!this.selectedItem || !this.selectedItemType) {
            alert('Please select an item to bind');
            return;
        }

        this.bindingInProgress = true;
        
        // Create batch bind request
        const assignments = Array.from(this.selectedCombos).map(comboId => ({
            comboId,
            productId: this.selectedItemType === 'Product' ? this.selectedItem.id : null,
            locationType: this.selectedItemType === 'Product' ? null : this.selectedItemType,
            locationId: this.selectedItemType === 'Product' ? null : this.selectedItem.id,
            color: 1,
            brightness: 100
        }));

        this.deviceService.batchBind(assignments).subscribe({
            next: (response) => {
                alert(`Successfully bound ${response.successCount} combo(s)`);
                this.bindingInProgress = false;
                this.testPreview = null;
                this.selectedCombos.clear();
            },
            error: (error) => {
                console.error('Bind failed:', error);
                this.bindingInProgress = false;
                alert('Bind failed: ' + error.message);
            }
        });
    }

    quickBindProduct(product: any, comboId: number) {
        this.deviceService.quickBindProduct(product.id, comboId).subscribe({
            next: () => {
                console.log('Product bound successfully');
                alert('Product bound successfully');
            },
            error: (error) => {
                console.error('Bind failed:', error);
                alert('Bind failed: ' + error.message);
            }
        });
    }

    // ============ HELPER METHODS ============

    private createTestData(): any {
        if (!this.selectedItem) return {};
        
        switch (this.selectedItemType) {
            case 'Product':
                return {
                    id: this.selectedItem.id.toString(),
                    name: this.selectedItem.productName,
                    price: this.selectedItem.sellingPrice?.toString() || '0.00',
                    barcode: this.selectedItem.barCode || ''
                };
            case 'Shelf':
                return {
                    id: this.selectedItem.id.toString(),
                    name: this.selectedItem.name,
                    location: this.selectedItem.location || '',
                    description: this.selectedItem.description || ''
                };
            case 'Aisle':
                return {
                    id: this.selectedItem.id.toString(),
                    name: this.selectedItem.name,
                    location: this.selectedItem.location || '',
                    description: this.selectedItem.description || ''
                };
            default:
                return {};
        }
    }

    private loadLocalData() {
        this.deviceService.getLocalDevices().subscribe(devices => {
               console.log('API Response:', devices); // Check actual data
            console.log('First device:', devices[0]); // Check structure
            this.localDevices = devices;
        });
    }

    loadAisles() {
        this.aisleService.getAllAisles().subscribe(aisles => {
            this.aisles = aisles;
            this.shelves = aisles.flatMap((aisle: any) => 
                aisle.shelves?.map((shelf: any) => ({
                    ...shelf,
                    aisleName: aisle.name,
                    aisleId: aisle.id
                })) || []
            );
        });
    }

    loadProducts() {
        this.productService.getAllProducts().subscribe({
            next: (products) => {
                this.products = products;
            },
            error: (error) => {
                console.error('Failed to load products:', error);
            }
        });
    }
}