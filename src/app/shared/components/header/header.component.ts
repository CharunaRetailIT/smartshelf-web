// src/app/shared/components/header/header.component.ts
import { CommonModule } from '@angular/common';
import { Component, input, output, inject, OnInit, EventEmitter, Input, Output } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { Observable } from 'rxjs';
import { User } from '../../../core/interfaces/auth.interface';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="header">
      <div class="header-left">
        <button 
          class="menu-toggle md:hidden"
          (click)="toggleSidebar.emit(!isLeftSidebarCollapsed())"
        >
          <i class="fas fa-bars"></i>
        </button>
        
        <div class="breadcrumb">
          <h1>Dashboard</h1>
          <!-- <p class="text-gray-600">Welcome back!</p> -->
        </div>
      </div>

      <div class="header-right">
        <!-- Notifications -->
        <button class="notification-btn">
          <!-- <i class="fas fa-bell"></i>
          <span class="notification-badge">3</span> -->
        </button>

        <!-- User Dropdown -->
        <div class="user-dropdown" [class.active]="showDropdown">
          <button class="user-btn" (click)="toggleDropdown()">
          <div class="user-avatar" *ngIf="currentUser$ | async as user">
          <ng-container *ngIf="user.profileImageUrl; else initialsAvatar">
            <img 
              [src]="user.profileImageUrl"
              [alt]="user.firstName + ' ' + user.lastName"
              class="avatar-img"
              (error)="onImageError($event)" 
            />
          </ng-container>
          <ng-template #initialsAvatar>
            <div class="avatar-fallback">
              {{ user.firstName[0] }}{{ user.lastName[0] }}
            </div>
          </ng-template>
        </div>
            <div class="user-info" *ngIf="currentUser$ | async as user">
              <span class="user-name">{{user.firstName}} {{user.lastName}}</span>
              <span class="user-role">{{user.roles[0]}}</span>
            </div>
            <i class="fas fa-chevron-down dropdown-arrow"></i>
          </button>

          <div class="dropdown-menu" *ngIf="showDropdown">
            <div class="dropdown-header" *ngIf="currentUser$ | async as user">
              <div class="user-details">
                <strong>{{user.firstName}} {{user.lastName}}</strong>
                <small>{{user.email}}</small>
                <span class="role-badge">{{user.roles[0]}}</span>
              </div>
            </div>
            
            <div class="dropdown-divider"></div>
            
            <a routerLink="./profile" class="dropdown-item">
              <i class="fas fa-user"></i>
              Profile Settings
            </a>
            <!-- <a href="#" class="dropdown-item">
              <i class="fas fa-cog"></i>
              Preferences
            </a>
            <a href="#" class="dropdown-item">
              <i class="fas fa-question-circle"></i>
              Help & Support
            </a> -->
            
            <div class="dropdown-divider"></div>
            
            <button class="dropdown-item logout-btn" (click)="logout()">
              <i class="fas fa-sign-out-alt"></i>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <!-- Dropdown backdrop -->
      <div class="dropdown-backdrop" *ngIf="showDropdown" (click)="closeDropdown()"></div>
    </header>
  `,
  styles: [`
    .header {
      position: relative;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background: white;
      border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      z-index: 10;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .menu-toggle {
      padding: 0.5rem;
      border: none;
      background: none;
      color: #6b7280;
      font-size: 1.25rem;
      cursor: pointer;
      border-radius: 0.375rem;
      transition: all 0.2s;
    }

    .menu-toggle:hover {
      background-color: #f3f4f6;
      color: #374151;
    }

    .breadcrumb h1 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }

    .breadcrumb p {
      margin: 0;
      font-size: 0.875rem;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .notification-btn {
      position: relative;
      padding: 0.5rem;
      border: none;
      background: none;
      color: #6b7280;
      font-size: 1.25rem;
      cursor: pointer;
      border-radius: 0.375rem;
      transition: all 0.2s;
    }

    .notification-btn:hover {
      background-color: #f3f4f6;
      color: #374151;
    }

    .notification-badge {
      position: absolute;
      top: 0.25rem;
      right: 0.25rem;
      background-color: #ef4444;
      color: white;
      font-size: 0.75rem;
      font-weight: 600;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-dropdown {
      position: relative;
    }

    .user-btn {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
      border: none;
      background: none;
      border-radius: 0.375rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .user-btn:hover {
      background-color: #f3f4f6;
    }

    .user-avatar {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      overflow: hidden;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .user-info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
    }

    .user-name {
      font-weight: 500;
      color: #111827;
    }

    .user-role {
      font-size: 0.875rem;
      color: #6b7280;
      text-transform: capitalize;
    }

    .dropdown-arrow {
      font-size: 0.875rem;
      color: #6b7280;
      transition: transform 0.2s;
    }

    .user-dropdown.active .dropdown-arrow {
      transform: rotate(180deg);
    }

    .dropdown-menu {
      position: absolute;
      top: 100%;
      right: 0;
      width: 16rem;
      background: white;
      border-radius: 0.5rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      margin-top: 0.5rem;
      z-index: 20;
      overflow: hidden;
    }

    .dropdown-header {
      padding: 1rem;
      background-color: #f9fafb;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .user-details small {
      color: #6b7280;
    }

    .role-badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      background-color: #e5e7eb;
      color: #374151;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
      margin-top: 0.5rem;
      text-transform: capitalize;
    }

    .dropdown-divider {
      height: 1px;
      background-color: #e5e7eb;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      color: #374151;
      text-decoration: none;
      transition: all 0.2s;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      cursor: pointer;
    }

    .dropdown-item:hover {
      background-color: #f3f4f6;
    }

    .dropdown-item i {
      width: 1rem;
      color: #6b7280;
    }

    .logout-btn {
      color: #ef4444;
    }

    .logout-btn:hover {
      background-color: #fef2f2;
    }

    .dropdown-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 15;
      background: transparent;
    }

    @media (max-width: 768px) {
      .header {
        padding: 1rem;
      }
      
      .user-info {
        display: none;
      }
    }
    .user-avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #e5e7eb;
    color: #374151;
    font-weight: 600;
    font-size: 0.9rem;
    }
    .avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #3b82f6; /* blue background */
    color: white;
    }

  `]
})
export class HeaderComponent implements OnInit {
  @Input() collapsed = false;
  @Output() toggle = new EventEmitter<boolean>();
  isLeftSidebarCollapsed = input<boolean>(false);
  toggleSidebar = output<boolean>();

  showDropdown = false;
  currentUser$!: Observable<User | null>;

  private authService = inject(AuthService);

  ngOnInit(): void {
    this.currentUser$ = this.authService.currentUser$;
    console.log('Current User in Header:', this.currentUser$);
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  closeDropdown(): void {
    this.showDropdown = false;
  }

  logout(): void {
    this.authService.logout();
    this.closeDropdown();
  }
  onImageError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

}