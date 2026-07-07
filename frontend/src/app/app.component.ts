import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { ToastComponent } from './shared/toast/toast.component';
import { AuthService } from './features/auth/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent, SidebarComponent, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  isAdminRoute = false;
  isfacturaRoute = false;
  isOnboardingRoute = false;
  isSidebarCollapsed = false;
  private sub: Subscription = new Subscription();

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    // Escuchamos los cambios de navegación
    this.sub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.checkRoute(event.urlAfterRedirects || event.url);
    });

    // Check initial route
    // En SSR o reload, router.url puede ya tener valor
    // Pero NavigationEnd se dispara también al inicio en CSR?
    // Angular router dispara eventos al iniciar.
  }

  onLogout(): void {
    this.authService.logout();
  }

  private checkRoute(url: string) {
    this.isAdminRoute      = url.startsWith('/admin') || url.startsWith('/cuenta');
    this.isfacturaRoute    = url.startsWith('/facturas');
    this.isOnboardingRoute = url.startsWith('/auth/onboarding');
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
