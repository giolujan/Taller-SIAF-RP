import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';

import { BreadcrumbItem } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudeInfoCardComponent, SolicitudeInfoField } from '../../../../../shared/components/solicitude-info-card/solicitude-info-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { ActionTrackerComponent, ActionTrackerSummary } from '../../../../../shared/ui/action-tracker/action-tracker.component';
import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { DocumentSummaryCardComponent } from '../../../../../shared/ui/document-summary-card/document-summary-card.component';
import { DataTableColumn, DataTableRow } from '../../../../../shared/components/data-table/data-table.component';
import { TableComponent } from '../../../../../shared/ui/table/table.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { IngresosTributariosSunatApiService } from '../../api/ingresos-tributarios-sunat-api.service';
import { PROCESS_ID, PROCESS_ROUTE } from '../../config/ingresos-tributarios-sunat.rutas';
import { DetalleDocumentoIngresoTributario } from '../../models/ingreso-tributario.model';

const COLUMNAS_DETALLE: DataTableColumn[] = [
  { key: 'campo', label: 'Campo' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'valor', label: 'Valor' },
];

/**
 * Detalle de un documento de Ingresos tributarios SUNAT (ej. «Solicitud automática de Nota de débito»): a diferencia
 * de la solicitud de un proceso con creador/aprobador, es de solo lectura — sin Grabar, Editar ni Verificar/Aprobar —
 * porque lo generó el motor de integración con SUNAT, no un usuario.
 */
@Component({
  selector: 'siaf-ingreso-tributario-detalle',
  standalone: true,
  imports: [
    ActionTrackerComponent,
    AlertComponent,
    DocumentSummaryCardComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
    TableComponent,
  ],
  templateUrl: './ingreso-tributario-detalle.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IngresoTributarioDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ingresosApi = inject(IngresosTributariosSunatApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE, 'Detalle del documento');
  readonly cargando = signal(true);
  readonly avisoAbierto = signal(true);
  readonly detalle = signal<DetalleDocumentoIngresoTributario | null>(null);

  readonly columnasDetalle = COLUMNAS_DETALLE;

  ngOnInit(): void {
    // Por `id`, no por snapshot una sola vez: al navegar de un documento a otro por un link interno (misma ruta,
    // solo cambia `:id`) Angular reutiliza este componente y `ngOnInit` no se vuelve a ejecutar — sin esto, el
    // detalle se quedaba pegado al primer documento que se abrió en la sesión.
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((params) => {
        const id = params.get('id');
        this.cargando.set(true);
        this.detalle.set(null);
        this.avisoAbierto.set(true);
        return id ? this.ingresosApi.obtenerDetalle(id) : [];
      }),
    ).subscribe({
      next: (detalle) => { this.detalle.set(detalle); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  regresar(): void {
    // Marca en la URL que la bandeja la abre «Regresar» (no el menú de Procesos): no reinicia la simulación en
    // vivo. Va en un query param, no en `history.state`: ese queda pegado a la entrada del historial entre
    // recargas y una navegación «directa» posterior lo heredaría igual.
    void this.router.navigate([PROCESS_ROUTE], { queryParams: { origen: 'detalle' } });
  }

  campos(): SolicitudeInfoField[] {
    const d = this.detalle();
    if (!d) return [];
    return [
      { label: 'Fecha', value: d.fecha },
      { label: 'Ente rector', value: d.enteRector },
    ];
  }

  filas(): DataTableRow[] {
    return (this.detalle()?.campos ?? []).map((c) => ({ campo: c.campo, descripcion: c.descripcion, valor: c.valor }));
  }

  trazabilidad(): ActionTrackerSummary[] {
    const d = this.detalle();
    if (!d) return [];
    const items: ActionTrackerSummary[] = [
      { label: d.accionLabel ?? 'Registrado por', actionBy: d.registradoPor, date: d.fechaRegistrado },
    ];
    if (d.procesadoPor) items.push({ label: 'Procesado por', actionBy: d.procesadoPor, date: d.fechaProcesado ?? '' });
    return items;
  }
}
