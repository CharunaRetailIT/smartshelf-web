// dashboard.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface DashboardSummary {
  totalUsers: number;
  activeShelves: number;
  totalProducts: number;
  activeDisplays: number;
}

export interface RecentShelf {
  shelfId: string;
  name: string;
  location: string;
  status: string;
  createdDate: string;
}

export interface RecentActivity {
  activityType: string;
  description: string;
  performedBy: string;
  userName: string;
  activityDate: string;
}

export interface DashboardData {
  summary: DashboardSummary;
  recentShelves: RecentShelf[];
  recentActivities: RecentActivity[];
}

export interface UserDashboard {
  userInfo: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
    role: string;
    departmentId: string;
    profileImagePath: string;
  };
  dashboard: DashboardData;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  result?: T;
  results?: T[];
  responsCode: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) { }

  // Get complete dashboard data (requires authentication)
  getDashboardData(): Observable<DashboardData> {
    return this.http.get<ApiResponse<DashboardData>>(`${this.apiUrl}/data`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          return response.result!;
        })
      );
  }

  // Get only summary stats
  getDashboardSummary(): Observable<DashboardSummary> {
    return this.http.get<ApiResponse<DashboardSummary>>(`${this.apiUrl}/summary`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          return response.result!;
        })
      );
  }

  // Get recent shelves only
  getRecentShelves(): Observable<RecentShelf[]> {
    return this.http.get<ApiResponse<RecentShelf[]>>(`${this.apiUrl}/recent-shelves`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          return response.result!;
        })
      );
  }

  // Get recent activities only
  getRecentActivities(): Observable<RecentActivity[]> {
    return this.http.get<ApiResponse<RecentActivity[]>>(`${this.apiUrl}/recent-activities`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          return response.result!;
        })
      );
  }

  // Get user-specific dashboard with user info
  getUserDashboard(): Observable<UserDashboard> {
    return this.http.get<ApiResponse<UserDashboard>>(`${this.apiUrl}/user-dashboard`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          return response.result!;
        })
      );
  }

  // Get public dashboard data (no authentication required)
  getPublicDashboardData(): Observable<DashboardSummary> {
    return this.http.get<ApiResponse<DashboardSummary>>(`${this.apiUrl}/public-data`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          return response.result!;
        })
      );
  }

  // Health check
  healthCheck(): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/health`)
      .pipe(
        map(response => response.result!)
      );
  }
}