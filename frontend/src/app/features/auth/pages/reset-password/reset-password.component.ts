import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { InputComponent } from '../../../../shared/input/input/input.component';

type ViewState = 'form' | 'loading' | 'success' | 'error' | 'invalid-token';

/** Validador personalizado: newPassword === confirmPassword */
function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const pw  = control.get('newPassword')?.value;
  const cpw = control.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, InputComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPasswordComponent implements OnInit {

  private readonly authService = inject(AuthService);
  private readonly fb          = inject(FormBuilder);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);

  protected token = '';

  protected readonly form = this.fb.group(
    {
      newPassword:     ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected viewState: ViewState = 'form';
  protected errorMessage = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.viewState = 'invalid-token';
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.viewState = 'loading';
    const { newPassword } = this.form.value;

    this.authService.resetPassword(this.token, newPassword!).subscribe({
      next: () => {
        this.viewState = 'success';
        setTimeout(() => this.router.navigate(['/auth/login']), 3000);
      },
      error: (err) => {
        this.viewState = 'error';
        this.errorMessage = this.authService.getFriendlyErrorMessage(
          err,
          'El enlace ha expirado o es inválido. Solicita uno nuevo.'
        );
      },
    });
  }
}
