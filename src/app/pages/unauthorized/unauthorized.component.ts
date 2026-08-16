import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4"
    >
      <div
        class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center"
      >
        <div
          class="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6"
        >
          <svg
            class="w-8 h-8 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            ></path>
          </svg>
        </div>

        <h1 class="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
        <p class="text-gray-600 mb-6">
          You don't have permission to access this resource. Please contact your
          administrator if you believe this is an error.
        </p>

        <div class="space-y-3">
          <button
            (click)="goBack()"
            class="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
          <button
            (click)="goToDashboard()"
            class="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class UnauthorizedComponent {
  private router = inject(Router);

  goBack(): void {
    window.history.back();
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
