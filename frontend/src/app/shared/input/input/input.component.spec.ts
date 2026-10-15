import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputComponent } from './input.component';

@Component({
  standalone: true,
  imports: [InputComponent, ReactiveFormsModule],
  template: `<app-input label="Total" type="number" [formControl]="ctrl" />`,
})
class HostComponent {
  ctrl = new FormControl<number | null>(null, Validators.required);
}

describe('InputComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('enlaza la etiqueta con el campo y emite números en type="number"', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
    expect(label.htmlFor).toBe(input.id);

    input.value = '25.15';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.ctrl.value).toBe(25.15);
  });
});
