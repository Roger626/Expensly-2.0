import { Component, OnInit } from '@angular/core';
import{ReactiveFormsModule, FormGroup, FormBuilder, Validators} from "@angular/forms"
import { CommonModule } from '@angular/common';
import { InputComponent } from '../../../../shared/input/input/input.component';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { passwordMatchValidator } from '../../../../shared/validators/password.validator';

@Component({
  selector: 'app-register',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputComponent,
    RouterLink,
  ],
  standalone:true,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup

  constructor(private fb: FormBuilder, private router: Router){
    this.registerForm = this.fb.group({
      name: ["", [Validators.required, Validators.minLength(3)]],
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(6)]],
      confirmPassword: ["", [Validators.required, Validators.minLength(6)]]
    }, { validators: passwordMatchValidator })
  }

  ngOnInit(): void {
    this.router.navigate(['/auth/onboarding']);
  }

  onSubmit(){
    if(this.registerForm.valid){
      console.log(this.registerForm.value);
      this.router.navigate(['auth/login']);
    }else{
      this.registerForm.markAllAsTouched();
    }
  }
}
