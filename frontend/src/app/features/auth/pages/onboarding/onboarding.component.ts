import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { lastValueFrom } from 'rxjs';
import { OnboardingService } from '../../services/onboarding.service';
import { AuthService } from '../../services/auth.service';
import { OnboardingPaso1Component } from '../../components/onboarding-paso1/onboarding-paso1.component';
import { OnboardingPaso2Component } from '../../components/onboarding-paso2/onboarding-paso2.component';
import { ModalComponent } from '../../../../shared/modal/modal.component';
import { ToastService } from '../../../../shared/toast/toast.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [RouterModule, CommonModule, ModalComponent],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css']
})
export class OnboardingComponent implements OnInit {
  public currentStep: number = 1;
  public readonly numberSteps: number = 2;

  // Success modal
  showSuccessModal = false;
  orgName = '';

  // Step info
  public steps = [
    { number: 1, title: 'Company Details', next: 'Account Setup & Team Invite' },
    { number: 2, title: 'Account Setup', next: 'Finish' }
  ];

  get currentStepInfo() {
    return this.steps[this.currentStep - 1]; // because array is 0-indexed
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private onboardingService: OnboardingService,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email) {
      const currentData = this.onboardingService.getCurrentData();
      this.onboardingService.updateData({
        step2: {
          ...currentData.step2,
          email,
        },
      }, 2);
    }

    this.calculateCurrentStep(); // Initialize
    
    // Subscribe to navigation events
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => this.calculateCurrentStep()); 
  }

  goToDashboard(): void {
    this.showSuccessModal = false;
    this.router.navigate(['/admin/facturas']);
  }

  private calculateCurrentStep() {
    const url = this.router.url;
    
    if (url.includes('paso-2')) {
      this.currentStep = 2;
    } else {
      // Default to 1 (paso-1 or just /onboarding)
      this.currentStep = 1;
    }
  }

  onActivate(componentRef: any) {
    const currentData = this.onboardingService.getCurrentData();

    if (componentRef instanceof OnboardingPaso1Component) {
      componentRef.setFormData(currentData.step1);

      componentRef.nextStep.subscribe((data: any) => {
        this.onboardingService.updateData({ step1: data }, 1);
        this.router.navigate(['/auth/onboarding/paso-2']);
      });
    } 
    else if (componentRef instanceof OnboardingPaso2Component) {
      componentRef.setFormData(currentData.step2);

      componentRef.submitData.subscribe(async (data: any) => {
        this.onboardingService.updateData({ step2: data }, 2);
        try {
          const response = await lastValueFrom(this.onboardingService.submitOnboardingData());
          this.authService.saveSession(response.authData);
          this.orgName = this.onboardingService.getCurrentData().step1.companyNombre;
          this.showSuccessModal = true;
        } catch (error: any) {
          const status = error?.status;
          if (status === 409) {
            this.toastService.error(
              'Correo ya registrado',
              error?.error?.message ?? 'El correo electrónico ya está en uso o el RUC ya pertenece a otra organización.'
            );
          } else if (status === 400) {
            this.toastService.error(
              'Datos inválidos',
              error?.error?.message ?? 'Revisa los campos e intenta nuevamente.'
            );
          } else if (status === 504 || status === 408) {
            this.toastService.error(
              'Servidor ocupado',
              error?.error?.message ?? 'La solicitud tardó demasiado. Intenta nuevamente.'
            );
          } else {
            this.toastService.error(
              'Error al registrar',
              error?.error?.message ?? 'Ocurrió un error inesperado. Intenta nuevamente.'
            );
          }
          console.error('Error durante el onboarding', error);
        }
      });

      componentRef.goBack.subscribe(() => {
        this.router.navigate(['/auth/onboarding/paso-1']);
      });
    }
  }
}