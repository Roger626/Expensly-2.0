import { ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges } from '@angular/core';
import { ICONS, IconName } from './icons.generated';

/**
 * Ícono del set Solar (Iconify). Hereda color y tamaño del texto (1.25em).
 * En los íconos "bold-duotone" la capa secundaria toma --ico-tone (por defecto el mismo color al 50%).
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class.duo]': 'name.endsWith("bold-duotone")' },
})
export class IconComponent implements OnChanges {
  /** Nombre Solar. Acepta string para que el servidor de desarrollo no se quede con tipos viejos;
   *  `npm run icons` avisa si un nombre no existe en el set. */
  @Input({ required: true }) name!: IconName | (string & {});

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  ngOnChanges(): void {
    // ponytail: SVG estático generado en build desde el set Solar; no hay datos de usuario
    this.el.nativeElement.innerHTML =
      `<svg viewBox="0 0 24 24" width="100%" height="100%" focusable="false">${ICONS[this.name as IconName] ?? ''}</svg>`;
  }
}
