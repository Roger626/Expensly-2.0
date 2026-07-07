import { Component, EventEmitter, Output } from '@angular/core';
import { RouterLink, RouterModule, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, FileText, PlusCircle, Users, LayoutGrid, LogOut, ChevronRight, ChevronLeft, CreditCard } from 'lucide-angular';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterModule, RouterLinkActive, CommonModule, LucideAngularModule
  ],
  providers: [{
    provide: 'LUCIDE_ICONS',
    useValue: {
        FileText,
        PlusCircle,
        Users,
        LayoutGrid,
        LogOut,
        ChevronRight,
        ChevronLeft,
        CreditCard
      }
  }],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {

  isCollapsed = false;
  @Output() logout = new EventEmitter<void>();
  @Output() collapsedChange = new EventEmitter<boolean>();

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    this.collapsedChange.emit(this.isCollapsed);
  }

  onLogout(): void {
    this.logout.emit();
  }
}
