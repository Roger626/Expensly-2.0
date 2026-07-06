import { Component, Input, Self } from '@angular/core';
import { ReactiveFormsModule, ControlValueAccessor, NgControl } from '@angular/forms';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-input',
  standalone:true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './input.component.html',
  styleUrl: './input.component.css'
})
export class InputComponent implements ControlValueAccessor {
  @Input() label: string = ''
  @Input() type: "text" | "password" | "email" | "date" | "number" = "text"
  @Input() placeholder: string = ''
  @Input() showPasswordToggle: boolean = true

  value: any
  disable:boolean = false
  passwordVisible = false

  onChange = (value: any) => {};
  onTouched = () => {};

  // Inyectamos NgControl para conectar este componente con la lógica de validación de Angular
  constructor(@Self() public controlDir: NgControl) {
    this.controlDir.valueAccessor = this;
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (this.type === 'number') {
      // Emit a proper JS number so @IsNumber() on the backend is satisfied.
      // Empty string → null so required/min validators behave correctly.
      this.value = target.value === '' ? null : parseFloat(target.value);
    } else {
      this.value = target.value;
    }
    this.onChange(this.value);
    this.onTouched();
  }

  // Métodos obligatorios de ControlValueAccessor
  writeValue(value: any): void {
    // null/undefined → '' so the input clears; 0 is a valid number (not falsy-coerced)
    this.value = value ?? '';
  }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disable = isDisabled; }

  

  get isInvalid() {
    return this.controlDir.control?.invalid && this.controlDir.control?.touched;
  }

  get inputType(): string {
    if (this.type === 'password' && this.passwordVisible) {
      return 'text';
    }

    return this.type;
  }

  togglePasswordVisibility(): void {
    if (this.type === 'password') {
      this.passwordVisible = !this.passwordVisible;
    }
  }
  


  

}
