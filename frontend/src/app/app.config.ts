import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { LucideAngularModule, FileText, PlusCircle, Users, LayoutGrid, LogOut, ChevronRight, ChevronLeft, CreditCard } from 'lucide-angular';

import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';

registerLocaleData(localeEs, 'es');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    { provide: LOCALE_ID, useValue: 'es' },
    importProvidersFrom(
      LucideAngularModule.pick({ FileText, PlusCircle, Users, LayoutGrid, LogOut, ChevronRight, ChevronLeft, CreditCard })
    ),
  ]
};
