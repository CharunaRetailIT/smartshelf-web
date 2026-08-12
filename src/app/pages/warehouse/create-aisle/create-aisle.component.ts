import { Component, inject, OnInit } from '@angular/core';
import { AisleMaster } from '../../../core/interfaces/aisle.interface';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AisleService } from '../../../core/services/aisle.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/services/auth.service';
import { SnackbarData, CustomSnackbarComponent } from '../../../shared/components/alert/custom-snackbar.component';
import { DeviceService } from '../../../core/services/device.service';
import { DeviceTemplateComboDto, LocalDeviceDto, LocalTemplateDto } from '../../../core/interfaces/device.interface';
import { ConfirmationDialogComponent } from '../../../shared/components/dialog/confirmation-dialog/confirmation-dialog.component';
import { SettingsService } from '../../../core/services/settings.service';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { ImportsModule } from '../../../imports/imports';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-create-aisle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule,
    MatInputModule, MatSelectModule, MatIconModule, MatCardModule, MatDividerModule, FormsModule, ImportsModule],
  templateUrl: './create-aisle.component.html',
  styleUrl: './create-aisle.component.css'
})
export class CreateAisleComponent implements OnInit {
  private messageService = inject(MessageService);

  aisleForm: FormGroup;
  isSubmitting = false;
  currentUserId!: number;

  // Device and Template properties (now per shelf)
  localDevices: any[] = [];
  localTemplates: LocalTemplateDto[] = [];

  storeId: number = 0;

  xistingCombos: DeviceTemplateComboDto[] = [];
  existingComboLoading = false;
  selectedExistingCombos: DeviceTemplateComboDto[] = [];
  existingCombos: DeviceTemplateComboDto[] = [];
  // Add these properties for lazy loading
  existingComboPage: number = 1;
  existingComboHasMore: boolean = true;
  existingComboSearchTerm: string = '';
  pageSize: number = 10;
  private existingComboFilterSubject = new Subject<string>();

  templatePage: number = 1;
  templateHasMore: boolean = true;
  templateSearchTerm: string = '';
  private templateFilterSubject = new Subject<string>();
  templatesLoaded: boolean = false;
  templatesLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateAisleComponent>,
    private snackBar: MatSnackBar,
    private auth: AuthService,
    private aisleService: AisleService,
    private deviceService: DeviceService,
    private settingsService: SettingsService,
    private dialog: MatDialog
  ) {
    this.aisleForm = this.createForm();
    this.setupFilterSubjects();
  }

  ngOnInit(): void {
    this.initCurrentUser();
    this.setDefaultStore();
    this.loadLocalDevices();
    // this.loadLocalTemplates();
    this.loadExistingCombos(); // Load existing combos on init
    this.loadTemplates();

  }

  private setupFilterSubjects(): void {
    // Add existing combo filter subject
    this.existingComboFilterSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.existingComboSearchTerm = searchTerm;
      this.existingComboPage = 1;
      this.existingCombos = [];
      this.loadExistingCombos();
    });

    // Add template filter subject
    this.templateFilterSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.templateSearchTerm = searchTerm;
      this.templatePage = 1;
      this.localTemplates = []; // Clear existing templates
      this.loadTemplates();
    });
  }

  loadTemplates(): void {
    if (this.templatesLoading || !this.storeId) return;

    this.templatesLoading = true;

    // Use the paged method that supports search
    this.deviceService.getLocalTemplatesPagedByStore(
      this.storeId,
      this.templatePage,
      this.pageSize, // Add pageSize property (e.g., pageSize = 20)
      this.templateSearchTerm
    ).subscribe({
      next: (response) => {
        const newTemplates = response.items || [];

        if (this.templatePage === 1) {
          this.localTemplates = newTemplates;
        } else {
          this.localTemplates = [...this.localTemplates, ...newTemplates];
        }

        this.templateHasMore = this.localTemplates.length < (response.totalCount || 0);
        this.templatesLoaded = true;
        this.templatesLoading = false;

        // Pre-select any existing template selections
        //this.preSelectTemplates();
      },
      error: (error) => {
        console.error('Error loading templates:', error);
        this.showError('Failed to load templates');
        this.templatesLoading = false;
      }
    });
  }

  // Add this method for search input
  onTemplateSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.templateFilterSubject.next(input.value);
  }

  // Method to load more templates
  loadMoreTemplates(): void {
    if (!this.templatesLoading && this.templateHasMore) {
      this.templatePage++;
      this.loadTemplates();
    }
  }

  // Method for lazy loading/infinite scroll
  onTemplateLazyLoad(event: any): void {
    const { first, rows, filter } = event;
    const pageNumber = Math.floor(first / rows) + 1;

    if (filter && filter !== this.templateSearchTerm) {
      this.templateFilterSubject.next(filter);
    } else if (first + rows >= this.localTemplates.length &&
      this.templateHasMore &&
      !this.templatesLoading) {
      this.templatePage = pageNumber;
      this.loadTemplates();
    }
  }

  setDefaultStore() {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    if (currentStore) {
      this.storeId = currentStore.id;
    }
  }

  ngAfterViewInit(): void {
    this.dialogRef.afterOpened().subscribe(() => {
      this.initCurrentUser();
      this.loadLocalDevices();
      this.loadLocalTemplates();
    });
  }

  private initCurrentUser(): void {
    console.log("currentuser")
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      this.showError('User not authenticated');
      return;
    }
    this.currentUserId = user.id;
  }

  createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(75)]],
      description: ['', [Validators.maxLength(50)]],
      location: ['', [Validators.required, Validators.maxLength(75)]],
      coordinates: ['', [Validators.maxLength(75)]],
      isActive: [true],
      shelves: this.fb.array([])
    });
  }

  get shelves(): FormArray {
    return this.aisleForm.get('shelves') as FormArray;
  }

  // Create shelf form with combo array
  createShelfForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required]],
      location: ['', [Validators.required]],
      coordinates: [''],
      ipAddress: ['', [Validators.pattern(/^(\d{1,3}\.){3}\d{1,3}$/)]],
      deviceName: [''],
      macAddress: [''],
      description: [''],
      isActive: [true],
      deviceCombos: this.fb.array([]) // Device-template combos for this shelf
    });
  }

  // Get device combos for a specific shelf
  getShelfCombos(shelfIndex: number): FormArray {
    try {
      const shelf = this.shelves.at(shelfIndex) as FormGroup;
      return shelf.get('deviceCombos') as FormArray;
    } catch (error) {
      console.error('Error getting shelf combos:', error);
      return this.fb.array([]) as FormArray;
    }
  }

  // Create device combo form
  createDeviceComboForm(): FormGroup {
    return this.fb.group({
      deviceId: ['', [Validators.required]],
      templateId: ['', [Validators.required]],
      deviceName: [''],
      templateName: [''],
      screenSize: [''],
      showDetails: [false]
    });
  }

  addShelf(): void {
    // Create the shelf form first
    const shelfForm = this.createShelfForm();
    this.shelves.push(shelfForm);

    // Get the index of the newly added shelf
    const shelfIndex = this.shelves.length - 1;

    // Add a default device combo to the new shelf
    this.addDeviceComboToShelf(shelfIndex);
  }

  addDeviceComboToShelf(shelfIndex: number): void {
    const combos = this.getShelfCombos(shelfIndex);
    if (combos) {
      const newCombo = this.createDeviceComboForm();
      combos.push(newCombo);
    }
  }

  removeDeviceComboFromShelf(shelfIndex: number, comboIndex: number): void {
    const combos = this.getShelfCombos(shelfIndex);
    if (combos && combos.length > 0) {
      combos.removeAt(comboIndex);
    }
  }

  removeShelf(index: number): void {
    if (this.shelves.length > 0) {
      this.shelves.removeAt(index);
    }
  }

  // Device and Template Methods
  loadLocalDevices(): void {
    console.log("caled to ed")
    this.deviceService.getLocalDevices().subscribe({
      next: (devices) => {
        this.localDevices = devices;
        console.log("devices", devices);
      },
      error: (error) => {
        console.error('Error loading local devices:', error);
        this.showError('Failed to load local devices');
      }
    });
  }

  loadLocalTemplates(): void {
    this.deviceService.getLocalTemplates().subscribe({
      next: (templates) => {
        this.localTemplates = templates;
        console.log("temp", templates);

      },
      error: (error) => {
        console.error('Error loading local templates:', error);
        this.showError('Failed to load display templates');
      }
    });
  }

  loadExistingCombos(): void {
    if (this.existingComboLoading || !this.storeId) return;

    this.existingComboLoading = true;

    const request = {
      pageNumber: this.existingComboPage,
      pageSize: this.pageSize,
      searchTerm: this.existingComboSearchTerm,
      isActive: true
    };

    this.deviceService.getCombosPaged(request).subscribe({
      next: (response) => {
        if (response.success && response.result) {
          const newCombos = response.result.items || [];

          if (this.existingComboPage === 1) {
            this.existingCombos = newCombos;
          } else {
            this.existingCombos = [...this.existingCombos, ...newCombos];
          }

          this.existingComboHasMore = this.existingCombos.length < (response.result.totalCount || 0);
        }
      },
      error: (error) => {
        console.error('Error loading existing combos:', error);
        this.showError('Failed to load existing combos');
      },
      complete: () => {
        this.existingComboLoading = false;
      }
    });
  }

  // Add this method for lazy loading
  onExistingComboLazyLoad(event: any): void {
    if (event.filter && event.filter !== this.existingComboSearchTerm) {
      this.existingComboFilterSubject.next(event.filter);
    } else if (event.first + event.rows >= this.existingCombos.length &&
      this.existingComboHasMore &&
      !this.existingComboLoading) {
      this.existingComboPage++;
      this.loadExistingCombos();
    }
  }

  // Add this method to add selected existing combos to a shelf
  addSelectedExistingCombosToShelf(shelfIndex: number): void {
    if (!this.selectedExistingCombos.length) return;

    const combos = this.getShelfCombos(shelfIndex);

    this.selectedExistingCombos.forEach(existingCombo => {
      // Check if this combo already exists in this shelf
      const alreadyExists = combos.controls.some(comboControl =>
        comboControl.get('deviceId')?.value === existingCombo.deviceId &&
        comboControl.get('templateId')?.value === existingCombo.templateId
      );

      if (!alreadyExists) {
        const newCombo = this.createDeviceComboForm();
        newCombo.patchValue({
          deviceId: existingCombo.deviceId,
          templateId: existingCombo.templateId,
          deviceName: existingCombo.deviceName,
          templateName: existingCombo.templateName,
          screenSize: existingCombo.screenSize
        });
        combos.push(newCombo);
      }
    });

    this.showSuccess(`Added ${this.selectedExistingCombos.length} combo(s) to shelf ${shelfIndex + 1}`);
    this.selectedExistingCombos = [];
  }

  // Update the getDeviceStatusClass to handle existing combos
  getDeviceStatusForCombo(combo: DeviceTemplateComboDto): string {
    const device = this.localDevices.find(d => d.id === combo.deviceId);
    return device?.status || 'Unknown';
  }

  getDeviceStatusClassForCombo(combo: DeviceTemplateComboDto): string {
    const status = this.getDeviceStatusForCombo(combo).toLowerCase();

    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-red-100 text-red-800';
      case 'charging':
        return 'bg-yellow-100 text-yellow-800';
      case 'low battery':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  // Update isDeviceSelectedInAnyShelf to check existing combos too
  isExistingComboSelectedInAnyShelf(existingCombo: DeviceTemplateComboDto): boolean {
    for (let shelfIndex = 0; shelfIndex < this.shelves.length; shelfIndex++) {
      const combos = this.getShelfCombos(shelfIndex);
      for (let comboIndex = 0; comboIndex < combos.length; comboIndex++) {
        const combo = combos.at(comboIndex);
        if (combo.get('deviceId')?.value === existingCombo.deviceId &&
          combo.get('templateId')?.value === existingCombo.templateId) {
          return true;
        }
      }
    }
    return false;
  }

  // Method to clear selected existing combos
  clearSelectedExistingCombos(): void {
    this.selectedExistingCombos = [];
  }


  // Helper methods for template
  getDeviceName(deviceId: string): string {
    if (!deviceId) return 'Select device';
    const device = this.localDevices.find(d => d.id === deviceId);
    return device?.deviceName || 'Unknown device';
  }

  getTemplateName(templateId: string): string {
    if (!templateId) return 'Select template';
    const template = this.localTemplates.find(t => t.id === templateId);
    return template?.name || 'Unknown template';
  }

  getDeviceStatus(deviceId: string): string {
    if (!deviceId) return 'No device';
    const device = this.localDevices.find(d => d.id === deviceId);
    return device?.status || 'Unknown';
  }

  getDeviceStatusClass(deviceId: string): string {
    const status = this.getDeviceStatus(deviceId).toLowerCase();

    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-red-100 text-red-800';
      case 'charging':
        return 'bg-yellow-100 text-yellow-800';
      case 'low battery':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  // Check if device is already selected in any shelf
  isDeviceSelectedInAnyShelf(deviceId: string, currentShelfIndex: number, currentComboIndex?: number): boolean {
    if (!deviceId) return false;

    for (let shelfIndex = 0; shelfIndex < this.shelves.length; shelfIndex++) {
      const combos = this.getShelfCombos(shelfIndex);
      for (let comboIndex = 0; comboIndex < combos.length; comboIndex++) {
        // Skip current combo if editing
        if (shelfIndex === currentShelfIndex && comboIndex === currentComboIndex) {
          continue;
        }
        const combo = combos.at(comboIndex);
        if (combo.get('deviceId')?.value === deviceId) {
          return true;
        }
      }
    }
    return false;
  }

  // Get available devices count for a shelf
  getAvailableDevicesCount(shelfIndex: number): number {
    const usedDevices = new Set<string>();

    for (let i = 0; i < this.shelves.length; i++) {
      const combos = this.getShelfCombos(i);
      for (let j = 0; j < combos.length; j++) {
        const deviceId = combos.at(j).get('deviceId')?.value;
        if (deviceId) {
          usedDevices.add(deviceId);
        }
      }
    }

    return this.localDevices.length - usedDevices.size;
  }

  // Check if any shelf has device combos
  hasDeviceCombos(): boolean {
    for (let i = 0; i < this.shelves.length; i++) {
      const combos = this.getShelfCombos(i);
      if (combos && combos.length > 0) {
        return true;
      }
    }
    return false;
  }

  // Get total number of device combos across all shelves
  getTotalDeviceCombos(): number {
    let total = 0;
    for (let i = 0; i < this.shelves.length; i++) {
      const combos = this.getShelfCombos(i);
      total += combos?.length || 0;
    }
    return total;
  }

  // Update device combo details when device/template is selected
  updateComboDetails(shelfIndex: number, comboIndex: number): void {
    const combos = this.getShelfCombos(shelfIndex);
    if (!combos || comboIndex >= combos.length) return;

    const combo = combos.at(comboIndex);
    const deviceId = combo.get('deviceId')?.value;
    const templateId = combo.get('templateId')?.value;

    if (deviceId) {
      const device = this.localDevices.find(d => d.id === deviceId);
      if (device) {
        combo.get('deviceName')?.setValue(device.deviceName || '');
        combo.get('screenSize')?.setValue(device.screenSize || '');
      }
    }

    if (templateId) {
      const template = this.localTemplates.find(t => t.id === templateId);
      if (template) {
        combo.get('templateName')?.setValue(template.name || '');
      }
    }
  }

  // Toggle combo details visibility
  toggleComboDetails(shelfIndex: number, comboIndex: number): void {
    const combos = this.getShelfCombos(shelfIndex);
    if (!combos || comboIndex >= combos.length) return;

    const combo = combos.at(comboIndex);
    const currentValue = combo.get('showDetails')?.value;
    combo.get('showDetails')?.setValue(!currentValue);
  }

  // Check if a specific shelf has any device combos
  shelfHasDeviceCombos(shelfIndex: number): boolean {
    const combos = this.getShelfCombos(shelfIndex);
    return combos && combos.length > 0;
  }

  // Form Validation Methods
  private isShelfFilled(shelfForm: FormGroup): boolean {
    return Object.keys(shelfForm.controls).some(key => {
      if (key === 'deviceCombos') return false; // Skip combos for basic validation
      const value = shelfForm.get(key)?.value;
      return value !== null && value !== '' && value !== false;
    });
  }

  private areShelvesValid(): boolean {
    for (let i = 0; i < this.shelves.length; i++) {
      const shelf = this.shelves.at(i) as FormGroup;
      if (this.isShelfFilled(shelf)) {
        if (shelf.invalid) {
          return false;
        }
      }
    }
    return true;
  }

  get canSubmit(): boolean {
    return this.aisleForm.valid && this.areShelvesValid();
  }

  // Submit Method
  onSubmit(): void {
    if (this.aisleForm.valid) {
      this.isSubmitting = true;
      const formValue = this.aisleForm.value;

      const aisleData: AisleMaster = {
        name: formValue.name,
        description: formValue.description,
        location: formValue.location,
        coordinates: formValue.coordinates,
        isActive: formValue.isActive,
        createdUser: this.currentUserId,
        shelves: formValue.shelves.map((shelf: any, index: number) => ({
          name: shelf.name,
          location: shelf.location,
          coordinates: shelf.coordinates,
          ipAddress: shelf.ipAddress,
          deviceName: shelf.deviceName,
          macAddress: shelf.macAddress,
          description: shelf.description,
          isActive: shelf.isActive,
          createdUser: this.currentUserId,
          deviceCombos: shelf.deviceCombos || [] // Include combos
        }))
      };

      // Create the aisle first
      this.aisleService.createAisle(aisleData).subscribe({
        next: (response) => {
          console.log('create aisle res', response);

          if (response?.id && response?.shelves?.length) {
            this.createAllDeviceAssignments(response, formValue.shelves);
          }
        },
        error: () => {
          this.isSubmitting = false;
          this.showError('Failed to create aisle.');
        }
      });

    } else {
      this.markFormGroupTouched();
    }
  }

  // private createAllDeviceAssignments(aisleId: number, shelves: any[]): void {
  //   console.log("called to create assignments",aisleId,shelves);
  //   const assignmentPromises: Promise<void>[] = [];

  //   shelves.forEach((shelf, shelfIndex) => {
  //     const deviceCombos = shelf.deviceCombos || [];

  //     deviceCombos.forEach((combo: any, comboIndex: number) => {
  //       if (combo.deviceId && combo.templateId) {
  //         const promise = new Promise<void>((resolve, reject) => {
  //           // Create device-template combo
  //           this.deviceService.createDeviceTemplateCombo(
  //             combo.deviceId,
  //             combo.templateId,
  //             false
  //           ).subscribe({
  //             next: (newCombo) => {
  //               // Assign combo to shelf (using the specific shelf as location)
  //               this.deviceService.assignComboToLocationWithDetails(
  //                   'TEMPLATE',
  //                 newCombo.id,
  //                 'SHELF',
  //                 aisleId, // You might need to pass shelf ID instead
  //                 this.currentUserId,
  //                 1,
  //                 this.storeId
  //               ).subscribe({
  //                 next: () => resolve(),
  //                 error: (err) => reject(err)
  //               });
  //             },
  //             error: (err) => reject(err)
  //           });
  //         });
  //         assignmentPromises.push(promise);
  //       }
  //     });
  //   });

  //   if (assignmentPromises.length > 0) {
  //     Promise.all(assignmentPromises)
  //       .then(() => {
  //         this.isSubmitting = false;
  //         this.showSuccess(`Aisle created successfully with ${assignmentPromises.length} device assignment(s)!`);
  //         this.dialogRef.close({ 
  //           success: true, 
  //           aisleId: aisleId, 
  //           assignmentsCount: assignmentPromises.length 
  //         });
  //       })
  //       .catch(err => {
  //         this.isSubmitting = false;
  //         console.error('Error creating device assignments:', err);
  //         this.showSuccess('Aisle created, but failed to create some device assignments');
  //         this.dialogRef.close({ 
  //           success: true, 
  //           aisleId: aisleId, 
  //           assignmentsCount: assignmentPromises.length,
  //           assignmentsError: true 
  //         });
  //       });
  //   } else {
  //     this.isSubmitting = false;
  //     this.showSuccess('Aisle created successfully!');
  //     this.dialogRef.close({ 
  //       success: true, 
  //       aisleId: aisleId 
  //     });
  //   }
  // }

  private createAllDeviceAssignments(
    response: any,
    shelves: any[]
  ): void {

    const assignmentPromises: Promise<void>[] = [];

    response.shelves.forEach((savedShelf: any, shelfIndex: number) => {

      const shelfForm = shelves[shelfIndex];
      const deviceCombos = shelfForm.deviceCombos || [];

      deviceCombos.forEach((combo: any) => {
        if (combo.deviceId && combo.templateId) {

          const promise = new Promise<void>((resolve, reject) => {

            this.deviceService.createDeviceTemplateCombo(
              combo.deviceId,
              combo.templateId,
              false
            ).subscribe({
              next: (newCombo) => {

                // ✅ USE SHELF ID HERE
                this.deviceService.assignComboToLocationWithDetails(
                  'TEMPLATE',
                  newCombo.id,
                  'SHELF',
                  savedShelf.id,   // ✅ CORRECT
                  this.currentUserId,
                  1,
                  this.storeId
                ).subscribe({
                  next: () => resolve(),
                  error: err => reject(err)
                });
              },
              error: err => reject(err)
            });

          });

          assignmentPromises.push(promise);
        }
      });
    });

    Promise.all(assignmentPromises)
      .then(() => {
        this.isSubmitting = false;
        this.showSuccess('Aisle and shelf assignments created successfully!');
        this.dialogRef.close({ success: true });
      })
      .catch(err => {
        this.isSubmitting = false;
        console.error(err);
        this.showError('Aisle created, but some assignments failed');
        this.dialogRef.close({ success: true, partial: true });
      });
  }


  // onCancel(): void {
  //   // Check if any combos exist
  //   if (this.hasDeviceCombos()) {
  //     if (confirm('You have unsaved device assignments. Are you sure you want to cancel?')) {
  //       this.dialogRef.close();
  //     }
  //   } else {
  //     this.dialogRef.close();
  //   }
  // }

  async onCancel(): Promise<void> {
    if (this.hasDeviceCombos()) {
      const confirmed = await this.openConfirmationDialog();
      if (!confirmed) {
        return; // User chose not to cancel
      }
    }

    // Proceed with cancellation
    this.closeDialogOrNavigateAway();
  }

  private async openConfirmationDialog(): Promise<boolean> {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Unsaved Changes',
        message: 'You have unsaved device assignments. Are you sure you want to cancel?',
        confirmText: 'Yes, Cancel',
        cancelText: 'No, Keep Editing',
        confirmColor: 'warn'
      }
    });

    return dialogRef.afterClosed().toPromise();
  }

  private closeDialogOrNavigateAway(): void {
    // If you're in a dialog component
    if (this.dialogRef) {
      this.dialogRef.close();
    } else {
      // Or navigate away, clear form, etc.
      // this.router.navigate(['/some-route']);
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.aisleForm.controls).forEach(key => {
      const control = this.aisleForm.get(key);
      control?.markAsTouched();

      if (control instanceof FormArray) {
        control.controls.forEach((shelfControl, shelfIndex) => {
          if (shelfControl instanceof FormGroup) {
            Object.keys(shelfControl.controls).forEach(nestedKey => {
              const nestedControl = shelfControl.get(nestedKey);
              nestedControl?.markAsTouched();

              // Also mark device combos as touched
              if (nestedKey === 'deviceCombos' && nestedControl instanceof FormArray) {
                nestedControl.controls.forEach(comboControl => {
                  if (comboControl instanceof FormGroup) {
                    Object.keys(comboControl.controls).forEach(comboKey => {
                      comboControl.get(comboKey)?.markAsTouched();
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  getFieldError(fieldName: string, shelfIndex?: number): string {
    let control;

    if (shelfIndex !== undefined) {
      control = this.shelves.at(shelfIndex).get(fieldName);
    } else {
      control = this.aisleForm.get(fieldName);
    }

    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return `${fieldName} is required`;
      }
      if (control.errors['maxlength']) {
        return `${fieldName} is too long`;
      }
      if (control.errors['pattern']) {
        return `Invalid ${fieldName} format`;
      }
    }
    return '';
  }

  // Snackbar Methods
  private showSuccess(message: string): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 5000
    });
  }

  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000
    });
  }

  private showWarning(message: string): void {
    this.messageService.add({
      severity: 'warn',
      summary: 'Warning',
      detail: message,
      life: 5000
    });
  }

  private showInfo(message: string): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: message,
      life: 5000
    });
  }
  // private showSuccess(message: string): void {
  //   this.openSnackbar({
  //     message: message,
  //     icon: 'fa-check-circle',
  //     type: 'success'
  //   });
  // }

  // private showError(message: string): void {
  //   this.openSnackbar({
  //     message: message,
  //     icon: 'fas fa-times-circle',
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
}