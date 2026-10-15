import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { signal } from '@angular/core';

import { AdminDashboardPageComponent } from './dashboard.component';
import { AdminFacadeService } from '../../services/admin.facade.service';
import { AuthService } from '../../../auth/services/auth.service';
import { Factura } from '../../../registro-factura/models/factura.model';

const hoy = new Date();
const iso = (diasAtras: number) => {
  const d = new Date(hoy);
  d.setDate(d.getDate() - diasAtras);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const factura = (id: string, dias: number, monto: number, estado?: Factura['estado']): Factura => ({
  facturaId: id, fechaEmision: iso(dias), montoTotal: monto, estado,
  rucProveedor: '', nombreProveedor: `Prov ${id}`, cufe: '', numeroFactura: id,
});

describe('AdminDashboardPageComponent', () => {
  let component: AdminDashboardPageComponent;
  let fixture: ComponentFixture<AdminDashboardPageComponent>;
  let facadeMock: any;
  let facturas$: BehaviorSubject<Factura[]>;

  beforeEach(async () => {
    facturas$ = new BehaviorSubject<Factura[]>([
      factura('a', 1, 100, 'APROBADO'),
      factura('b', 10, 50, 'PENDIENTE'),
      factura('c', 3, 20),               // sin estado = pendiente
      factura('d', 2, 30, 'RECHAZADO'),
      factura('e', 90, 999, 'APROBADO'), // fuera de los 30 días
    ]);

    facadeMock = {
      dashboard: {
        getResumen: jasmine.createSpy('getResumen').and.returnValue(of({
          gastoTotal: 1500, itbmsRecuperable: 105, tasaRecuperacion: 7, variacionGastoTotal: 10, variacionItbmsRecuperable: null,
          aprobacionesPendientes: 3, reportesVencidos: 1,
          ultimasTransacciones: [{ id: 'tx-1', empleado: 'Juan Perez', categoria: 'Comida', fecha: '2026-07-01', montoTotal: 120, estado: 'PENDIENTE' }],
        })),
        getTendencia: jasmine.createSpy('getTendencia').and.returnValue(of([{ mes: '2026-07', montoTotal: 1500, itbms: 105 }])),
        getCategorias: jasmine.createSpy('getCategorias').and.returnValue(of([
          { id: 'c1', name: 'Comida', montoTotal: 500, count: 2, percentage: 33 },
          { id: 'c2', name: 'Hotel', montoTotal: 1000, count: 1, percentage: 67 },
        ])),
      },
      categorias: { load: jasmine.createSpy('load'), sorted: signal([{ id: 'c1', nombre: 'Comida' }]) },
      facturas: {
        facturas$,
        loadAll: jasmine.createSpy('loadAll'),
        refresh: jasmine.createSpy('refresh'),
        updateEstado: jasmine.createSpy('updateEstado').and.returnValue(of({})),
      },
      usuarios: { loadAll: jasmine.createSpy('loadAll'), usuarios$: of([]) },
      suscripciones: { obtenerActual: jasmine.createSpy('obtenerActual').and.returnValue(of({ plan: 'pro', estado: 'Activa' })) },
    };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardPageComponent],
      providers: [
        provideRouter([]),
        { provide: AdminFacadeService, useValue: facadeMock },
        {
          provide: AuthService,
          useValue: { currentUser: signal({ name: 'Ana Demo' }), userRole: signal('SUPERADMIN'), organizationId: signal('org-1') },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga resumen, tendencia, categorías, facturas y usuarios al iniciar', () => {
    expect(component).toBeTruthy();
    expect(facadeMock.dashboard.getResumen).toHaveBeenCalled();
    expect(facadeMock.dashboard.getCategorias).toHaveBeenCalled();
    expect(facadeMock.facturas.loadAll).toHaveBeenCalled();
    expect(facadeMock.usuarios.loadAll).toHaveBeenCalled();
    expect(component.loading()).toBeFalse();
    expect(component.lastUpdated()).not.toBeNull();
  });

  it('la tendencia termina en la fecha final elegida y abarca seis meses', () => {
    const args = facadeMock.dashboard.getTendencia.calls.mostRecent().args[0];
    expect(args.endDate).toBe(component.endDate());
    const [y, m] = component.endDate().split('-').map(Number);
    const esperado = new Date(y, m - 1 - 5, 1);
    expect(args.startDate).toBe(`${esperado.getFullYear()}-${String(esperado.getMonth() + 1).padStart(2, '0')}-01`);
  });

  it('reparte el monto del periodo por estado y deja fuera lo anterior al rango', () => {
    const rows = component.porEstado().rows;
    expect(rows.find((r) => r.key === 'APROBADO')!.amount).toBe(100);
    expect(rows.find((r) => r.key === 'PENDIENTE')!.amount).toBe(70);
    expect(rows.find((r) => r.key === 'RECHAZADO')!.count).toBe(1);
    expect(component.porEstado().total).toBe(200);
  });

  it('la cola muestra solo pendientes, la más antigua primero', () => {
    expect(component.cola().map((f) => f.facturaId)).toEqual(['b', 'c']);
  });

  it('ordena las categorías por monto, de mayor a menor', () => {
    expect(component.categoriasOrdenadas().map((c) => c.name)).toEqual(['Hotel', 'Comida']);
    expect(component.categoriasOrdenadas()[0].width).toBe(100);
  });

  it('exige un motivo para rechazar y lo envía al backend', () => {
    const f = component.cola()[0];
    component.empezarRechazo(f);
    component.motivo.set('x');
    component.confirmarRechazo(f);
    expect(facadeMock.facturas.updateEstado).not.toHaveBeenCalled();

    component.motivo.set('No corresponde a la empresa');
    component.confirmarRechazo(f);
    expect(facadeMock.facturas.updateEstado).toHaveBeenCalledWith('b', 'RECHAZADO', 'No corresponde a la empresa');
  });

  it('muestra un error claro y deja de cargar si falla una petición', () => {
    facadeMock.dashboard.getResumen.and.returnValue(throwError(() => new Error('network down')));
    component.load();
    expect(component.loading()).toBeFalse();
    expect(component.error()).toContain('No se pudieron cargar');
  });
});
