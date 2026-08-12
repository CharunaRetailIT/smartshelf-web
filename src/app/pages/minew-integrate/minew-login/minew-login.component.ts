import { Component } from '@angular/core';
import { MinewLoginRequest } from '../../../core/interfaces/minew.interface';
import { MinewService } from '../../../core/services/minew.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-minew-login',
  imports: [CommonModule,FormsModule],
  templateUrl: './minew-login.component.html',
  styleUrl: './minew-login.component.css'
})
export class MinewLoginComponent {
loginRequest: MinewLoginRequest = { username: '', password: '' };
  errorMessage: string | null = null;
  isLoading = false;

  constructor(private minewService: MinewService) {}

  onSubmit() {
    this.isLoading = true;
    this.errorMessage = null;
    this.minewService.login(this.loginRequest.username, this.loginRequest.password).subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Invalid username or password';
      },
    });
  }
}
