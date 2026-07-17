import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminDashboardPageComponent } from './dashboard.component';
import { AdminFacadeService } from '../../services/admin.facade.service';
import { AuthService } from '../../../auth/services/auth.service';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';

import { LucideAngularModule, CreditCard, Receipt, Clock, AlertTriangle, Inbox, RefreshCw, TrendingUp, TrendingDown } from 'lucide-angular';

describe('AdminDashboardPageComponent', () => {
  let component: AdminDashboardPageComponent;
  let fixture: ComponentFixture<AdminDashboardPageComponent>;
  let facadeMock: any;
  let authMock: any;

  beforeEach(async () => {
    facadeMock = {
      dashboard: {
        getCategorias: jasmine.createSpy('getCategorias').and.returnValue(of([
          { id: '1', nombre: 'Comida' }
        ])),
        getDashboardResumen: jasmine.createSpy('getDashboardResumen').and.returnValue(of({
          gastoTotal: 1500,
          itbmsRecuperable: 105,
          tasaRecuperacion: 7,
          aprobacionesPendientes: 3,
          reportesVencidos: 1,
          ultimasTransacciones: [
            { id: 'tx-1', empleado: 'Juan Perez', categoria: 'Comida', fecha: '2026-07-01', montoTotal: 120, estado: 'PENDIENTE' }
          ]
        })),
        getDashboardTendencia: jasmine.createSpy('getDashboardTendencia').and.returnValue(of([
          { mes: '2026-07', montoTotal: 1500, itbms: 105 }
        ])),
        getDashboardCategorias: jasmine.createSpy('getDashboardCategorias').and.returnValue(of([
          { name: 'Comida', percentage: 100, montoTotal: 1500 }
        ]))
      },
      suscripciones: {
        obtenerActual: jasmine.createSpy('obtenerActual').and.returnValue(of({
          plan: 'pro',
          estado: 'Trial',
          current_period_end: null,
          trial_termina_en: new Date('2027-01-01')
        }))
      },
      usuarios: {
        loadAll: jasmine.createSpy('loadAll'),
        usuarios$: of([
          { id: 'usr-1', nombreCompleto: 'Juan Perez', email: 'juan@test.com' }
        ])
      }
    };

    authMock = {
      organizationId: signal('org-123')
    };

    await TestBed.configureTestingModule({
      imports: [
        AdminDashboardPageComponent,
        LucideAngularModule.pick({ CreditCard, Receipt, Clock, AlertTriangle, Inbox, RefreshCw, TrendingUp, TrendingDown })
      ],
      providers: [
        { provide: AdminFacadeService, useValue: facadeMock },
        { provide: AuthService, useValue: authMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load initial dashboard data', () => {
    expect(component).toBeTruthy();
    expect(facadeMock.dashboard.getCategorias).toHaveBeenCalledWith('org-123');
    expect(facadeMock.usuarios.loadAll).toHaveBeenCalled();
    expect(facadeMock.dashboard.getDashboardResumen).toHaveBeenCalled();
    expect(facadeMock.dashboard.getDashboardTendencia).toHaveBeenCalled();
    expect(facadeMock.dashboard.getDashboardCategorias).toHaveBeenCalled();
  });

  it('calculates avatar initials correctly', () => {
    expect(component.getAvatarInitials('Juan Perez')).toBe('JP');
    expect(component.getAvatarInitials('Carlos')).toBe('CA');
    expect(component.getAvatarInitials('')).toBe('EX');
  });

  it('returns correct badge classes for transaction statuses', () => {
    expect(component.getStatusClass('APROBADO')).toBe('badge-status-approved');
    expect(component.getStatusClass('RECHAZADO')).toBe('badge-status-rejected');
    expect(component.getStatusClass('PENDIENTE')).toBe('badge-status-pending');
  });

  it('passes the selected date range to getDashboardTendencia (regression: filter used to be ignored)', () => {
    expect(facadeMock.dashboard.getDashboardTendencia).toHaveBeenCalledWith(
      undefined, undefined, component.startDate, component.endDate,
    );
  });

  it('clears loading and sets isLoading/lastUpdated after a successful load', () => {
    expect(component.isLoading()).toBeFalse();
    expect(component.lastUpdated()).not.toBeNull();
    expect(component.loadError()).toBeNull();
  });

  it('surfaces a friendly error message and stops loading when a request fails', () => {
    facadeMock.dashboard.getDashboardResumen.and.returnValue(throwError(() => new Error('network down')));

    component.loadAllDashboardData();

    expect(component.isLoading()).toBeFalse();
    expect(component.loadError()).toContain('No se pudieron cargar');
  });
});
