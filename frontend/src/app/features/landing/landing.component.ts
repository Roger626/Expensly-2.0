import { Component, HostListener, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  scrolled = false;
  menuOpen = false;
  showTop = false;
  email = '';
  emailValid = false;
  readonly year = new Date().getFullYear();

  private static readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private observer?: IntersectionObserver;

  constructor(private router: Router, private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const targets = Array.from(this.host.nativeElement.querySelectorAll('.reveal'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('is-visible'));
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
          entry.target.classList.add('is-visible');
          this.observer?.unobserve(entry.target);
        }
      }
    }, { threshold: 0.18, rootMargin: '0px 0px -12% 0px' });

    targets.forEach(el => this.observer?.observe(el));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const y = window.scrollY;
    this.scrolled = y > 8;
    this.showTop = y > 600;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  validateEmail(): void {
    this.emailValid = LandingComponent.EMAIL_RE.test(this.email.trim());
  }

  onEmailSubmit(): void {
    this.validateEmail();
    if (this.emailValid) {
      this.router.navigate(['/auth/onboarding'], { queryParams: { email: this.email.trim() } });
    }
  }

  scrollTo(id: string): void {
    this.menuOpen = false;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
