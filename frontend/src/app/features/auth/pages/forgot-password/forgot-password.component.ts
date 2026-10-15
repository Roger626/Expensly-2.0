import { IconComponent } from '../../../../shared/icon/icon.component';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { InputComponent } from '../../../../shared/input/input/input.component';

type ViewState = 'form' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [IconComponent, CommonModule, RouterLink, ReactiveFormsModule, InputComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {

  private readonly authService = inject(AuthService);
  private readonly fb          = inject(FormBuilder);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected viewState: ViewState = 'form';
  protected errorMessage = '';

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.viewState = 'loading';
    const { email } = this.form.value;

    this.authService.forgotPassword(email!).subscribe({
      next: () => { this.viewState = 'success'; },
      error: () => {
        // Incluso ante errores mostramos success para no filtrar si el email existe
        this.viewState = 'success';
      },
    });
  }
}
