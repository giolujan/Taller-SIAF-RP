import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { PermissionService } from '../../../../../core/auth/permission.service';
import { BreadcrumbItem } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { RequestApprovalModalsComponent } from '../../../../../shared/components/request-approval-modals/request-approval-modals.component';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { SideNavComponent } from '../../../../../shared/ui/side-nav/side-nav.component';
import { TextAreaControlComponent } from '../../../../../shared/ui/text-area-control/text-area-control.component';
import { RecordStatusTagComponent } from '../../../../../shared/ui/record-status-tag/record-status-tag.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { ExpansionPanelComponent } from '../../../../../shared/ui/expansion-panel/expansion-panel.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { MessageBoxComponent } from '../../../../../shared/ui/message-box/message-box.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { SummaryCardComponent, SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { EstimacionIngresosApiService } from '../../api/estimacion-ingresos-api.service';
import { PROCESS_ID, PROCESS_ROUTE, solicitudRoute } from '../../config/estimacion-ingresos.rutas';
import {
  ClasificadorEstimacionIngresos,
  MESES_ESTIMACION_INGRESOS,
  NOMBRES_FUENTE_FINANCIAMIENTO,
  UMBRAL_VARIACION_ESTIMACION_INGRESOS,
} from '../../models/estimacion-ingresos.model';
import { EstimacionIngresosBaseLegalLecturaComponent } from '../solicitud/detalles/estimacion-ingresos-base-legal-lectura.component';

/** Comentario que completa el doble clic en «Observar registro» (prototipo). */
const COMENTARIO_OBSERVACION_DEMO =
  'La información es insuficiente y omite detalles clave necesarios para una evaluación precisa. El documento de sustento utilizado es incorrecto para justificar esta sobreestimación de ingresos.';

/** Variación de un año contra otro: monto y porcentaje con signo, como las tarjetas del Figma. */
interface Variacion {
  titulo: string;
  monto: number;
  porcentaje: string;
}

/**
 * «Detalle de estimación de ingresos» (Figma node 4524:194826): un registro de la solicitud en solo lectura, al que
 * se llega con clic en su fila de la tabla de una solicitud ya grabada. Muestra lo mismo que «Editar estimación de
 * ingresos» (fuente, clasificador, recaudación, variación, sustento, distribución mensual y la base legal de uso
 * específico en un panel desplegable), sin botones: la flecha vuelve a la solicitud.
 *
 * Revisor / Evaluador (Figma node 14755:89809): suma la sección «Registro» con el estado de la evaluación (Pendiente,
 * Observado, Validado) y los botones Observar (pide comentario) y Validar en la cabecera, mientras el registro siga
 * pendiente.
 */
@Component({
  selector: 'siaf-estimacion-ingresos-registro-detalle',
  standalone: true,
  imports: [
    ButtonComponent,
    DecimalPipe,
    RecordStatusTagComponent,
    RequestApprovalModalsComponent,
    EstimacionIngresosBaseLegalLecturaComponent,
    ExpansionPanelComponent,
    IconComponent,
    MessageBoxComponent,
    ModalComponent,
    ReadonlyFieldComponent,
    SolicitudeFormCardComponent,
    SolicitudePageLayoutComponent,
    SideNavComponent,
    SummaryCardComponent,
    TextAreaControlComponent,
  ],
  templateUrl: './estimacion-ingresos-registro-detalle.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimacionIngresosRegistroDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(EstimacionIngresosApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly permissions = inject(PermissionService);

  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE, 'Detalle de estimación de ingresos');
  readonly meses = MESES_ESTIMACION_INGRESOS;
  readonly cargando = signal(true);
  readonly fila = signal<ClasificadorEstimacionIngresos | null>(null);
  readonly baseLegalAbierta = signal(true);
  private solicitudId = '';
  private codigo = '';

  /** Revisor / Evaluador (rol `reviewer`): ve el estado del registro y lo valida u observa. */
  readonly esEvaluador = computed(() => this.permissions.currentRole() === 'reviewer');
  readonly estadoEvaluacion = computed(() => this.fila()?.estadoEvaluacion ?? 'Pendiente');
  /** Ya evaluado (Validado u Observado): los botones se apagan. */
  readonly evaluado = computed(() => this.estadoEvaluacion() !== 'Pendiente');
  readonly guardando = signal(false);
  /** «Observar registro» (Figma node 9412:331009): panel corto con el resumen del registro y el comentario. */
  readonly modalObservar = signal(false);
  readonly umbralVariacion = UMBRAL_VARIACION_ESTIMACION_INGRESOS;

  /** Resumen del panel: fuente (2), sub fuente (09), clasificador y variación (%). */
  readonly resumenObservar = computed(() => {
    const f = this.fila();
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
  /** «¿Validar registro?» (Figma node 2926:296754): Aceptar valida y muestra el snackbar. */
  readonly modalValidar = signal(false);
  readonly comentario = signal('');
  readonly avisoAbierto = signal(false);
  readonly avisoTexto = signal('');

  ngOnInit(): void {
    this.solicitudId = this.route.snapshot.paramMap.get('id') ?? '';
    const codigo = this.route.snapshot.paramMap.get('codigo') ?? '';
    this.codigo = codigo;
    this.api
      .obtenerDetalle(this.solicitudId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          this.fila.set(detalle.clasificadores.find((c) => c.clasificador.split(' ')[0] === codigo) ?? null);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  /** Revisor: Validar abre «¿Validar registro?». */
  validar(): void {
    this.modalValidar.set(true);
  }

  /** Aceptar del modal: el registro queda Validado y sale el snackbar. */
  onConfirmarValidar(): void {
    this.modalValidar.set(false);
    this.evaluar('Validado');
  }

  abrirObservar(): void {
    this.comentario.set('');
    this.modalObservar.set(true);
  }

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

  /** Revisor: Observar el registro con el comentario del panel. */
  onConfirmarObservar(): void {
    const comentario = this.comentario().trim();
    if (!comentario) return;
    this.modalObservar.set(false);
    this.evaluar('Observado', comentario);
  }

  private evaluar(estado: 'Validado' | 'Observado', comentario?: string): void {
    this.guardando.set(true);
    this.api.evaluarRegistro(this.solicitudId, this.codigo, estado, comentario).subscribe({
      next: (fila) => {
        this.fila.set(fila);
        this.guardando.set(false);
        this.avisoTexto.set(`El registro ${this.codigo} se ${estado === 'Validado' ? 'validó' : 'observó'} con éxito.`);
        this.avisoAbierto.set(true);
      },
      error: () => this.guardando.set(false),
    });
  }

  regresar(): void {
    void this.router.navigate([solicitudRoute(this.solicitudId)]);
  }

  private readonly partesClasificador = computed(() => {
    const texto = this.fila()?.clasificador ?? '';
    const corte = texto.indexOf(' ');
    return { codigo: corte === -1 ? texto : texto.slice(0, corte), nombre: corte === -1 ? '' : texto.slice(corte + 1) };
  });

  readonly camposFuente = computed<SummaryCardField[]>(() => {
    const f = this.fila();
    return [
      { label: 'Código', value: f?.ff ?? '', icon: 'info', iconLabel: 'Fuente de financiamiento' },
      { label: 'Descripción / Nombre', value: f?.ffDescripcion ?? (f ? NOMBRES_FUENTE_FINANCIAMIENTO[f.ff] ?? '—' : '—') },
      { label: 'Sigla', value: f?.ffSigla ?? '—' },
    ];
  });

  readonly camposClasificador = computed<SummaryCardField[]>(() => [
    { label: 'Código', value: this.partesClasificador().codigo, icon: 'info', iconLabel: 'Clasificador de ingresos' },
    { label: 'Nombre', value: this.partesClasificador().nombre },
  ]);

  readonly variaciones = computed<Variacion[]>(() => {
    const f = this.fila();
    if (!f) return [];
    return [
      this.variacion('2027 (b) vs promedio anual (a)', f.anio2027, f.promedioAnual),
      this.variacion('2028 (c) vs 2027 (b)', f.anio2028, f.anio2027),
      this.variacion('2029 (d) vs 2028 (c)', f.anio2029, f.anio2028),
    ];
  });

  /** Montos de enero a diciembre como texto con separador de miles (vacío si el registro no tiene distribución). */
  readonly mesesTexto = computed(() => {
    const montos = this.fila()?.distribucionMensual ?? [];
    return this.meses.map((_, i) => (montos[i] !== undefined ? montos[i].toLocaleString('en-US') : ''));
  });
  readonly totalMeses = computed(() => (this.fila()?.distribucionMensual ?? []).reduce((suma, m) => suma + (m ?? 0), 0));
  readonly saldoPorDistribuir = computed(() => (this.fila()?.anio2027 ?? 0) - this.totalMeses());

  private variacion(titulo: string, actual: number, anterior: number): Variacion {
    const monto = actual - anterior;
    const porcentaje = anterior ? (monto / anterior) * 100 : 0;
    return { titulo, monto, porcentaje: `${porcentaje > 0 ? '+' : ''}${porcentaje.toFixed(1)}%` };
  }
}
