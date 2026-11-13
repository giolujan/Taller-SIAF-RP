import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';

import { RequestApprovalModalsComponent } from '../../../../../../shared/components/request-approval-modals/request-approval-modals.component';
import { IconComponent } from '../../../../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../../../../shared/ui/modal/modal.component';
import { SideNavComponent } from '../../../../../../shared/ui/side-nav/side-nav.component';
import { TextAreaControlComponent } from '../../../../../../shared/ui/text-area-control/text-area-control.component';
import { EstimacionIngresosApiService } from '../../../api/estimacion-ingresos-api.service';
import { AmbitoConsolidado } from '../../../config/estimacion-ingresos.rutas';
import {
  ClasificadorEstimacionIngresos,
  NOMBRES_FUENTE_FINANCIAMIENTO,
  UMBRAL_VARIACION_ESTIMACION_INGRESOS,
} from '../../../models/estimacion-ingresos.model';

/** Qué evaluación se abre: Validar (modal) u Observar (panel). */
export type AccionEvaluarRegistro = 'validar' | 'observar';

/** Comentario que completa el doble clic en «Observar registro» (prototipo). */
const COMENTARIO_OBSERVACION_DEMO =
  'La información es insuficiente y omite detalles clave necesarios para una evaluación precisa. El documento de sustento utilizado es incorrecto para justificar esta sobreestimación de ingresos.';

/**
 * Evaluación de un registro de estimación de ingresos por el Revisor / Evaluador: «¿Validar registro?» (Figma node
 * 2926:296754, modal con la ilustración «Validate») y «Observar registro» (Figma node 9412:331009, panel corto con el
 * resumen del registro y el comentario; el doble clic en el comentario lo completa en la demo). Al aceptar guarda la
 * evaluación, muestra el snackbar y emite `evaluado` con el registro actualizado.
 *
 * Lo usan el detalle del registro (botones de la cabecera), la solicitud y el consolidado pliego (menú ⋮ de cada
 * registro). Con `ambito`, el registro es de un consolidado (`solicitudId` es el id del consolidado).
 */
@Component({
  selector: 'siaf-estimacion-ingresos-evaluar-registro',
  standalone: true,
  imports: [DecimalPipe, IconComponent, ModalComponent, RequestApprovalModalsComponent, SideNavComponent, TextAreaControlComponent],
  template: `
    <!-- «¿Validar registro?» (Figma node 2926:296754): ilustración «Validate» del kit. -->
    <siaf-modal
      variant="validate"
      title="¿Validar registro?"
      description="El registro será validado."
      [open]="accion === 'validar'"
      confirmVariant="primary"
      confirmLabel="Aceptar"
      cancelLabel="Cancelar"
      [showIllustration]="true"
      [confirmDisabled]="guardando()"
      (canceled)="cerrado.emit()"
      (closed)="cerrado.emit()"
      (confirmed)="evaluar('Validado')"
    />

    <!-- «Observar registro» (Figma node 9412:331009): panel corto con el resumen del registro y el comentario. -->
    <siaf-side-nav
      title="Observar registro"
      [open]="accion === 'observar'"
      [floating]="true"
      [confirmDisabled]="guardando() || !comentario().trim()"
      (closed)="cerrado.emit()"
      (confirmed)="evaluar('Observado')"
    >
      @if (resumen(); as r) {
        <div class="flex flex-col gap-siaf-lg px-siaf-md py-siaf-xs">
          <dl class="m-0 flex flex-col gap-siaf-lg rounded-siaf-md bg-[var(--sys-color-bg-surfaces-surface-low)] p-siaf-md">
            <div class="flex flex-col gap-siaf-xxs">
              <dt class="text-[11px] font-medium uppercase tracking-[0.66px] text-[var(--sys-color-text-neutral-low)]">Fuente de financiamiento</dt>
              <dd class="m-0 text-sm text-text">{{ r.fuente }}</dd>
            </div>
            <div class="flex flex-col gap-siaf-xxs">
              <dt class="text-[11px] font-medium uppercase tracking-[0.66px] text-[var(--sys-color-text-neutral-low)]">Sub fuente de financiamiento</dt>
              <dd class="m-0 text-sm text-text">{{ r.subFuente }}</dd>
            </div>
            <div class="flex flex-col gap-siaf-xxs">
              <dt class="text-[11px] font-medium uppercase tracking-[0.66px] text-[var(--sys-color-text-neutral-low)]">Clasificador de ingresos</dt>
              <dd class="m-0 text-sm text-text">{{ r.clasificador }}</dd>
            </div>
            <div class="flex flex-col gap-siaf-xxs">
              <dt class="text-[11px] font-medium uppercase tracking-[0.66px] text-[var(--sys-color-text-neutral-low)]">Variación %</dt>
              <dd class="m-0 inline-flex items-center gap-siaf-sm text-sm text-text">
                @if (r.variacion > umbralVariacion) {
                  <siaf-icon name="trending_up" [size]="24" label="Variación fuera del umbral" [decorative]="false" />
                }
                {{ r.variacion | number: '1.1-1' }}
              </dd>
            </div>
          </dl>
          <!-- Prototipo: doble clic completa el comentario de la demo y habilita Aceptar. -->
          <text-area-control
            (dblclick)="completarComentarioDemo($event)"
            placeholder="Comentario de observación"
            [maxlength]="200"
            [value]="comentario()"
            (valueChange)="comentario.set($event)"
          />
        </div>
      }
    </siaf-side-nav>

    <siaf-request-approval-modals
      [saving]="guardando()"
      snackbarVariant="custom"
      [snackbarMessage]="avisoTexto()"
      [snackbarOpen]="avisoAbierto()"
      (snackbarClosed)="avisoAbierto.set(false)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimacionIngresosEvaluarRegistroComponent implements OnChanges {
  private readonly api = inject(EstimacionIngresosApiService);

  /** Solicitud (aprobada) a la que pertenece el registro; con `ambito`, el consolidado. */
  @Input() solicitudId = '';
  /** El registro es de un consolidado (pliego o DGTP) en vez de una solicitud. */
  @Input() ambito: AmbitoConsolidado | null = null;
  /** Registro a evaluar. */
  @Input() fila: ClasificadorEstimacionIngresos | null = null;
  /** Qué se abre; `null` lo cierra todo. */
  @Input() accion: AccionEvaluarRegistro | null = null;
  /** Cancelar, la X, Escape o el fondo: el padre pone `accion` en `null`. */
  @Output() cerrado = new EventEmitter<void>();
  /** El registro ya evaluado (Validado u Observado). */
  @Output() evaluado = new EventEmitter<ClasificadorEstimacionIngresos>();

  readonly umbralVariacion = UMBRAL_VARIACION_ESTIMACION_INGRESOS;
  readonly guardando = signal(false);
  readonly comentario = signal('');
  readonly avisoAbierto = signal(false);
  readonly avisoTexto = signal('');
  private readonly filaS = signal<ClasificadorEstimacionIngresos | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fila']) this.filaS.set(this.fila);
    if (changes['accion'] && this.accion === 'observar') this.comentario.set('');
  }

  /** Resumen del panel: fuente (2), sub fuente (09), clasificador y variación (%). */
  readonly resumen = computed(() => {
    const f = this.filaS();
    if (!f) return null;
    const [fuente, subFuente] = f.ff.split('.');
    const nombre = (f.ffDescripcion ?? NOMBRES_FUENTE_FINANCIAMIENTO[f.ff] ?? '').toUpperCase();
    return {
      fuente: `${fuente} ${nombre}`.trim(),
      subFuente: `${subFuente ?? ''} ${nombre}`.trim(),
      clasificador: f.clasificador,
      variacion: f.variacionPorcentaje,
    };
  });

  /**
   * Prototipo: doble clic en «Comentario de observación» lo completa con el texto de la demo. Escribe en el
   * `<textarea>` como si lo tecleara el usuario (el campo enfocado no toma valores del padre).
   */
  completarComentarioDemo(evento: MouseEvent): void {
    const campo = evento.target as HTMLElement | null;
    if (!(campo instanceof HTMLTextAreaElement)) return;
    campo.value = COMENTARIO_OBSERVACION_DEMO;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  }

  evaluar(estado: 'Validado' | 'Observado'): void {
    const f = this.filaS();
    const comentario = this.comentario().trim();
    if (!f || (estado === 'Observado' && !comentario)) return;
    const codigo = f.clasificador.split(' ')[0];
    this.guardando.set(true);
    const motivo = estado === 'Observado' ? comentario : undefined;
    const evaluar$ = this.ambito
      ? this.api.evaluarRegistroConsolidado(this.ambito, this.solicitudId, codigo, estado, motivo)
      : this.api.evaluarRegistro(this.solicitudId, codigo, estado, motivo);
    evaluar$.subscribe({
      next: (actualizado) => {
        this.guardando.set(false);
        this.cerrado.emit();
        this.evaluado.emit(actualizado);
        this.avisoTexto.set(`El registro ${codigo} se ${estado === 'Validado' ? 'validó' : 'observó'} con éxito.`);
        this.avisoAbierto.set(true);
      },
      error: () => this.guardando.set(false),
    });
  }
}
