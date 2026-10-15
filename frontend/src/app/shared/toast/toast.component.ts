import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ToastService, ToastType } from './toast.service';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons.generated';

const ICON: Record<ToastType, IconName> = {
  success: 'check-circle-bold-duotone',
  error: 'close-circle-bold-duotone',
  warning: 'danger-triangle-bold-duotone',
  info: 'info-circle-bold-duotone',
};

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [AsyncPipe, IconComponent],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css',
})
export class ToastComponent {
  protected readonly toastService = inject(ToastService);
  protected readonly toasts$ = this.toastService.toasts$;
  protected readonly icon = ICON;

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
