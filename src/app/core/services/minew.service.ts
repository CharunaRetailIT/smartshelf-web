import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { MinewStore, ProductResponse } from '../interfaces/minew.interface';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MinewService {
  private readonly API_BASE = environment.apiUrl || 'https://localhost:44321/api';
  private tokenSubject = new BehaviorSubject<string | null>(this.getStoredToken());
  public token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getStoredToken(): string | null {
    return sessionStorage.getItem('minew_token');
  }

  private setStoredToken(token: string | null): void {
    if (token) {
      sessionStorage.setItem('minew_token', token);
    } else {
      sessionStorage.removeItem('minew_token');
    }
    this.tokenSubject.next(token);
  }

  get isAuthenticated(): boolean {
    return !!this.tokenSubject.value;
  }

  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.API_BASE}/minew-integration/login`, { username, password })
      .pipe(
        tap(response => {
          if (response?.token) {
            this.setStoredToken(response.token);
          }
        })
      );
  }

  logout(): void {
    this.setStoredToken(null);
  }

  // Store Management
  
getStores(): Observable<MinewStore[]> {
  return this.http.get<any>(`${this.API_BASE}/minew-integration/store/list`).pipe(
    map(res => {
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      return list.map((s: any) => ({
        storeId: s.id,
        storeName: s.name,
        address: s.address,
        active: s.active
      }));
    }),
    catchError(err => {
      console.error('Error fetching stores', err);
      return of([]);
    })
  );
}

  addStore(store: any): Observable<any> {
    return this.http.post(`${this.API_BASE}/minew-integration/store/add`, store);
  }

  updateStore(store: any): Observable<any> {
    return this.http.put(`${this.API_BASE}/minew-integration/store/update`, store);
  }

  openOrCloseStore(storeId: string, active: number): Observable<any> {
    const params = new HttpParams()
      .set('storeId', storeId)
      .set('active', active.toString());
    return this.http.get(`${this.API_BASE}/minew-integration/store/openOrClose`, { params });
  }

  //#region Product Management

  //Load Products

  getProducts( storeId: string, page: number = 1,size: number = 10, condition?: string): Observable<ProductResponse> {

    let params = new HttpParams()
      .set('storeId', storeId)
      .set('page', page.toString())
      .set('size', size.toString())
      // .set('condition', condition ?? '');
     if (condition) params = params.set('condition', condition);

    return this.http.get<ProductResponse>(`${this.API_BASE}/minew-integration/product/list`, { params });
  }
  
  // Product Sync
  syncProducts(storeId: number, opcode?: string): Observable<any> {
    console.log(storeId);
    // let storeId = storeIddddd;
    let params = new HttpParams().set('storeId', storeId);
    if (opcode) {
      params = params.set('opcode', opcode);
    }
    return this.http.post(`${this.API_BASE}/minew-integration/syncToCloud`, null, { 
      params,
      responseType: 'json'
    });
  }

  //Sync Shelfs
    syncShelfs(storeId: number, opcode?: string): Observable<any> {
    console.log(storeId);
    // let storeId = storeIddddd;
    let params = new HttpParams().set('storeId', storeId);
    if (opcode) {
      params = params.set('opcode', opcode);
    }
    return this.http.post(`${this.API_BASE}/minew-integration/shelf/syncToCloud`, null, { 
      params,
      responseType: 'json'
    });
  }

  syncProductsToCloud(storeId: string, opcode: string, username: string, passwordMd5: string): Observable<any> {
    const params = new HttpParams()
      .set('storeId', storeId)
      .set('opcode', opcode)
      .set('username', username)
      .set('passwordMd5', passwordMd5);
    return this.http.post(`${this.API_BASE}/syncToCloud`, null, { params });
  }
  //#endregion
}