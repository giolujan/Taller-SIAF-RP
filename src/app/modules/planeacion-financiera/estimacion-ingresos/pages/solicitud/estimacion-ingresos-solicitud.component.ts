import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs/operators';

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
import { ButtonGroupItem, ButtonsGroupComponent } from '../../../../../shared/ui/buttons-group/buttons-group.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { IconDropdownMenuComponent, IconDropdownMenuItem } from '../../../../../shared/ui/icon-dropdown-menu/icon-dropdown-menu.component';
import { TabItem, TabsComponent } from '../../../../../shared/ui/tabs/tabs.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { SnackbarVariant } from '../../../../../shared/ui/snackbar/snackbar.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { crearSnapshotFormulario, hayCambiosRespectoAlSnapshot } from '../../../../../shared/utils/form-snapshot.util';
import { EstimacionIngresosApiService } from '../../api/estimacion-ingresos-api.service';
import { PROCESS_ID, PROCESS_ROUTE, registroRoute, solicitudRoute } from '../../config/estimacion-ingresos.rutas';
import { EstimacionIngresosEditarClasificadorComponent } from './editar-clasificador/estimacion-ingresos-editar-clasificador.component';
import { EstimacionIngresosDetalleBaseLegalComponent } from './detalles/estimacion-ingresos-detalle-base-legal.component';
import { EstimacionIngresosDetalleRecaudacionComponent } from './detalles/estimacion-ingresos-detalle-recaudacion.component';
import {
  ClasificadorEstimacionIngresos,
  DetalleEstimacionIngresos,
  MESES_ESTIMACION_INGRESOS,
  NOMBRES_FUENTE_FINANCIAMIENTO,
  calcularVariacionEstimacion,
  PrecargaEstimacionIngresos,
  TIPOS_MODIFICACION_ESTIMACION_INGRESOS,
  UMBRAL_VARIACION_ESTIMACION_INGRESOS,
} from '../../models/estimacion-ingresos.model';

type VistaTabla = 'estimacion' | 'mensual' | 'ff';
type PestanaFF = 'mensualizado' | 'multianual';

/** Una fila de «Total por FF»: lo de sus clasificadores sumado. */
interface TotalFuenteFinanciamiento {
  ff: string;
  nombre: string;
  meses: number[];
  promedioAnual: number;
  anio2027: number;
  anio2028: number;
  anio2029: number;
  variacionMonto: number;
  variacionPorcentaje: number;
}

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
 * «Solicitud de estimación de ingresos» con el flujo estándar creador/aprobador.
 *
 * Dos rutas llevan acá:
 * - `solicitud` (sin `:id`), desde Aceptar en «Crear documento» con `actionType` en query params: la solicitud
 *   «Nuevo» (Figma node 2448:143931), sin número ni estado — Cancelar, Grabar y Verificar deshabilitado. Grabar la
 *   crea en «Elaborado» y abre `solicitud/:id` con el aviso de grabado.
 * - `solicitud/:id`: el documento ya grabado. Eliminar/Editar/Verificar para el creador en «Elaborado», Aprobar para
 *   el aprobador en «Verificado», hasta «Aprobado», estado final. Editar (Figma node 4021:103143) usa el estado `edit`
 *   estándar del header (Cancelar/Grabar, Grabar solo con cambios).
 */
@Component({
  selector: 'siaf-estimacion-ingresos-solicitud',
  standalone: true,
  imports: [
    ActionTrackerComponent,
    ButtonsGroupComponent,
    DecimalPipe,
    RouterLink,
    DocumentSummaryCardComponent,
    EstimacionIngresosDetalleBaseLegalComponent,
    EstimacionIngresosDetalleRecaudacionComponent,
    EstimacionIngresosEditarClasificadorComponent,
    FormTableSearchComponent,
    IconComponent,
    AlertComponent,
    IconDropdownMenuComponent,
    ReadonlyFieldComponent,
    RequestApprovalModalsComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
    TableControlsComponent,
    TabsComponent,
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
  readonly umbralVariacion = UMBRAL_VARIACION_ESTIMACION_INGRESOS;
  readonly cargando = signal(true);
  readonly saving = signal(false);

  /** Documento ya grabado (`solicitud/:id`). */
  readonly detalle = signal<DetalleEstimacionIngresos | null>(null);
  /** Solicitud «Nuevo» (`solicitud` sin `:id`): lo precargado, aún sin grabar. */
  readonly precarga = signal<PrecargaEstimacionIngresos | null>(null);
  readonly esNuevo = computed(() => this.precarga() !== null);
  /** Creación o Modificación: del documento grabado o, en «Nuevo», del `actionType` de «Crear documento». */
  readonly tipoAccion = signal('');

  readonly headerRole = computed<SolicitudeHeaderRole>(() => (this.permissions.currentRole() === 'approver' ? 'approver' : 'creator'));

  /** «Nuevo»: Cancelar/Grabar/Verificar deshabilitado. «Elaborado»: Eliminar/Editar/Verificar para el creador (o
   *  Cancelar/Grabar si está editando). «Verificado»: Aprobar para el aprobador. «Aprobado»: sin botones. */
  readonly headerState = computed<SolicitudeHeaderState>(() => {
    if (this.esNuevo()) return 'new';
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
  readonly snackbarVariante = signal<SnackbarVariant>('creation-elaborated');

  // ── Formulario: en «Nuevo» y en edición la tabla suma selección y «Tipo de modificación» pasa a editable.
  readonly editando = signal(false);
  readonly formTipoModificacion = signal('');
  readonly formClasificadores = signal<ClasificadorEstimacionIngresos[]>([]);
  readonly busquedaClasificadores = signal('');
  readonly seleccionados = signal<Set<number>>(new Set());
  /** Índice en `formClasificadores` de la fila abierta en «Editar estimación de ingresos» (Figma node 4145:309441). */
  readonly filaEnEdicion = signal<number | null>(null);
  readonly filaEditada = computed(() => {
    const indice = this.filaEnEdicion();
    return indice === null ? null : (this.formClasificadores()[indice] ?? null);
  });
  readonly tiposModificacion: TextFieldOption[] = TIPOS_MODIFICACION_ESTIMACION_INGRESOS.map((v) => ({ label: v, value: v }));
  private fotoEdicion: string | null = null;

  readonly editable = computed(() => this.esNuevo() || this.editando());

  /** Registros grabados cuya variación (f) pasa el umbral: los mismos que llevan el ícono de tendencia en la tabla. */
  readonly registrosFueraDelUmbral = computed(
    () => (this.detalle()?.clasificadores ?? []).filter((c) => c.variacionPorcentaje > this.umbralVariacion).length,
  );
  /** «Variación fuera del umbral» (Figma node 4535:118789): arriba de la solicitud grabada (Elaborado, Verificado y
   *  Aprobado), fuera de la edición, mientras haya registros fuera del umbral y el usuario no lo cierre. */
  readonly avisoUmbralCerrado = signal(false);
  readonly mostrarAvisoUmbral = computed(
    () => !this.editable() && !!this.detalle() && this.registrosFueraDelUmbral() > 0 && !this.avisoUmbralCerrado(),
  );
  readonly textoAvisoUmbral = computed(() => {
    const n = this.registrosFueraDelUmbral();
    const registros = n === 1 ? '1 registro supera' : `${n} registros superan`;
    return `${registros} el umbral de variación (±${this.umbralVariacion} %). Puede revisar el documento de sustento desde el detalle del registro o desde Más acciones (⋮).`;
  });

  /** Filas visibles: las del formulario (en «Nuevo» y en edición) o las del documento grabado, filtradas por la
   *  búsqueda en ambos casos. */
  readonly clasificadoresVisibles = computed<ClasificadorEstimacionIngresos[]>(() => {
    const filas = this.editable() ? this.formClasificadores() : (this.detalle()?.clasificadores ?? []);
    const texto = this.busquedaClasificadores().trim().toLowerCase();
    return texto ? filas.filter((f) => `${f.ff} ${f.clasificador}`.toLowerCase().includes(texto)) : filas;
  });

  readonly hayCambios = computed(() => {
    if (!this.editando()) return false;
    const actual = crearSnapshotFormulario({ tipoModificacion: this.formTipoModificacion(), clasificadores: this.formClasificadores() });
    return hayCambiosRespectoAlSnapshot(this.fotoEdicion, actual);
  });

  /** «Nuevo» se graba con lo precargado; en edición, solo con cambios. Mientras una fila está abierta, primero se
   *  acepta o cancela esa fila (como en el Figma, con Grabar y Verificar apagados). */
  readonly grabarDeshabilitado = computed(() => {
    if (this.filaEnEdicion() !== null) return true;
    return this.esNuevo() ? this.formClasificadores().length === 0 : !this.hayCambios();
  });

  ngOnInit(): void {
    // Al llegar desde Grabar de «Nuevo»: aviso de solicitud elaborada, como en el resto de solicitudes.
    const estadoNavegacion = history.state as { fromSave?: boolean } | null;
    if (estadoNavegacion?.fromSave) this.mostrarAviso('creation-elaborated');

    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((params) => {
        const id = params.get('id');
        this.cargando.set(true);
        this.detalle.set(null);
        this.precarga.set(null);
        if (id) return this.estimacionApi.obtenerDetalle(id).pipe(map((detalle) => ({ detalle, precarga: null })));
        return this.estimacionApi.obtenerPrecarga().pipe(map((precarga) => ({ detalle: null, precarga })));
      }),
    ).subscribe({
      next: ({ detalle, precarga }) => {
        if (precarga) {
          this.tipoAccion.set(this.route.snapshot.queryParamMap.get('actionType') === 'modificacion' ? 'Modificación' : 'Creación');
          this.formTipoModificacion.set(this.tipoAccion() === 'Modificación' ? TIPOS_MODIFICACION_ESTIMACION_INGRESOS[0] : '');
          this.formClasificadores.set(precarga.clasificadores);
          this.precarga.set(precarga);
        } else if (detalle) {
          this.tipoAccion.set(detalle.tipoAccion);
          this.detalle.set(detalle);
        }
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  regresar(): void {
    void this.router.navigate([PROCESS_ROUTE]);
  }

  /** Cancelar: en «Nuevo» vuelve a la bandeja sin grabar; en edición restaura lo grabado. */
  cancelar(): void {
    if (this.esNuevo()) {
      this.regresar();
      return;
    }
    this.editando.set(false);
    this.cerrarEdicionFila();
  }

  onConfirmarVerificar(): void {
    const id = this.detalle()?.documentoId;
    if (!id) return;
    this.modalVerificar.set(false);
    this.saving.set(true);
    this.estimacionApi.verificar(id).subscribe({
      next: () => { this.mostrarAviso('creation-verified'); this.cargar(id); },
      error: () => this.saving.set(false),
    });
  }

  onConfirmarAprobar(): void {
    const id = this.detalle()?.documentoId;
    if (!id) return;
    this.modalAprobar.set(false);
    this.saving.set(true);
    this.estimacionApi.aprobar(id).subscribe({
      next: () => { this.mostrarAviso('creation-approved'); this.cargar(id); },
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

  /** Lápiz de `siaf-table-controls` (en «Nuevo» y en edición, con exactamente una fila elegida): abre «Editar
   *  estimación de ingresos» en lugar de la tabla, sobre la fila del formulario. */
  editarSeleccionada(): void {
    const [indiceVisible] = this.seleccionados();
    const fila = indiceVisible === undefined ? undefined : this.clasificadoresVisibles()[indiceVisible];
    if (!fila) return;
    const indiceReal = this.formClasificadores().findIndex((c) => c.clasificador === fila.clasificador);
    if (indiceReal !== -1) this.filaEnEdicion.set(indiceReal);
  }

  /** Aceptar de «Editar estimación de ingresos»: la fila cambia en el formulario; se graba con «Grabar». */
  onFilaAceptada(fila: ClasificadorEstimacionIngresos): void {
    const indice = this.filaEnEdicion();
    if (indice === null) return;
    this.formClasificadores.update((filas) => filas.map((f, i) => (i === indice ? fila : f)));
    this.cerrarEdicionFila();
  }

  cerrarEdicionFila(): void {
    this.filaEnEdicion.set(null);
    this.seleccionados.set(new Set());
  }

  onConfirmarGrabar(): void {
    if (this.esNuevo()) {
      this.grabarNuevo();
      return;
    }
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
        this.mostrarAviso('changes-saved');
        this.cargar(id);
      },
      error: () => this.saving.set(false),
    });
  }

  /** Grabar de «Nuevo»: crea el documento en «Elaborado» y abre `solicitud/:id` con el aviso de grabado. */
  private grabarNuevo(): void {
    this.modalGrabar.set(false);
    this.saving.set(true);
    this.estimacionApi.crear({
      tipoAccion: this.tipoAccion(),
      tipoModificacionTexto: this.formTipoModificacion() || undefined,
      clasificadores: this.formClasificadores(),
    }).subscribe({
      next: (creado) => {
        this.saving.set(false);
        void this.router.navigate([solicitudRoute(creado.id)], { replaceUrl: true, state: { fromSave: true } });
      },
      error: () => this.saving.set(false),
    });
  }

  private mostrarAviso(variante: SnackbarVariant): void {
    this.snackbarVariante.set(variante);
    this.snackbarAbierto.set(true);
  }

  private cargar(id: string): void {
    this.estimacionApi.obtenerDetalle(id).subscribe({
      next: (detalle) => { this.detalle.set(detalle); this.saving.set(false); },
      error: () => this.saving.set(false),
    });
  }

  campos(): SolicitudeInfoField[] {
    const d = this.detalle() ?? this.precarga();
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
    // Los tres roles siempre a la vista (Figma node 2448:143629): lo que aún no pasó queda «No asignado aún».
    return [
      { label: 'Elaborado por', actionBy: d.elaboradoPor, date: aFechaHoraPe(d.fechaElaborado) },
      { label: 'Verificado por', actionBy: d.verificadoPor ?? '', date: d.fechaVerificado ? aFechaHoraPe(d.fechaVerificado) : '' },
      { label: 'Aprobado por', actionBy: d.aprobadoPor ?? '', date: d.fechaAprobado ? aFechaHoraPe(d.fechaAprobado) : '' },
    ];
  }

  /** Menú «Más acciones» (⋮) de cada registro en solo lectura; sin base legal, su detalle queda deshabilitado. */
  private readonly accionesConBaseLegal: IconDropdownMenuItem[] = [
    { label: 'Ver detalle recaudación histórica', value: 'recaudacion-historica', icon: 'calculate' },
    { label: 'Ver detalle base legal de uso específico', value: 'base-legal', icon: 'balance' },
  ];
  private readonly accionesSinBaseLegal: IconDropdownMenuItem[] = this.accionesConBaseLegal.map((a) =>
    a.value === 'base-legal' ? { ...a, disabled: true } : a,
  );

  accionesDe(fila: ClasificadorEstimacionIngresos): IconDropdownMenuItem[] {
    return fila.baseLegal === 'SI' ? this.accionesConBaseLegal : this.accionesSinBaseLegal;
  }

  /** Registro cuyo detalle está abierto en su panel lateral (Figma nodes 4674:99530 y 4107:282169). */
  readonly filaRecaudacion = signal<ClasificadorEstimacionIngresos | null>(null);
  readonly filaBaseLegal = signal<ClasificadorEstimacionIngresos | null>(null);

  /** Ruta de «Detalle de estimación de ingresos» del registro (solo en una solicitud grabada y en lectura). */
  rutaDetalleRegistro(fila: ClasificadorEstimacionIngresos): string | null {
    const id = this.detalle()?.documentoId;
    return id ? registroRoute(id, fila.clasificador.split(' ')[0]) : null;
  }

  /** Clic en una fila en solo lectura: abre su detalle. En «Nuevo» y en edición, la fila no navega. */
  abrirDetalleRegistro(fila: ClasificadorEstimacionIngresos): void {
    if (this.editable()) return;
    const ruta = this.rutaDetalleRegistro(fila);
    if (ruta) void this.router.navigateByUrl(ruta);
  }

  onAccionRegistro(fila: ClasificadorEstimacionIngresos, accion: string): void {
    if (accion === 'recaudacion-historica') this.filaRecaudacion.set(fila);
    if (accion === 'base-legal') this.filaBaseLegal.set(fila);
  }

  /** Fila TOTAL de la tabla de clasificadores: suma de la columna indicada. */
  totalColumna(clave: keyof Pick<ClasificadorEstimacionIngresos, 'promedioAnual' | 'anio2027' | 'anio2028' | 'anio2029' | 'variacionMonto'>): number {
    return this.clasificadoresVisibles().reduce((suma, fila) => suma + fila[clave], 0);
  }

  /** (f) del TOTAL: (e / a) x 100, igual que cada fila. */
  // ── Vistas de solo lectura (Figma node 10813:71699): Estimación | Distribución mensual | Total por FF ─────────
  readonly meses = MESES_ESTIMACION_INGRESOS;
  readonly opcionesVista: ButtonGroupItem[] = [
    { label: 'Estimación', value: 'estimacion' },
    { label: 'Distribución mensual', value: 'mensual' },
    { label: 'Total por FF', value: 'ff' },
  ];
  readonly pestanasFF: TabItem[] = [
    { id: 'mensualizado', label: 'Mensualizado' },
    { id: 'multianual', label: 'Proyección multianual' },
  ];
  readonly vistaElegida = signal<VistaTabla>('estimacion');
  readonly pestanaFF = signal<PestanaFF>('mensualizado');
  /** En «Nuevo» y en edición solo existe la tabla editable de estimación. */
  readonly vista = computed<VistaTabla>(() => (this.editable() ? 'estimacion' : this.vistaElegida()));

  /** Distribución mensual de una fila (vacía si la fila no la trae). */
  mesesDe(fila: ClasificadorEstimacionIngresos): number[] {
    return MESES_ESTIMACION_INGRESOS.map((_, i) => fila.distribucionMensual?.[i] ?? 0);
  }

  /** Fila TOTAL de «Distribución mensual»: suma de cada mes de las filas visibles. */
  readonly totalesMensuales = computed(() =>
    MESES_ESTIMACION_INGRESOS.map((_, i) => this.clasificadoresVisibles().reduce((suma, f) => suma + (f.distribucionMensual?.[i] ?? 0), 0)),
  );

  /** «Total por FF»: los clasificadores sumados por fuente de financiamiento (Figma nodes 8308:460985 y 8547:415903). */
  readonly filasPorFF = computed<TotalFuenteFinanciamiento[]>(() => {
    const filas = this.detalle()?.clasificadores ?? [];
    const grupos = new Map<string, TotalFuenteFinanciamiento>();
    for (const f of filas) {
      const grupo = grupos.get(f.ff) ?? {
        ff: f.ff,
        nombre: `${f.ff} ${NOMBRES_FUENTE_FINANCIAMIENTO[f.ff] ?? f.ffDescripcion ?? ''}`.trim(),
        meses: MESES_ESTIMACION_INGRESOS.map(() => 0),
        promedioAnual: 0, anio2027: 0, anio2028: 0, anio2029: 0, variacionMonto: 0, variacionPorcentaje: 0,
      };
      grupo.meses = grupo.meses.map((m, i) => m + (f.distribucionMensual?.[i] ?? 0));
      grupo.promedioAnual += f.promedioAnual;
      grupo.anio2027 += f.anio2027;
      grupo.anio2028 += f.anio2028;
      grupo.anio2029 += f.anio2029;
      grupos.set(f.ff, grupo);
    }
    const texto = this.busquedaClasificadores().trim().toLowerCase();
    return [...grupos.values()]
      .map((g) => ({ ...g, ...calcularVariacionEstimacion(g.promedioAnual, g.anio2027) }))
      .filter((g) => !texto || g.nombre.toLowerCase().includes(texto));
  });

  /** Fila TOTAL de «Total por FF» (mensualizado y multianual). */
  readonly totalFF = computed(() => {
    const filas = this.filasPorFF();
    const suma = (clave: 'promedioAnual' | 'anio2027' | 'anio2028' | 'anio2029') => filas.reduce((t, g) => t + g[clave], 0);
    const promedioAnual = suma('promedioAnual');
    const anio2027 = suma('anio2027');
    return {
      meses: MESES_ESTIMACION_INGRESOS.map((_, i) => filas.reduce((t, g) => t + g.meses[i], 0)),
      anio2027,
      anio2028: suma('anio2028'),
      anio2029: suma('anio2029'),
      ...calcularVariacionEstimacion(promedioAnual, anio2027),
    };
  });

  totalPorcentaje(): string {
    const a = this.totalColumna('promedioAnual');
    const e = this.totalColumna('variacionMonto');
    return a ? ((e / a) * 100).toFixed(1) : '0.0';
  }
}
