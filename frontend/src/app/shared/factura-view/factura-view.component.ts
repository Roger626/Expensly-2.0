import {
  Component, Input, Output, EventEmitter, CUSTOM_ELEMENTS_SCHEMA,
  ViewChild, ElementRef, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { register } from 'swiper/element/bundle';
register();

import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-factura-view',
  standalone: true,
  imports: [IconComponent, CommonModule],
  templateUrl: './factura-view.component.html',
  styleUrl: './factura-view.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FacturaViewComponent {
  @Input() imageUrls: string[] = [];
  @Output() lightboxChange = new EventEmitter<boolean>();
  @ViewChild('swiperRef') swiperRef!: ElementRef;

  // ─ Carrusel base
  currentIndex = 0;

  // ─ Lightbox
  lightboxOpen = false;
  lbZoom = 1;
  panX = 0;
  panY = 0;
  isDragging = false;
  startX = 0;
  startY = 0;

  readonly ZOOM_STEP = 0.5;
  readonly ZOOM_MAX  = 4;
  readonly ZOOM_MIN  = 0.5;

  get total():       number { return this.imageUrls.length; }
  get lbZoomPct():   string { return Math.round(this.lbZoom * 100) + '%'; }
  get currentImage(): string { return this.imageUrls[this.currentIndex] ?? ''; }
  get currentTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.lbZoom})`;
  }

  // ── Swiper slide change
  onSlideChange(): void {
    this.currentIndex =
      this.swiperRef?.nativeElement?.swiper?.activeIndex ?? 0;
  }

  prevSlide(): void { this.swiperRef?.nativeElement?.swiper?.slidePrev(); }
  nextSlide(): void { this.swiperRef?.nativeElement?.swiper?.slideNext(); }

  // ── Lightbox
  openLightbox(): void  {
    this.lightboxOpen = true;
    this.resetState();
    this.lightboxChange.emit(true);
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
    this.resetState();
    this.lightboxChange.emit(false);
  }

  resetState(): void {
    this.lbZoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
  }

  lbZoomIn():  void {
    const oldZoom = this.lbZoom;
    this.lbZoom = Math.min(+(this.lbZoom + this.ZOOM_STEP).toFixed(1), this.ZOOM_MAX);
    // Optional: adjust pan to keep center? For now just zoom.
  }

  lbZoomOut(): void {
    this.lbZoom = Math.max(+(this.lbZoom - this.ZOOM_STEP).toFixed(1), this.ZOOM_MIN);
    if (this.lbZoom <= 1) { this.panX = 0; this.panY = 0; }
  }

  resetZoom(): void {
    this.resetState();
  }

  lbPrev(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.resetState();
    }
  }

  lbNext(): void {
    if (this.currentIndex < this.total - 1) {
      this.currentIndex++;
      this.resetState();
    }
  }

  onLbWheel(e: WheelEvent): void {
    e.preventDefault();
    e.deltaY < 0 ? this.lbZoomIn() : this.lbZoomOut();
  }

  // ── Drag Logic (start)
  onMouseDown(e: MouseEvent): void {
    if (this.lbZoom <= 1) return;
    this.isDragging = true;
    this.startX = e.clientX - this.panX;
    this.startY = e.clientY - this.panY;
    e.preventDefault(); // prevent text selection
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    e.preventDefault();
    this.panX = e.clientX - this.startX;
    this.panY = e.clientY - this.startY;
  }

  onMouseUp(): void {
    this.isDragging = false;
  }
  // ── Drag Logic (end)

  // ── Keyboard shortcuts (solo cuando el lightbox está abierto)
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (!this.lightboxOpen) return;
    switch (e.key) {
      case 'Escape':     this.closeLightbox(); break;
      case 'ArrowLeft':  this.lbPrev();       break;
      case 'ArrowRight': this.lbNext();       break;
      case '+':          this.lbZoomIn();     break;
      case '-':          this.lbZoomOut();    break;
      case '0':          this.resetZoom();    break;
    }
  }
}
