import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { BreadcrumbItem } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
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
import { ClasificadorEstimacionIngresos, MESES_ESTIMACION_INGRESOS, NOMBRES_FUENTE_FINANCIAMIENTO } from '../../models/estimacion-ingresos.model';
import { EstimacionIngresosBaseLegalLecturaComponent } from '../solicitud/detalles/estimacion-ingresos-base-legal-lectura.component';

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
 */
@Component({
  selector: 'siaf-estimacion-ingresos-registro-detalle',
  standalone: true,
  imports: [
    DecimalPipe,
    EstimacionIngresosBaseLegalLecturaComponent,
    ExpansionPanelComponent,
    IconComponent,
    MessageBoxComponent,
    ReadonlyFieldComponent,
    SolicitudeFormCardComponent,
    SolicitudePageLayoutComponent,
    SummaryCardComponent,
  ],
  templateUrl: './estimacion-ingresos-registro-detalle.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimacionIngresosRegistroDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(EstimacionIngresosApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE, 'Detalle de estimación de ingresos');
  readonly meses = MESES_ESTIMACION_INGRESOS;
  readonly cargando = signal(true);
  readonly fila = signal<ClasificadorEstimacionIngresos | null>(null);
  readonly baseLegalAbierta = signal(true);
  private solicitudId = '';

  ngOnInit(): void {
    this.solicitudId = this.route.snapshot.paramMap.get('id') ?? '';
    const codigo = this.route.snapshot.paramMap.get('codigo') ?? '';
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
