// dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import {
  DashboardService,
  DashboardData,
  UserDashboard,
  RecentShelf,
  RecentActivity,
} from '../core/services/dashboard.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TableModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  dashboardData: DashboardData | null = null;
  userDashboard: UserDashboard | null = null;
  isLoading = false;
  errorMessage = '';
  selectedTab: 'summary' | 'shelves' | 'activities' | 'user' = 'summary';
  currentDate = new Date().toISOString(); // Store current date
  currentUserId: number = 0;

  constructor(
    private dashboardService: DashboardService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.currentUser();
    this.loadDashboardData();
  }
  currentUser() {
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      console.log('User not authenticated');
      return;
    }
    this.currentUserId = user.id;
  }

  loadDashboardData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.dashboardService.getDashboardData().subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading dashboard:', error);
        this.errorMessage = error.message || 'Failed to load dashboard data';
        this.isLoading = false;

        // Try to load public data as fallback
        this.loadPublicDashboardData();
      },
    });
  }

  loadPublicDashboardData(): void {
    this.dashboardService.getPublicDashboardData().subscribe({
      next: (summary) => {
        // Create a minimal dashboard data object with public summary
        this.dashboardData = {
          summary: summary,
          recentShelves: [],
          recentActivities: [],
        };
      },
      error: () => {
        // Even public data failed, show empty state
        this.dashboardData = {
          summary: {
            totalUsers: 0,
            activeShelves: 0,
            totalProducts: 0,
            activeDisplays: 0,
          },
          recentShelves: [],
          recentActivities: [],
        };
      },
    });
  }

  loadUserDashboard(): void {
    this.isLoading = true;
    this.dashboardService.getUserDashboard().subscribe({
      next: (data) => {
        this.userDashboard = data;
        this.selectedTab = 'user';
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading user dashboard:', error);
        this.errorMessage = 'Failed to load user dashboard';
        this.isLoading = false;
      },
    });
  }

  refreshDashboard(): void {
    this.loadDashboardData();
  }

  selectTab(tab: 'summary' | 'shelves' | 'activities' | 'user'): void {
    this.selectedTab = tab;
    if (tab === 'user' && !this.userDashboard) {
      this.loadUserDashboard();
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs';
      case 'inactive':
        return 'bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs';
      default:
        return 'bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
  }

  getActivityIcon(activityType: string): string {
    switch (activityType?.toLowerCase()) {
      case 'shelf_update':
        return 'fas fa-warehouse';
      case 'product_assignment':
        return 'fas fa-box';
      case 'queue_update':
        return 'fas fa-tv';
      case 'message_created':
        return 'fas fa-bullhorn';
      default:
        return 'fas fa-history';
    }
  }

  getActivityColor(activityType: string): string {
    switch (activityType?.toLowerCase()) {
      case 'shelf_update':
        return 'bg-blue-600';
      case 'product_assignment':
        return 'bg-green-600';
      case 'queue_update':
        return 'bg-purple-600';
      case 'message_created':
        return 'bg-orange-600';
      default:
        return 'bg-gray-600';
    }
  }

  // Helper method to update current time
  updateCurrentTime(): void {
    this.currentDate = new Date().toISOString();
  }

  // Add this method to your component
  getCurrentTimeAgo(): string {
    return this.getTimeAgo(this.currentDate);
  }
}
