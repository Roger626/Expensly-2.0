import { Routes } from '@angular/router';
import { RegisterComponent } from './pages/register/register.component';
import { LoginComponent } from './pages/login/login.component';
import { OnboardingComponent } from './pages/onboarding/onboarding.component';
import { OnboardingPaso1Component } from './components/onboarding-paso1/onboarding-paso1.component';
import { OnboardingPaso2Component } from './components/onboarding-paso2/onboarding-paso2.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';

export const authRoutes: Routes = [
    { path: 'register',       redirectTo: 'onboarding', pathMatch: 'full' },
    { path: 'login',          component: LoginComponent },
    { path: 'forgot-password', component: ForgotPasswordComponent },
    { path: 'reset-password',  component: ResetPasswordComponent },
    {
        path: 'onboarding',
        component: OnboardingComponent,
        children: [
            { path: 'paso-1', component: OnboardingPaso1Component },
            { path: 'paso-2', component: OnboardingPaso2Component },
            { path: '',       redirectTo: 'paso-1', pathMatch: 'full' },
        ],
    },
    { path: '', redirectTo: 'login', pathMatch: 'full' },
];
