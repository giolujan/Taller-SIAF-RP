import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Campo de solo lectura con caption flotante que muestra el valor o `--` cuando está vacío.
 *
 * Úsalo para mostrar datos ya grabados en las pantallas de consulta o en el modo lectura de una
 * solicitud. No confundir con `siaf-readonly`, que es otro componente distinto y sin consumidores.
 *
 * @usar
 * - En el modo lectura de una solicitud, en lugar del campo editable y con el mismo caption: cuenta contable, carga
 *   masiva del plan de cuentas, clase de ajuste, tipo de asiento y asiento de ajuste.
 * - Para los criterios de búsqueda sobre los resultados de las consultas (plan de cuentas, asiento de ajuste, tipos de
 *   asiento, contabilización) y la cabecera de un detalle o reporte (pedido de contabilización, apertura contable,
 *   libros contables).
 * - Para leer un dato con contraste completo: un campo `[disabled]` pinta el texto tenue (exento de contraste) y aquí
 *   el valor va en `text-neutral-high`.
 * - `[required]` solo para repetir el asterisco del campo editable, así la lectura se ve igual que la edición.
 * - `variant="highlight"` para un total calculado dentro de un formulario que se está editando: «Total» y «Saldo por
 *   distribuir» de la distribución mensual en «Editar estimación de ingresos».
 * @evitar
 * - Para un dato que el usuario puede cambiar: usar `siaf-input`, `text-area-control` o `siaf-date-time-picker`.
 * - Para el ítem elegido desde un panel lateral: usar `siaf-summary-card`; para un aviso breve, `message-box`.
 * - Confundirlo con `siaf-readonly`, el recuadro gris con etiqueta en mayúsculas que ninguna pantalla usa.
 * @teclado
 * - No recibe foco: no es interactivo.
 * @accesibilidad
 * - **1.3.1 Información y relaciones (A)**: es texto estático, no un campo: el caption va antes del valor en el DOM,
 *   así que se leen juntos y en orden; no usa `dt`/`dd` ni `aria-labelledby`.
 * - **1.4.3 Contraste mínimo (AA)**: caption `text-neutral-low` 5.01:1 (8.86:1 oscuro), valor `text-neutral-high`
 *   16.29:1 y asterisco `text-feedback-danger` 9.84:1 sobre `bg-surfaces-surface`. En `highlight` el valor va en
 *   negrita `text-neutral-medium` sobre `bg-surfaces-highlight` (azul al 8 % sobre la superficie: contraste casi igual
 *   al de la superficie sola); el caption sigue sobre su recuadro `bg-surface`.
 * - **1.4.1 Uso del color (A)**: el obligatorio se marca con un asterisco, no solo con el color.
 */
@Component({
  selector: 'readonly-field',
  standalone: true,
  template: `
    <div
      class="relative flex min-h-10 items-center rounded-siaf-md px-siaf-md py-siaf-xs"
      [class]="variant === 'highlight' ? 'bg-[var(--sys-color-bg-surfaces-highlight)]' : 'bg-surface'"
    >
      <span class="absolute -top-2.5 left-3 z-[1] rounded-siaf-sm bg-surface px-siaf-xxs text-xs font-medium text-text-muted">
        {{ captionText }}@if (required) { <span class="text-[var(--sys-color-text-feedback-danger)]">*</span> }
      </span>
      @if (variant === 'highlight') {
        <span class="min-w-0 text-sm font-bold leading-normal tracking-[-0.02px] text-[var(--sys-color-text-neutral-medium)]">{{ displayValue }}</span>
      } @else {
        <span class="min-w-0 text-sm leading-normal tracking-[0.0249px] text-text">{{ displayValue }}</span>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReadonlyFieldComponent {
  @Input() caption = '';
  @Input() value = '';
  @Input() required = false;
  /** `highlight`: fondo azul tenue y valor en negrita (Figma «Readonly Forms», node 11596:647453), para un resultado
   *  calculado dentro de un formulario editable. */
  @Input() variant: 'default' | 'highlight' = 'default';

  get captionText(): string {
    return this.caption.replace(/\s*\*$/, '');
  }

  get displayValue(): string {
    return this.value?.trim() ? this.value : '--';
  }
}

