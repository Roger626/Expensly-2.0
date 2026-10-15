import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CargarFacturaComponent } from './cargar-factura.component';

describe('CargarFacturaComponent', () => {
  let component: CargarFacturaComponent;
  let fixture: ComponentFixture<CargarFacturaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      imports: [CargarFacturaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CargarFacturaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
