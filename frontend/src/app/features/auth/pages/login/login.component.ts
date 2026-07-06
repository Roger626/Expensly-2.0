import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { InputComponent } from '../../../../shared/input/input/input.component';
import { ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Role } from '../../../../core/models/roles.enum';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, InputComponent, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading    = true;
    this.errorMessage = null;
    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: () => {
        this.isLoading = false;
        const role = this.authService.userRole();
        // Redirigir según el rol del usuario
        if (role === Role.SUPERADMIN || role === Role.CONTADOR) {
          this.router.navigate(['/admin/facturas']);
        } else {
          this.router.navigate(['/facturas']);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = this.authService.getFriendlyErrorMessage(
          err,
          'Credenciales incorrectas. Intenta de nuevo.'
        );
      },
    });
  }
}

