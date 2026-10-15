import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnboardingPaso1Component } from './onboarding-paso1.component';

describe('OnboardingPaso1Component', () => {
  let component: OnboardingPaso1Component;
  let fixture: ComponentFixture<OnboardingPaso1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      imports: [OnboardingPaso1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OnboardingPaso1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
