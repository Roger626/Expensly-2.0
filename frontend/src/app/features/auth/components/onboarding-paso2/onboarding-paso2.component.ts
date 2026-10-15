import { IconComponent } from '../../../../shared/icon/icon.component';
import { Component, Output, EventEmitter } from '@angular/core';
import { InputComponent } from '../../../../shared/input/input/input.component';
import { FormBuilder, ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { passwordMatchValidator } from '../../../../shared/validators/password.validator';

@Component({
  selector: 'app-onboarding-paso2',
  standalone: true,
  imports: [IconComponent, InputComponent, ReactiveFormsModule],
  templateUrl: './onboarding-paso2.component.html',
  styleUrl: './onboarding-paso2.component.css'
})
export class OnboardingPaso2Component {
  onboardingForm: FormGroup;

  @Output() submitData = new EventEmitter<any>();  
  @Output() goBack = new EventEmitter<void>();

  constructor(
    private formBuilder: FormBuilder
  ){
    this.onboardingForm = this.formBuilder.group({
      nombre: new FormControl("", [Validators.required, Validators.minLength(3)]),
      email: new FormControl("", [Validators.required, Validators.email]),
      password: new FormControl("", [Validators.required, Validators.minLength(8)]),
      confirmPassword: new FormControl("", [Validators.required, Validators.minLength(8)])
    }, { validators: passwordMatchValidator})
  }

  setFormData(data: any) {
    if (data) {
      this.onboardingForm.patchValue(data);
    }
  }

  onSubmit(){
    if(this.onboardingForm.valid){
      this.submitData.emit(this.onboardingForm.value);
    }else{
      this.onboardingForm.markAllAsTouched();
    }
  }

  onRegresar(){
    this.goBack.emit();
  }
}
