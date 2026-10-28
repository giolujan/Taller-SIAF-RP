import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

import { PermissionService } from '../../../../../core/auth/permission.service';
import { TextFieldOption } from '../../../../../shared/ui/text-field/text-field.component';
import { BreadcrumbItem } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { FormTableSearchComponent } from '../../../../../shared/components/form-table-search/form-table-search.component';
import { RequestApprovalModalsComponent } from '../../../../../shared/components/request-approval-modals/request-approval-modals.component';
import { SolicitudeHeaderRole, SolicitudeHeaderState } from '../../../../../shared/components/solicitude-header/solicitude-header.component';
import { SolicitudeInfoCardComponent, SolicitudeInfoField } from '../../../../../shared/components/solicitude-info-card/solicitude-info-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { TableControlsComponent } from '../../../../../shared/components/table-controls/table-controls.component';
import { ActionTrackerComponent, ActionTrackerSummary } from '../../../../../shared/ui/action-tracker/action-tracker.component';
import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { DocumentSummaryCardComponent } from '../../../../../shared/ui/document-summary-card/document-summary-card.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { SnackbarVariant } from '../../../../../shared/ui/snackbar/snackbar.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { crearSnapshotFormulario, hayCambiosRespectoAlSnapshot } from '../../../../../shared/utils/form-snapshot.util';
import { EstimacionIngresosApiService } from '../../api/estimacion-ingresos-api.service';
import { clasificadorRoute, PROCESS_ID, PROCESS_ROUTE, solicitudRoute } from '../../config/estimacion-ingresos.rutas';
import { ClasificadorEstimacionIngresos, DetalleEstimacionIngresos, TIPOS_MODIFICACION_ESTIMACION_INGRESOS } from '../../models/estimacion-ingresos.model';

/** ISO → "dd/mm/aaaa hh:mm:ss", como lo muestra el Figma. */
function aFechaHoraPe(iso: string): string {
  const fecha = new Date(iso);
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const hh = String(fecha.getHours()).padStart(2, '0');
  const mi = String(fecha.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${fecha.getFullYear()}     ${hh}:${mi}:${String(fecha.getSeconds()).padStart(2, '0')}`;
}

/**
 * «Solicitud de estimación de ingresos»: el documento queda «Elaborado» al crearse (sin paso de Grabar inicial),
 * pero sigue el flujo estándar creador/aprobador — Eliminar/Editar/Verificar para el creador en «Elaborado», Aprobar
 * para el aprobador en «Verificado» — hasta «Aprobado», estado final. Editar (Figma node 4021:103143) usa el estado
 * `edit` estándar del header (Cancelar/Grabar) y, en el cuerpo, vuelve editable «Tipo de modificación» y suma
 * buscador y selección a la tabla de clasificadores para poder quitar filas.
 *
 * Dos rutas llevan acá: `solicitud` (sin `:id`) la crea al entrar —viene de «Crear documento», con `tipoAccion` en
 * query params— y redirige a `solicitud/:id`; esta última solo carga y muestra el detalle ya creado.
 */
@Component({
  selector: 'siaf-estimacion-ingresos-solicitud',
  standalone: true,
  imports: [
    ActionTrackerComponent,
    AlertComponent,
    DecimalPipe,
    DocumentSummaryCardComponent,
    FormTableSearchComponent,
    ReadonlyFieldComponent,
    RequestApprovalModalsComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
    TableControlsComponent,
    TextFieldComponent,
  ],
  templateUrl: './estimacion-ingresos-solicitud.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimacionIngresosSolicitudComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly estimacionApi = inject(EstimacionIngresosApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly permissions = inject(PermissionService);

  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE, 'Solicitud de estimación de ingresos');
  readonly cargando = signal(true);
  readonly avisoAbierto = signal(true);
  readonly detalle = signal<DetalleEstimacionIngresos | null>(null);
  readonly saving = signal(false);

  readonly headerRole = computed<SolicitudeHeaderRole>(() => (this.permissions.currentRole() === 'approver' ? 'approver' : 'creator'));

  /** «Elaborado»: Eliminar/Editar/Verificar para el creador (o Cancelar/Grabar si está editando). «Verificado»:
   *  Aprobar para el aprobador. «Aprobado»: estado final, sin botones. */
  readonly headerState = computed<SolicitudeHeaderState>(() => {
    if (this.editando()) return 'edit';
    const estado = this.detalle()?.estado;
    if (estado === 'Aprobado') return 'approved';
    if (estado === 'Verificado') return 'verified';
    return 'elaborated';
  });

  readonly modalGrabar = signal(false);
  readonly modalVerificar = signal(false);
  readonly modalEliminar = signal(false);
  readonly modalAprobar = signal(false);
  readonly snackbarAbierto = signal(false);
  readonly snackbarVariante = signal<SnackbarVariant>('creation-verified');

  // ── Edición (Figma node 4021:103143): «Tipo de modificación» pasa a editable y la tabla de clasificadores suma
  // buscador y selección para quitar filas — Grabar solo con cambios, como el resto de solicitudes del taller.
  readonly editando = signal(false);
  readonly formTipoModificacion = signal('');
  readonly formClasificadores = signal<ClasificadorEstimacionIngresos[]>([]);
  readonly busquedaClasificadores = signal('');
  readonly seleccionados = signal<Set<number>>(new Set());
  readonly tiposModificacion: TextFieldOption[] = TIPOS_MODIFICACION_ESTIMACION_INGRESOS.map((v) => ({ label: v, value: v }));
  private fotoEdicion: string | null = null;

  /** Filas visibles: en edición, las del formulario filtradas por la búsqueda; en lectura, las del detalle. */
  readonly clasificadoresVisibles = computed<ClasificadorEstimacionIngresos[]>(() => {
    if (!this.editando()) return this.detalle()?.clasificadores ?? [];
    const texto = this.busquedaClasificadores().trim().toLowerCase();
    const filas = this.formClasificadores();
    return texto ? filas.filter((f) => f.clasificador.toLowerCase().includes(texto)) : filas;
  });

  readonly hayCambios = computed(() => {
    if (!this.editando()) return false;
    const actual = crearSnapshotFormulario({ tipoModificacion: this.formTipoModificacion(), clasificadores: this.formClasificadores() });
    return hayCambiosRespectoAlSnapshot(this.fotoEdicion, actual);
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((params) => {
        const id = params.get('id');
        this.cargando.set(true);
        this.detalle.set(null);
        this.avisoAbierto.set(true);

        if (id) {
          return this.estimacionApi.obtenerDetalle(id);
        }

        // Entrada sin `id` (desde «Crear documento»): crea el documento y reemplaza la URL por `solicitud/:id`.
        const tipoAccion = this.route.snapshot.queryParamMap.get('actionType') === 'modificacion' ? 'Modificación' : 'Creación';
        return this.estimacionApi.crear({ tipoAccion }).pipe(
          switchMap((creado) => {
            void this.router.navigate([solicitudRoute(creado.id)], { replaceUrl: true });
            return of(null);
          }),
        );
      }),
    ).subscribe({
      next: (detalle) => { if (detalle) { this.detalle.set(detalle); this.cargando.set(false); } },
      error: () => this.cargando.set(false),
    });
  }

  regresar(): void {
    void this.router.navigate([PROCESS_ROUTE]);
  }

  onConfirmarVerificar(): void {
    const id = this.detalle()?.documentoId;
    if (!id) return;
    this.modalVerificar.set(false);
    this.saving.set(true);
    this.estimacionApi.verificar(id).subscribe({
      next: () => { this.snackbarVariante.set('creation-verified'); this.snackbarAbierto.set(true); this.cargar(id); },
      error: () => this.saving.set(false),
    });
  }

  onConfirmarAprobar(): void {
    const id = this.detalle()?.documentoId;
    if (!id) return;
    this.modalAprobar.set(false);
    this.saving.set(true);
    this.estimacionApi.aprobar(id).subscribe({
      next: () => { this.snackbarVariante.set('creation-approved'); this.snackbarAbierto.set(true); this.cargar(id); },
      error: () => this.saving.set(false),
    });
  }

  onConfirmarEliminar(): void {
    const id = this.detalle()?.documentoId;
    if (!id) return;
    this.modalEliminar.set(false);
    this.saving.set(true);
    this.estimacionApi.eliminar(id).subscribe({
      next: () => void this.router.navigate([PROCESS_ROUTE]),
      error: () => this.saving.set(false),
    });
  }

  // ── Edición ───────────────────────────────────────────────────────
  iniciarEdicion(): void {
    const d = this.detalle();
    if (!d) return;
    this.formTipoModificacion.set(d.tipoModificacion ?? '');
    this.formClasificadores.set(d.clasificadores);
    this.busquedaClasificadores.set('');
    this.seleccionados.set(new Set());
    this.fotoEdicion = crearSnapshotFormulario({ tipoModificacion: d.tipoModificacion ?? '', clasificadores: d.clasificadores });
    this.editando.set(true);
  }

  cancelarEdicion(): void {
    this.editando.set(false);
  }

  toggleSeleccionTodas(marcar: boolean): void {
    this.seleccionados.set(marcar ? new Set(this.clasificadoresVisibles().map((_, i) => i)) : new Set());
  }

  toggleSeleccionFila(indice: number, marcar: boolean): void {
    this.seleccionados.update((actual) => {
      const nuevo = new Set(actual);
      marcar ? nuevo.add(indice) : nuevo.delete(indice);
      return nuevo;
    });
  }

  eliminarSeleccionadas(): void {
    const visibles = this.clasificadoresVisibles();
    const aQuitar = new Set(Array.from(this.seleccionados()).map((i) => visibles[i]?.clasificador));
    this.formClasificadores.update((filas) => filas.filter((f) => !aQuitar.has(f.clasificador)));
    this.seleccionados.set(new Set());
  }

  /** Lápiz de `siaf-table-controls`: solo con exactamente una fila elegida. Edita contra lo ya grabado (no lo
   *  pendiente de esta sesión de edición), así que al volver recarga el detalle completo desde el backend. */
  editarSeleccionada(): void {
    const d = this.detalle();
    const visibles = this.clasificadoresVisibles();
    const [indiceVisible] = this.seleccionados();
    if (!d || indiceVisible === undefined) return;
    const fila = visibles[indiceVisible];
    const indiceReal = d.clasificadores.findIndex((c) => c.clasificador === fila.clasificador);
    if (indiceReal === -1) return;
    void this.router.navigate([clasificadorRoute(d.documentoId, indiceReal)]);
  }

  onConfirmarGrabar(): void {
    const id = this.detalle()?.documentoId;
    if (!id || !this.hayCambios()) return;
    this.modalGrabar.set(false);
    this.saving.set(true);
    this.estimacionApi.actualizar(id, {
      tipoModificacionTexto: this.formTipoModificacion() || undefined,
      clasificadores: this.formClasificadores(),
    }).subscribe({
      next: () => {
        this.editando.set(false);
        this.snackbarVariante.set('changes-saved');
        this.snackbarAbierto.set(true);
        this.cargar(id);
      },
      error: () => this.saving.set(false),
    });
  }

  private cargar(id: string): void {
    this.estimacionApi.obtenerDetalle(id).subscribe({
      next: (detalle) => { this.detalle.set(detalle); this.saving.set(false); },
      error: () => this.saving.set(false),
    });
  }

  campos(): SolicitudeInfoField[] {
    const d = this.detalle();
    if (!d) return [];
    return [
      { label: 'Fecha', value: aFechaHoraPe(d.fecha) },
      { label: 'Ente rector', value: d.enteRector },
      { label: 'Entidad', value: d.entidad },
      { label: 'Unidad ejecutora', value: d.unidadEjecutora },
    ];
  }

  trazabilidad(): ActionTrackerSummary[] {
    const d = this.detalle();
    if (!d) return [];
    const items: ActionTrackerSummary[] = [{ label: 'Elaborado por', actionBy: d.elaboradoPor, date: aFechaHoraPe(d.fechaElaborado) }];
    if (d.verificadoPor) items.push({ label: 'Verificado por', actionBy: d.verificadoPor, date: d.fechaVerificado ? aFechaHoraPe(d.fechaVerificado) : '' });
    if (d.aprobadoPor) items.push({ label: 'Aprobado por', actionBy: d.aprobadoPor, date: d.fechaAprobado ? aFechaHoraPe(d.fechaAprobado) : '' });
    return items;
  }

  /** Fila TOTAL de la tabla de clasificadores: suma de la columna indicada. */
  totalColumna(clave: keyof Pick<ClasificadorEstimacionIngresos, 'promedioAnual' | 'anio2027' | 'anio2028' | 'anio2029' | 'variacionMonto'>): number {
    return this.clasificadoresVisibles().reduce((suma, fila) => suma + fila[clave], 0);
  }

  /** (f) del TOTAL: (e / a) x 100, igual que cada fila. */
  totalPorcentaje(): string {
    const a = this.totalColumna('promedioAnual');
    const e = this.totalColumna('variacionMonto');
    return a ? ((e / a) * 100).toFixed(1) : '0.0';
  }
}
