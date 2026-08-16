import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import {
  MinewDeviceDto,
  MinewTemplateDto,
  DeviceTemplateComboDto,
  AssignmentDto,
  BindDataRequest,
  CreateComboRequest,
  LocalTemplateDto,
  LocalDeviceDto,
  BindShelfDataRequest,
  UnifiedBindDataRequest,
  BatchAddDeviceRequest,
  BatchAddResult,
  BatchWakeDevicesRequest,
  BatchWakeResult,
  DeviceMessageComboDto,
  DeviceMessageComboPagedRequest,
  DeviceAssignmentDto,
  UpdateDeviceRequest,
  CreateDeviceRequest,
  DeviceScreenDto,
  EslBrandDto,
} from '../interfaces/device.interface';
import { environment } from '../../../environments/environment';
import { MinewStore } from '../interfaces/minew.interface';
import {
  AssignmentSearchParams,
  ComboSearchParams,
  PagedResult,
  SearchParams,
} from '../interfaces/pagination-result.interface';
import { HttpResponseData } from '../interfaces/http-response.interface';
import {
  DeviceScreenDimensionResponse,
  CreateDeviceScreenDimensionRequest,
  UpdateDeviceScreenDimensionRequest,
} from '../interfaces/device-screen-dimension.interface';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  //#region Properties and Constructor
  private readonly API_URL =
    environment.apiUrl || 'https://localhost:44321/api';

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
      }),
    };
  }

  constructor(private http: HttpClient) {}
  //#endregion

  // Store lists come from StoreService. getStores/getActiveStores/
  // getStoresforrack/getActiveStoresrack used to live here backed by
  // /device/stores; that endpoint was removed along with the Minew store pull,
  // and it served cloud ids anyway - every device endpoint keys off the local
  // StoreMaster id.

  //#region Device Management - Cloud Sync & Operations
  /**
   * Fills in screen dimensions for a store's devices from Minew. A device added
   * locally has no screen - the panel size is only knowable from the cloud.
   */
  refreshDeviceScreens(
    storeId: number,
  ): Observable<{ message: string; updated: number }> {
    const params = new HttpParams().set('storeId', storeId);

    return this.http.post<{ message: string; updated: number }>(
      `${this.API_URL}/device/devices/refresh-screens`,
      {},
      { params },
    );
  }

  syncDevicesFromCloud(
    storeId: number,
    eqstatus: string = '2,8,9',
  ): Observable<MinewDeviceDto[]> {
    const params = new HttpParams()
      .set('storeId', storeId)
      .set('eqstatus', eqstatus);

    return this.http
      .get<MinewDeviceDto[]>(`${this.API_URL}/device/devices/sync`, { params })
      .pipe(
        map((devices) =>
          devices.map((device) => ({
            ...device,
            isOnline: device.status === 'Online',
          })),
        ),
      );
  }

  lightUpDevice(
    mac: string,
    storeId: number,
    color: number = 1,
  ): Observable<any> {
    const params = new HttpParams()
      .set('mac', mac)
      .set('storeId', storeId)
      .set('color', color.toString());

    return this.http.get(`${this.API_URL}/device/devices/light-up`, { params });
  }

  identifyDevice(mac: string, storeId: number): void {
    this.lightUpDevice(mac, storeId, 1).subscribe();
  }
  //#endregion

  //#region Template Management - Cloud Sync
  syncTemplatesFromCloud(storeId: number): Observable<MinewTemplateDto[]> {
    const params = new HttpParams().set('storeId', storeId);
    return this.http.get<MinewTemplateDto[]>(
      `${this.API_URL}/device/templates/sync`,
      { params },
    );
  }

  getTemplatePreview(
    templateId: string,
    isBound: boolean = false,
    mac?: string,
    storeId?: string,
  ): Observable<string> {
    const request = {
      templateId,
      isBound,
      mac,
      storeId,
    };

    return this.http
      .post<{
        data: string;
      }>(`${this.API_URL}/device/templates/preview`, request)
      .pipe(map((response) => response.data));
  }
  //#endregion

  //#region Device-Template Combo Management
  getDeviceTemplateCombos(): Observable<DeviceTemplateComboDto[]> {
    return this.http.get<DeviceTemplateComboDto[]>(
      `${this.API_URL}/device/combos`,
    );
  }

  deleteCombo(
    id: number,
    userId: number,
  ): Observable<{ success: boolean; message: string }> {
    return this.http
      .delete<
        HttpResponseData<boolean>
      >(`${this.API_URL}/device/combos/${id}/user/${userId}`)
      .pipe(
        map((response) => ({
          success: response.success,
          message: response.message,
        })),
        // A combo still used by an active assignment is refused with 409 and
        // carries the reason in the body. Surface that rather than the generic
        // text, which told the user nothing about why the delete was blocked.
        catchError((error: HttpErrorResponse) =>
          of({
            success: false,
            message: error?.error?.message ?? 'Failed to delete combo',
          }),
        ),
      );
  }

  getDeviceTemplateComboById(
    id: number,
  ): Observable<HttpResponseData<DeviceTemplateComboDto>> {
    return this.http.get<HttpResponseData<DeviceTemplateComboDto>>(
      `${this.API_URL}/device/combos/${id}`,
    );
  }

  updateDeviceTemplateCombo(
    id: number,
    dto: {
      deviceId: number;
      templateId: string;
      isDefault?: boolean;
      isActive?: boolean;
    },
  ): Observable<DeviceTemplateComboDto> {
    return this.http
      .put<HttpResponseData<DeviceTemplateComboDto>>(
        `${this.API_URL}/device/combos/${id}`,
        dto,
        {
          headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        },
      )
      .pipe(
        map((response) => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(
              response.error || response.message || 'Failed to update shelf',
            );
          }
        }),
        catchError(this.handleError),
      );
  }
  //#endregion

  //#region Assignment Management
  getAssignments(
    locationType: string,
    locationId: number,
  ): Observable<AssignmentDto[]> {
    return this.http
      .get<
        HttpResponseData<AssignmentDto[]>
      >(`${this.API_URL}/device/assignments/${locationType}/${locationId}`)
      .pipe(
        map((response) => {
          if (response && response.success && response.result) {
            return response.result;
          }
          console.warn(
            'No assignments found or invalid response structure:',
            response,
          );
          return [];
        }),
        catchError((error) => {
          console.error('Error fetching assignments:', error);
          return of([]);
        }),
      );
  }

  removeAssignment(assignmentId: number): Observable<any> {
    return this.http.delete(
      `${this.API_URL}/device/assignments/${assignmentId}`,
    );
  }

  updateAssignmentOrder(
    assignmentId: number,
    newPosition: number,
    userId: number = 1,
  ): Observable<any> {
    return this.http.put(
      `${this.API_URL}/device/assignments/${assignmentId}/order`,
      {
        newPosition,
        userId,
      },
    );
  }

  deleteAssignment(
    assignmentId: number,
  ): Observable<{ success: boolean; message: string }> {
    return this.http
      .delete<
        HttpResponseData<object>
      >(`${this.API_URL}/device/assignments/${assignmentId}`)
      .pipe(
        map((response) => ({
          success: response.success,
          message: response.message,
        })),
        catchError((error) =>
          of({
            success: false,
            message: error?.message || 'Failed to delete assignment',
          }),
        ),
      );
  }

  assignComboToLocation(
    comboId: number,
    locationType: string,
    locationId: number,
    userId: number = 1,
  ): Observable<AssignmentDto> {
    return this.http.post<AssignmentDto>(`${this.API_URL}/device/assignments`, {
      deviceTemplateComboId: comboId,
      locationType,
      locationId,
      userId,
    });
  }

  assignComboToLocationWithDetails(
    assignmentType: 'TEMPLATE' | 'MESSAGE',
    comboId: number,
    locationType: string,
    locationId: number,
    userId: number,
    displayOrder?: number,
    storeId?: number,
    isActive?: boolean,
  ): Observable<AssignmentDto> {
    const payload: any = {
      assignmentType,
      locationType,
      locationId,
      userId,
      storeId,
    };

    if (assignmentType === 'TEMPLATE') {
      payload.deviceTemplateComboId = comboId;
    }

    if (assignmentType === 'MESSAGE') {
      payload.deviceMessageComboId = comboId;
    }

    if (displayOrder !== undefined) payload.displayOrder = displayOrder;
    if (isActive !== undefined) payload.isActive = isActive;

    return this.http.post<AssignmentDto>(
      `${this.API_URL}/device/assignments`,
      payload,
    );
  }

  updateAssignment(assignmentId: number, data: any): Observable<AssignmentDto> {
    return this.http.put<AssignmentDto>(
      `${this.API_URL}/assignments/${assignmentId}`,
      data,
    );
  }
  //#endregion

  //#region Bind Data Operations
  bindDataToDevice(request: BindDataRequest): Observable<any> {
    return this.http.post(`${this.API_URL}/device/bind`, request);
  }

  quickBindProduct(productId: number, comboId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/device/bind/quick-product`, {
      productId,
      comboId,
    });
  }

  batchBind(assignments: any[]): Observable<any> {
    return this.http.post(`${this.API_URL}/device/bind/batch`, { assignments });
  }

  bindData(bindRequest: any): Observable<any> {
    return this.http.post(
      `${this.API_URL}/device/bind`,
      bindRequest,
      this.getHttpOptions(),
    );
  }

  testBindPreview(comboId: number, testData: any): Observable<any> {
    return this.http.post(
      `${this.API_URL}/device/bind/test-preview`,
      {
        comboId: comboId,
        testData: testData,
      },
      this.getHttpOptions(),
    );
  }

  bindDataToShelf(request: BindShelfDataRequest): Observable<any> {
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
      }),
    };

    return this.http
      .post(`${this.API_URL}/device/bind-shelf`, request, httpOptions)
      .pipe(
        catchError((error) => {
          console.error('Error binding shelf data:', error);
          throw error;
        }),
      );
  }

  bindDataUnified(request: UnifiedBindDataRequest): Observable<any> {
    return this.http
      .post(`${this.API_URL}/device/bind-unified`, request, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
        }),
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          // 🔑 Extract backend message
          const backendMsg =
            error?.error?.message || error?.error?.msg || 'Bind failed';

          console.error('Unified bind error:', backendMsg, error);

          // Re-throw a clean error message
          return throwError(() => backendMsg);
        }),
      );
  }

  // bindDataUnified(request: UnifiedBindDataRequest): Observable<any> {
  //     const httpOptions = {
  //         headers: new HttpHeaders({
  //             'Content-Type': 'application/json'
  //         })
  //     };

  //     return this.http.post(
  //         `${this.API_URL}/device/bind-unified`,
  //         request,
  //         httpOptions
  //     ).pipe(
  //         catchError((error) => {
  //             console.error('Error in unified bind:', error);
  //             throw error;
  //         })
  //     );
  // }
  //#endregion

  //#region Local Device Management
  // These two now answer with the standard response envelope, like every other
  // read. Unwrapping here keeps the callers' contract (a plain array) unchanged.
  getLocalDevices(): Observable<LocalDeviceDto[]> {
    return this.http
      .get<HttpResponseData<LocalDeviceDto[]>>(
        `${this.API_URL}/device/devices/local`,
      )
      .pipe(map((res) => res?.result ?? []));
  }

  getLocalTemplates(): Observable<LocalTemplateDto[]> {
    return this.http
      .get<HttpResponseData<LocalTemplateDto[]>>(
        `${this.API_URL}/device/template/local`,
      )
      .pipe(map((res) => res?.result ?? []));
  }

  createDeviceTemplateCombo(
    deviceId: number,
    templateId: string,
    isDefault: boolean = false,
  ): Observable<DeviceTemplateComboDto> {
    return this.http.post<DeviceTemplateComboDto>(
      `${this.API_URL}/device/combos`,
      {
        deviceId,
        templateId,
        isDefault,
      },
    );
  }

  createCombo(comboRequest: CreateComboRequest): Observable<any> {
    return this.http.post<any>(
      `${this.API_URL}/device//devices/combos`,
      comboRequest,
    );
  }

  getComboDetails(comboId: number): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/combos/${comboId}`);
  }
  //#endregion

  //#region Paged Data Queries - Devices
  getLocalDevicesPaged(
    request: SearchParams,
  ): Observable<HttpResponseData<PagedResult<LocalDeviceDto>>> {
    let params = new HttpParams();

    if (request.pageNumber)
      params = params.set('pageNumber', request.pageNumber.toString());
    if (request.pageSize)
      params = params.set('pageSize', request.pageSize.toString());
    if (request.searchTerm)
      params = params.set('searchTerm', request.searchTerm);
    if (request.status)
      params = params.set('status', request.status.toString());
    // DevicePagedRequest filters on both of these server-side; without them the
    // ESL Brand picker in the product/queue forms had no effect on the list.
    if (request.storeId)
      params = params.set('storeId', request.storeId.toString());
    if (request.brandId)
      params = params.set('brandId', request.brandId.toString());

    return this.http.get<HttpResponseData<PagedResult<LocalDeviceDto>>>(
      `${this.API_URL}/device/devices/local/paged`,
      { params },
    );
  }

  getLocalDevicesPagedbyStore(
    storeId: number,
    pageNumber: number = 1,
    pageSize: number = 5,
    searchTerm: string = '',
    sortBy?: string,
    sortDescending?: boolean,
    filters?: any,
  ): Observable<PagedResult<LocalDeviceDto>> {
    let params = new HttpParams()
      .set('PageNumber', pageNumber.toString())
      .set('PageSize', pageSize.toString())
      .set('StoreId', storeId);

    if (searchTerm) {
      params = params.set('SearchTerm', searchTerm);
    }

    if (sortBy) {
      params = params.set('SortBy', sortBy);
    }

    if (sortDescending !== undefined) {
      params = params.set('SortDescending', sortDescending.toString());
    }

    if (filters) {
      Object.keys(filters).forEach((key) => {
        params = params.set(key, filters[key]);
      });
    }

    return this.http
      .get<any>(`${this.API_URL}/device/devices/local/paged`, { params })
      .pipe(
        map((fullResponse) => {
          console.log('Full devices API response:', fullResponse);

          const result = fullResponse.result;
          console.log('Extracted result:', result);

          if (result && result.items) {
            return {
              items: result.items,
              totalCount: result.totalCount || 0,
              pageNumber: result.pageNumber || pageNumber,
              pageSize: result.pageSize || pageSize,
              totalPages: result.totalPages || 1,
              searchTerm: result.searchTerm || searchTerm,
              hasPreviousPage: result.hasPreviousPage || false,
              hasNextPage: result.hasNextPage || false,
              hasResults: result.hasResults || false,
            };
          } else if (fullResponse.items) {
            return {
              items: fullResponse.items,
              totalCount: fullResponse.totalCount || 0,
              pageNumber: fullResponse.pageNumber || pageNumber,
              pageSize: fullResponse.pageSize || pageSize,
              totalPages: fullResponse.totalPages || 1,
              searchTerm: fullResponse.searchTerm || searchTerm,
              hasPreviousPage: fullResponse.hasPreviousPage || false,
              hasNextPage: fullResponse.hasNextPage || false,
              hasResults: fullResponse.hasResults || false,
            };
          } else {
            return {
              items: [],
              totalCount: 0,
              pageNumber: pageNumber,
              pageSize: pageSize,
              totalPages: 0,
              searchTerm: searchTerm,
              hasPreviousPage: false,
              hasNextPage: false,
              hasResults: false,
            };
          }
        }),
        catchError((error) => {
          console.error('Error loading devices:', error);
          return of({
            items: [],
            totalCount: 0,
            pageNumber: pageNumber,
            pageSize: pageSize,
            totalPages: 0,
            searchTerm: searchTerm,
            hasPreviousPage: false,
            hasNextPage: false,
            hasResults: false,
          });
        }),
      );
  }
  //#endregion

  //#region Paged Data Queries - Templates
  getLocalTemplatesPaged(
    request: SearchParams,
  ): Observable<HttpResponseData<PagedResult<LocalTemplateDto>>> {
    let params = new HttpParams();

    if (request.pageNumber)
      params = params.set('pageNumber', request.pageNumber.toString());
    if (request.pageSize)
      params = params.set('pageSize', request.pageSize.toString());
    if (request.searchTerm)
      params = params.set('searchTerm', request.searchTerm);

    return this.http.get<HttpResponseData<PagedResult<LocalTemplateDto>>>(
      `${this.API_URL}/device/template/local/paged`,
      { params },
    );
  }

  getLocalTemplatesPagedByStore(
    storeId: number,
    pageNumber: number = 1,
    pageSize: number = 5,
    searchTerm: string = '',
  ): Observable<PagedResult<LocalTemplateDto>> {
    let params = new HttpParams()
      .set('PageNumber', pageNumber.toString())
      .set('PageSize', pageSize.toString())
      .set('StoreId', storeId.toString());

    if (searchTerm) {
      params = params.set('SearchTerm', searchTerm);
    }

    return this.http
      .get<
        HttpResponseData<PagedResult<LocalTemplateDto>>
      >(`${this.API_URL}/device/template/local/paged`, { params })
      .pipe(
        map((response) => {
          const result = response.result;

          if (result) {
            return {
              items: result.items ?? [],
              totalCount: result.totalCount ?? 0,
              pageNumber: result.pageNumber ?? pageNumber,
              pageSize: result.pageSize ?? pageSize,
              totalPages:
                result.totalPages ??
                Math.ceil((result.totalCount ?? 0) / pageSize),
              searchTerm: result.searchTerm ?? searchTerm,
              hasPreviousPage: result.hasPreviousPage ?? false,
              hasNextPage: result.hasNextPage ?? false,
              hasResults: (result.items?.length ?? 0) > 0,
            };
          }

          return {
            items: [],
            totalCount: 0,
            pageNumber,
            pageSize,
            totalPages: 0,
            searchTerm,
            hasPreviousPage: false,
            hasNextPage: false,
            hasResults: false,
          };
        }),
        catchError((err) => {
          console.error('Error loading templates:', err);
          return of({
            items: [],
            totalCount: 0,
            pageNumber,
            pageSize,
            totalPages: 0,
            searchTerm,
            hasPreviousPage: false,
            hasNextPage: false,
            hasResults: false,
          });
        }),
      );
  }
  //#endregion

  //#region Paged Data Queries - Combos
  getCombosPaged(
    request: ComboSearchParams,
  ): Observable<HttpResponseData<PagedResult<DeviceTemplateComboDto>>> {
    let params = new HttpParams();

    if (request.pageNumber)
      params = params.set('PageNumber', request.pageNumber.toString());
    if (request.pageSize)
      params = params.set('PageSize', request.pageSize.toString());
    if (request.searchTerm)
      params = params.set('SearchTerm', request.searchTerm);

    if (request.sortBy) params = params.set('SortBy', request.sortBy);
    if (request.sortDescending !== undefined)
      params = params.set('SortDescending', request.sortDescending.toString());

    if (request.deviceId)
      params = params.set('DeviceId', request.deviceId.toString());
    if (request.templateId)
      params = params.set('TemplateId', request.templateId);
    if (request.isDefault !== undefined)
      params = params.set('IsDefault', request.isDefault.toString());
    if (request.isActive !== undefined)
      params = params.set('IsActive', request.isActive.toString());

    console.log('Combo search params being sent:', {
      deviceId: request.deviceId,
      templateId: request.templateId,
      isDefault: request.isDefault,
      isActive: request.isActive,
      fullParams: params.toString(),
    });

    return this.http.get<HttpResponseData<PagedResult<DeviceTemplateComboDto>>>(
      `${this.API_URL}/device/combos/paged`,
      { params },
    );
  }
  //#endregion

  //#region Paged Data Queries - Assignments
  getAssignmentsPaged(
    params: AssignmentSearchParams,
  ): Observable<PagedResult<DeviceAssignmentDto>> {
    let httpParams = new HttpParams()
      .set('PageNumber', (params.pageNumber ?? 1).toString())
      .set('PageSize', (params.pageSize ?? 5).toString());

    if (params.searchTerm)
      httpParams = httpParams.set('SearchTerm', params.searchTerm);
    if (params.sortBy) httpParams = httpParams.set('SortBy', params.sortBy);
    if (params.sortDescending != null)
      httpParams = httpParams.set(
        'SortDescending',
        params.sortDescending.toString(),
      );

    if (params.assignmentType)
      httpParams = httpParams.set('AssignmentType', params.assignmentType);
    if (params.locationType)
      httpParams = httpParams.set('LocationType', params.locationType);
    if (params.locationId != null)
      httpParams = httpParams.set('LocationId', params.locationId.toString());
    if (params.deviceTemplateComboId != null)
      httpParams = httpParams.set(
        'DeviceTemplateComboId',
        params.deviceTemplateComboId.toString(),
      );
    if (params.deviceMessageComboId != null)
      httpParams = httpParams.set(
        'DeviceMessageComboId',
        params.deviceMessageComboId.toString(),
      );
    if (params.storeId != null)
      httpParams = httpParams.set('StoreId', params.storeId.toString());
    if (params.isActive != null)
      httpParams = httpParams.set('IsActive', params.isActive.toString());

    console.log('Fetching assignments with params:', {
      assignmentType: params.assignmentType,
      locationType: params.locationType,
      deviceTemplateComboId: params.deviceTemplateComboId,
      deviceMessageComboId: params.deviceMessageComboId,
      storeId: params.storeId,
      fullParams: httpParams.toString(),
    });

    return this.http
      .get<
        HttpResponseData<PagedResult<DeviceAssignmentDto>>
      >(`${this.API_URL}/device/assignments/paged`, { params: httpParams })
      .pipe(
        map((response) => ({
          items: response.result?.items ?? [],
          totalCount: response.result?.totalCount ?? 0,
          pageNumber: response.result?.pageNumber ?? params.pageNumber ?? 1,
          pageSize: response.result?.pageSize ?? params.pageSize ?? 5,
          totalPages:
            response.result?.totalPages ??
            Math.ceil(
              (response.result?.totalCount ?? 0) / (params.pageSize ?? 5),
            ),
          searchTerm: response.result?.searchTerm ?? params.searchTerm ?? '',
          hasPreviousPage: response.result?.hasPreviousPage ?? false,
          hasNextPage: response.result?.hasNextPage ?? false,
          hasResults: (response.result?.items?.length ?? 0) > 0,
        })),
        catchError((error) => {
          console.error('Error fetching assignments:', error);
          return of({
            items: [],
            totalCount: 0,
            pageNumber: params.pageNumber ?? 1,
            pageSize: params.pageSize ?? 5,
            totalPages: 0,
            searchTerm: params.searchTerm ?? '',
            hasPreviousPage: false,
            hasNextPage: false,
            hasResults: false,
          });
        }),
      );
  }
  //#endregion

  //#region Device-Message Combo Management
  getDeviceMessageCombosPaged(
    request: DeviceMessageComboPagedRequest,
  ): Observable<HttpResponseData<PagedResult<DeviceMessageComboDto>>> {
    let params = new HttpParams();

    if (request.pageNumber !== undefined) {
      params = params.set('PageNumber', request.pageNumber.toString());
    }

    if (request.pageSize !== undefined) {
      params = params.set('PageSize', request.pageSize.toString());
    }

    if (request.sortBy) {
      params = params.set('SortBy', request.sortBy);
    }

    if (request.sortDescending !== undefined) {
      params = params.set('SortDescending', request.sortDescending.toString());
    }

    if (request.searchTerm) {
      params = params.set('SearchTerm', request.searchTerm);
    }

    if (request.deviceId !== undefined) {
      params = params.set('DeviceId', request.deviceId.toString());
    }

    if (request.messageId !== undefined) {
      params = params.set('MessageId', request.messageId.toString());
    }

    if (request.isActive !== undefined) {
      params = params.set('IsActive', request.isActive.toString());
    }

    if (request.createdFrom) {
      const date =
        typeof request.createdFrom === 'string'
          ? request.createdFrom
          : this.formatDate(request.createdFrom);
      params = params.set('CreatedFrom', date);
    }

    if (request.createdTo) {
      const date =
        typeof request.createdTo === 'string'
          ? request.createdTo
          : this.formatDate(request.createdTo);
      params = params.set('CreatedTo', date);
    }

    return this.http
      .get<
        HttpResponseData<PagedResult<DeviceMessageComboDto>>
      >(`${this.API_URL}/device/messagecombo/paged`, { params })
      .pipe(catchError(this.handleError));
  }

  getDeviceMessageCombosPagedSimplified(
    request: DeviceMessageComboPagedRequest,
  ): Observable<PagedResult<DeviceMessageComboDto>> {
    let params = new HttpParams()
      .set('PageNumber', (request.pageNumber || 1).toString())
      .set('PageSize', (request.pageSize || 10).toString());

    if (request.sortBy) {
      params = params.set('SortBy', request.sortBy);
    }

    if (request.sortDescending !== undefined) {
      params = params.set('SortDescending', request.sortDescending.toString());
    }

    if (request.searchTerm) {
      params = params.set('SearchTerm', request.searchTerm);
    }

    if (request.deviceId !== undefined) {
      params = params.set('DeviceId', request.deviceId.toString());
    }

    if (request.messageId !== undefined) {
      params = params.set('MessageId', request.messageId.toString());
    }

    if (request.isActive !== undefined) {
      params = params.set('IsActive', request.isActive.toString());
    }

    return this.http
      .get<
        HttpResponseData<PagedResult<DeviceMessageComboDto>>
      >(`${this.API_URL}/device/messagecombo/paged`, { params })
      .pipe(
        map((response) => {
          const result = response.result;

          if (result) {
            return {
              items: result.items || [],
              totalCount: result.totalCount || 0,
              pageNumber: result.pageNumber || request.pageNumber || 1,
              pageSize: result.pageSize || request.pageSize || 10,
              totalPages:
                result.totalPages ||
                Math.ceil((result.totalCount || 0) / (request.pageSize || 10)),
              searchTerm: result.searchTerm || request.searchTerm || '',
              hasPreviousPage: result.hasPreviousPage || false,
              hasNextPage: result.hasNextPage || false,
              hasResults: (result.items?.length || 0) > 0,
            };
          }

          return {
            items: [],
            totalCount: 0,
            pageNumber: request.pageNumber || 1,
            pageSize: request.pageSize || 10,
            totalPages: 0,
            searchTerm: request.searchTerm || '',
            hasPreviousPage: false,
            hasNextPage: false,
            hasResults: false,
          };
        }),
        catchError((error) => {
          console.error('Error loading device-message combos:', error);
          return of({
            items: [],
            totalCount: 0,
            pageNumber: request.pageNumber || 1,
            pageSize: request.pageSize || 10,
            totalPages: 0,
            searchTerm: request.searchTerm || '',
            hasPreviousPage: false,
            hasNextPage: false,
            hasResults: false,
          });
        }),
      );
  }

  getDeviceMessageCombosPagedByParams(
    params: SearchParams & {
      deviceId?: number;
      messageId?: number;
      isActive?: boolean;
    },
  ): Observable<PagedResult<DeviceMessageComboDto>> {
    let httpParams = new HttpParams()
      .set('PageNumber', (params.pageNumber || 1).toString())
      .set('PageSize', (params.pageSize || 10).toString());

    if (params.searchTerm) {
      httpParams = httpParams.set('SearchTerm', params.searchTerm);
    }

    if (params.sortBy) {
      httpParams = httpParams.set('SortBy', params.sortBy);
    }

    if (params.sortDescending !== undefined) {
      httpParams = httpParams.set(
        'SortDescending',
        params.sortDescending.toString(),
      );
    }

    if (params.deviceId !== undefined) {
      httpParams = httpParams.set('DeviceId', params.deviceId);
    }

    if (params.messageId !== undefined) {
      httpParams = httpParams.set('MessageId', params.messageId.toString());
    }

    if (params.isActive !== undefined) {
      httpParams = httpParams.set('IsActive', params.isActive.toString());
    }

    return this.http
      .get<
        HttpResponseData<PagedResult<DeviceMessageComboDto>>
      >(`${this.API_URL}/device/messagecombo/paged`, { params: httpParams })
      .pipe(
        map((response) => ({
          items: response.result?.items ?? [],
          totalCount: response.result?.totalCount ?? 0,
          pageNumber: response.result?.pageNumber ?? params.pageNumber ?? 1,
          pageSize: response.result?.pageSize ?? params.pageSize ?? 10,
          totalPages:
            response.result?.totalPages ??
            Math.ceil(
              (response.result?.totalCount ?? 0) / (params.pageSize ?? 10),
            ),
          searchTerm: response.result?.searchTerm ?? params.searchTerm ?? '',
          hasPreviousPage: response.result?.hasPreviousPage ?? false,
          hasNextPage: response.result?.hasNextPage ?? false,
          hasResults: (response.result?.items?.length ?? 0) > 0,
        })),
        catchError(() =>
          of({
            items: [],
            totalCount: 0,
            pageNumber: params.pageNumber ?? 1,
            pageSize: params.pageSize ?? 10,
            totalPages: 0,
            searchTerm: params.searchTerm ?? '',
            hasPreviousPage: false,
            hasNextPage: false,
            hasResults: false,
          }),
        ),
      );
  }

  //   createDeviceMessageCombo(dto: {
  //     deviceId: number;
  //     messageId: number;
  //     storeId: number;
  //     isActive?: boolean;
  //   }): Observable<HttpResponseData<DeviceMessageComboDto>> {
  //     console.log('Creating device-message combo with DTO:', dto);
  //     return this.http.post<HttpResponseData<DeviceMessageComboDto>>(
  //       `${this.API_URL}/device/messagecombo`,
  //       dto,
  //     );
  //   }

  createDeviceMessageCombo(dto: {
    deviceId: number;
    messageId: any;
    storeId: number;
    isActive?: boolean;
  }): Observable<HttpResponseData<DeviceMessageComboDto>> {
    const payload = {
      deviceId: dto.deviceId,
      messageId:
        typeof dto.messageId === 'object' ? dto.messageId.id : dto.messageId,
      storeId: dto.storeId,
      isActive: dto.isActive ?? true,
    };

    console.log('Creating device-message combo with DTO:', payload);

    return this.http.post<HttpResponseData<DeviceMessageComboDto>>(
      `${this.API_URL}/device/messagecombo`,
      payload,
    );
  }

  updateDeviceMessageCombo(
    id: number,
    dto: {
      deviceId?: number;
      messageId?: number;
      isActive?: boolean;
    },
  ): Observable<HttpResponseData<DeviceMessageComboDto>> {
    return this.http.put<HttpResponseData<DeviceMessageComboDto>>(
      `${this.API_URL}/device/messagecombo/${id}`,
      dto,
    );
  }

  deleteDeviceMessageCombo(id: number): Observable<HttpResponseData<object>> {
    return this.http.delete<HttpResponseData<object>>(
      `${this.API_URL}/device/messagecombo/${id}`,
    );
  }

  deleteMessageCombo(
    id: number,
    userId: number,
  ): Observable<{ success: boolean; message: string }> {
    return this.http
      .delete<
        HttpResponseData<boolean>
      >(`${this.API_URL}/device/messagecombo/${id}/user/${userId}`)
      .pipe(
        map((response) => ({
          success: response.success,
          message: response.message,
        })),
        catchError(() =>
          of({ success: false, message: 'Failed to delete message combo' }),
        ),
      );
  }

  getDeviceMessageCombosByDeviceId(
    deviceId: number,
  ): Observable<HttpResponseData<DeviceMessageComboDto[]>> {
    return this.http.get<HttpResponseData<DeviceMessageComboDto[]>>(
      `${this.API_URL}/device/messagecombo/device/${deviceId}`,
    );
  }

  getDeviceMessageCombosByMessageId(
    messageId: number,
  ): Observable<HttpResponseData<DeviceMessageComboDto[]>> {
    return this.http.get<HttpResponseData<DeviceMessageComboDto[]>>(
      `${this.API_URL}/device/messagecombo/message/${messageId}`,
    );
  }

  deviceMessageComboExists(
    deviceId: number,
    messageId: number,
  ): Observable<HttpResponseData<boolean>> {
    const params = new HttpParams()
      .set('deviceId', deviceId.toString())
      .set('messageId', messageId.toString());

    return this.http.get<HttpResponseData<boolean>>(
      `${this.API_URL}/device/messagecombo/exists`,
      { params },
    );
  }

  getDeviceMessageComboCount(): Observable<HttpResponseData<number>> {
    return this.http.get<HttpResponseData<number>>(
      `${this.API_URL}/device/messagecombo/count`,
    );
  }

  deactivateDeviceMessageCombosByDeviceId(
    deviceId: number,
  ): Observable<HttpResponseData<object>> {
    return this.http.put<HttpResponseData<object>>(
      `${this.API_URL}/device/messagecombo/device/${deviceId}/deactivate`,
      {},
    );
  }
  //#endregion

  //#region Screen Management
  getDeviceScreensPaged(
    params: SearchParams,
  ): Observable<PagedResult<DeviceScreenDto>> {
    let httpParams = new HttpParams()
      .set('PageNumber', (params.pageNumber || 1).toString())
      .set('PageSize', (params.pageSize || 10).toString());

    if (params.searchTerm) {
      httpParams = httpParams.set('SearchTerm', params.searchTerm);
    }

    return this.http
      .get<
        HttpResponseData<PagedResult<DeviceScreenDto>>
      >(`${this.API_URL}/device/screen/paged`, { params: httpParams })
      .pipe(
        map((response) => ({
          items: response.result?.items || [],
          totalCount: response.result?.totalCount || 0,
          pageNumber: response.result?.pageNumber || params.pageNumber || 1,
          pageSize: response.result?.pageSize || params.pageSize || 10,
          totalPages: response.result?.totalPages || 1,
          searchTerm: response.result?.searchTerm || params.searchTerm || '',
          hasPreviousPage: response.result?.hasPreviousPage || false,
          hasNextPage: response.result?.hasNextPage || false,
          hasResults: (response.result?.items?.length || 0) > 0,
        })),
        catchError((error) => {
          console.error('Error loading device screens:', error);
          return of({
            items: [],
            totalCount: 0,
            pageNumber: params.pageNumber || 1,
            pageSize: params.pageSize || 10,
            totalPages: 0,
            searchTerm: params.searchTerm || '',
            hasPreviousPage: false,
            hasNextPage: false,
            hasResults: false,
          });
        }),
      );
  }

  getAvailableScreens(): Observable<DeviceScreenDto[]> {
    return this.http
      .get<
        HttpResponseData<DeviceScreenDto[]>
      >(`${this.API_URL}/device/screen/available`)
      .pipe(
        map((response) => response.result || []),
        catchError(() => of([])),
      );
  }
  //#endregion

  //#region Device Screen Dimensions
  getDeviceScreenDimensions(
    deviceId: number,
  ): Observable<DeviceScreenDimensionResponse[]> {
    return this.http.get<DeviceScreenDimensionResponse[]>(
      `${this.API_URL}/device/devices/${deviceId}/screen-dimensions`,
    );
  }

  createDeviceScreenDimension(
    deviceId: number,
    request: CreateDeviceScreenDimensionRequest,
  ): Observable<DeviceScreenDimensionResponse> {
    return this.http.post<DeviceScreenDimensionResponse>(
      `${this.API_URL}/device/devices/${deviceId}/screen-dimensions`,
      request,
    );
  }

  updateDeviceScreenDimension(
    dimensionId: number,
    request: UpdateDeviceScreenDimensionRequest,
  ): Observable<DeviceScreenDimensionResponse> {
    return this.http.put<DeviceScreenDimensionResponse>(
      `${this.API_URL}/device/screen-dimensions/${dimensionId}`,
      request,
    );
  }

  deleteDeviceScreenDimension(
    dimensionId: number,
    userId: number,
  ): Observable<any> {
    return this.http.delete(
      `${this.API_URL}/device/screen-dimensions/${dimensionId}/user/${userId}`,
    );
  }
  //#endregion

  //#region Device CRUD Operations
  getDeviceById(id: number): Observable<LocalDeviceDto> {
    return this.http
      .get<
        HttpResponseData<LocalDeviceDto>
      >(`${this.API_URL}/device/device/${id}`)
      .pipe(
        map((response) => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(
              response.error ||
                response.message ||
                `Device with ID ${id} not found`,
            );
          }
        }),
        catchError(this.handleError),
      );
  }

  getTemplateById(id: string): Observable<LocalTemplateDto> {
    return this.http
      .get<
        HttpResponseData<LocalTemplateDto>
      >(`${this.API_URL}/device/template/${id}`)
      .pipe(
        map((response) => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(
              response.error ||
                response.message ||
                `Template with ID ${id} not found`,
            );
          }
        }),
        catchError(this.handleError),
      );
  }

  getBrands(): Observable<EslBrandDto[]> {
    return this.http
      .get<
        HttpResponseData<EslBrandDto[]>
      >(`${this.API_URL}/device/brands`)
      .pipe(
        map((response) => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(
              response.error || response.message || 'Failed to fetch brands',
            );
          }
        }),
        catchError(this.handleError),
      );
  }

  getTemplatesByIds(ids: string[]): Observable<LocalTemplateDto[]> {
    return this.http
      .post<
        HttpResponseData<LocalTemplateDto[]>
      >(`${this.API_URL}/device/templates/by-ids`, ids)
      .pipe(
        map((response) => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(
              response.error ||
                response.message ||
                'Failed to retrieve templates',
            );
          }
        }),
        catchError(this.handleError),
      );
  }

  getDevicesByIds(ids: number[]): Observable<LocalDeviceDto[]> {
    return this.http
      .post<
        HttpResponseData<LocalDeviceDto[]>
      >(`${this.API_URL}/device/devices/by-ids`, ids)
      .pipe(
        map((response) => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(
              response.error ||
                response.message ||
                'Failed to retrieve templates',
            );
          }
        }),
        catchError(this.handleError),
      );
  }

  createDevice(request: CreateDeviceRequest): Observable<LocalDeviceDto> {
    return this.http
      .post<
        HttpResponseData<LocalDeviceDto>
      >(`${this.API_URL}/device/device`, request)
      .pipe(
        map((response) => {
          if (response.success && response.result) {
            return response.result;
          }
          throw new Error(response.message || 'Failed to create device');
        }),
      );
  }

  updateDevice(
    id: number,
    request: UpdateDeviceRequest,
  ): Observable<LocalDeviceDto> {
    return this.http
      .put<
        HttpResponseData<LocalDeviceDto>
      >(`${this.API_URL}/device/device/${id}`, request)
      .pipe(
        map((response) => {
          if (response.success && response.result) {
            return response.result;
          }
          throw new Error(response.message || 'Failed to update device');
        }),
      );
  }

  deleteDevice(
    id: number,
    userId: number,
  ): Observable<{ success: boolean; message: string }> {
    return this.http
      .delete<
        HttpResponseData<boolean>
      >(`${this.API_URL}/device/device/${id}/user/${userId}`)
      .pipe(
        map((response) => ({
          success: response.success,
          message: response.message,
        })),
        catchError(() =>
          of({ success: false, message: 'Failed to delete device' }),
        ),
      );
  }

  deleteTemplate(
    id: string,
    userId: number,
  ): Observable<{ success: boolean; message: string }> {
    return this.http
      .delete<
        HttpResponseData<boolean>
      >(`${this.API_URL}/device/template/${id}/user/${userId}`)
      .pipe(
        map((response) => ({
          success: response.success,
          message: response.message,
        })),
        catchError(() =>
          of({ success: false, message: 'Failed to delete template' }),
        ),
      );
  }
  //#endregion

  //#region Batch Operations
  batchAddDevicesToMinew(
    request: BatchAddDeviceRequest,
  ): Observable<HttpResponseData<BatchAddResult>> {
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
      }),
    };

    return this.http
      .post<
        HttpResponseData<BatchAddResult>
      >(`${this.API_URL}/device/devices/batch-add-minew`, request, httpOptions)
      .pipe(
        catchError((error) => {
          console.error('Error batch adding devices:', error);
          throw error;
        }),
      );
  }

  uploadBatchDevicesFile(
    file: File,
    storeId: string,
    type: number = 1,
    userId: number = 0,
  ): Observable<HttpResponseData<BatchAddResult>> {
    const formData = new FormData();
    formData.append('file', file);

    const params = new HttpParams()
      .set('storeId', storeId)
      .set('type', type.toString())
      .set('userId', userId.toString());

    return this.http
      .post<
        HttpResponseData<BatchAddResult>
      >(`${this.API_URL}/device/devices/batch-add-minew-upload`, formData, { params })
      .pipe(
        catchError((error) => {
          console.error('Error uploading batch devices file:', error);
          throw error;
        }),
      );
  }

  batchWakeDevices(
    request: BatchWakeDevicesRequest,
  ): Observable<HttpResponseData<BatchWakeResult>> {
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
      }),
    };

    return this.http
      .post<
        HttpResponseData<BatchWakeResult>
      >(`${this.API_URL}/device/devices/batch-wake`, request, httpOptions)
      .pipe(
        catchError((error) => {
          console.error('Error waking up devices:', error);
          throw error;
        }),
      );
  }

  delayedSyncAfterWake(
    storeId: string,
    delaySeconds: number = 30,
  ): Observable<HttpResponseData<any>> {
    const params = new HttpParams()
      .set('storeId', storeId)
      .set('delaySeconds', delaySeconds.toString());

    return this.http
      .post<
        HttpResponseData<any>
      >(`${this.API_URL}/device/devices/delayed-sync`, null, { params })
      .pipe(
        catchError((error) => {
          console.error('Error in delayed sync:', error);
          throw error;
        }),
      );
  }
  //#endregion

  //#region Utility Methods
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private handleError(error: any): Observable<never> {
    console.error('Product Service Error:', error);

    let errorMessage = 'An unexpected error occurred';

    if (error instanceof HttpErrorResponse) {
      if (error.status === 404) {
        errorMessage = error.error?.message || 'No products found';
      } else if (error.error instanceof ErrorEvent) {
        errorMessage = `Network error: ${error.error.message}`;
      } else {
        const serverError = error.error;
        if (serverError && typeof serverError === 'object') {
          errorMessage =
            serverError.error ||
            serverError.message ||
            `Server error: ${error.status}`;
        } else {
          errorMessage = `HTTP error: ${error.status} - ${error.message}`;
        }
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    console.error('Product Service Error Details:', {
      message: errorMessage,
      originalError: error,
      timestamp: new Date().toISOString(),
    });

    return throwError(() => new Error(errorMessage));
  }
  //#endregion
}
