import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';

import { PermissionService } from '../../../../../core/auth/permission.service';
import { BreadcrumbItem } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { DetailHistoryComment, DetailHistoryEntry, DetailHistoryTabsComponent } from '../../../../../shared/components/detail-history-tabs/detail-history-tabs.component';
import { FormTableSearchComponent } from '../../../../../shared/components/form-table-search/form-table-search.component';
import { RequestApprovalModalsComponent } from '../../../../../shared/components/request-approval-modals/request-approval-modals.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudeHeaderRole, SolicitudeHeaderState } from '../../../../../shared/components/solicitude-header/solicitude-header.component';
import { SolicitudeInfoCardComponent, SolicitudeInfoField } from '../../../../../shared/components/solicitude-info-card/solicitude-info-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { TableControlsComponent } from '../../../../../shared/components/table-controls/table-controls.component';
import { ActionTrackerComponent, ActionTrackerSummary } from '../../../../../shared/ui/action-tracker/action-tracker.component';
import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { ButtonGroupItem, ButtonsGroupComponent } from '../../../../../shared/ui/buttons-group/buttons-group.component';
import { DocumentSummaryCardComponent } from '../../../../../shared/ui/document-summary-card/document-summary-card.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { IconDropdownMenuComponent, IconDropdownMenuItem } from '../../../../../shared/ui/icon-dropdown-menu/icon-dropdown-menu.component';
import { SnackbarVariant } from '../../../../../shared/ui/snackbar/snackbar.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { EstimacionIngresosApiService } from '../../api/estimacion-ingresos-api.service';
import { CONSOLIDADO_PLIEGO_ID, CONSOLIDADO_PLIEGO_ROUTE, consolidadoPliegoRoute } from '../../config/estimacion-ingresos.rutas';
import { DetalleConsolidadoPliego, NodoConsolidadoPliego, PrecargaConsolidadoPliego } from '../../models/consolidado-pliego.model';
import { ClasificadorEstimacionIngresos, UMBRAL_VARIACION_ESTIMACION_INGRESOS } from '../../models/estimacion-ingresos.model';
import { EstimacionIngresosDetalleBaseLegalComponent } from '../solicitud/detalles/estimacion-ingresos-detalle-base-legal.component';
import { EstimacionIngresosDetalleRecaudacionComponent } from '../solicitud/detalles/estimacion-ingresos-detalle-recaudacion.component';

/** Una fila visible del árbol: el nodo, su nivel y su variación ya calculada. */
interface FilaArbol {
  nodo: NodoConsolidadoPliego;
  nivel: number;
  desplegable: boolean;
  abierta: boolean;
  variacionMonto: number;
  variacionPorcentaje: number;
}

/** Agrupación de la relación de pliegos en el consolidado grabado (Figma node 7606:466323). */
type VistaConsolidado = 'fuente' | 'clasificador' | 'entidad';

/** ISO → «dd/mm/aaaa hh:mm:ss», como la ficha de la solicitud. */
function aFechaHoraPe(iso: string): string {
  const f = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()} ${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;
}

/** Ids de los nodos que se despliegan al abrir: las ramas con detalle. */
function ramasConDetalle(nodos: NodoConsolidadoPliego[]): string[] {
  return nodos.flatMap((n) => (n.hijos?.length ? [n.id, ...ramasConDetalle(n.hijos)] : []));
}

/** Clasificadores (hojas elegibles) del árbol. */
function clasificadores(nodos: NodoConsolidadoPliego[]): NodoConsolidadoPliego[] {
  return nodos.flatMap((n) => (n.seleccionable ? [n] : clasificadores(n.hijos ?? [])));
}

/** El nodo o alguno de sus descendientes contiene el texto. */
function coincide(nodo: NodoConsolidadoPliego, texto: string): boolean {
  return nodo.etiqueta.toLowerCase().includes(texto) || (nodo.hijos ?? []).some((h) => coincide(h, texto));
}

/**
 * «Consolidado pliego de estimación de ingresos». Sin `:id` es el consolidado «Nuevo»: la pantalla de creación de la
 * solicitud con la «Relación de pliegos consolidados» (Figma node 7606:466337), los checkbox deshabilitados y Grabar
 * y Verificar habilitados. Con `:id` es el consolidado grabado (Figma node 7606:466323): aviso de variación, ficha con
 * N° y estado, la relación en solo lectura agrupada por Fuente de financiamiento, Clasificador (node 8349:509061) o
 * Entidad (node 8349:491365), con el menú ⋮ de cada clasificador, y la trazabilidad. En este documento Eliminar y
 * Editar se ven deshabilitados.
 *
 * Aprobador (mismo flujo que la solicitud de estimación de ingresos): en Verificado ve solo Observar y Aprobar
 * (Rechazar no está habilitado en este producto). Observar pide el comentario y deja el consolidado en Observado,
 * con las pestañas Detalle / Historial; Aprobar lo deja en Aprobado y firma «Aprobado por».
 */
@Component({
  selector: 'siaf-consolidado-pliego',
  standalone: true,
  imports: [
    ActionTrackerComponent,
    AlertComponent,
    ButtonsGroupComponent,
    DecimalPipe,
    DetailHistoryTabsComponent,
    DocumentSummaryCardComponent,
    EstimacionIngresosDetalleBaseLegalComponent,
    EstimacionIngresosDetalleRecaudacionComponent,
    FormTableSearchComponent,
    IconComponent,
    IconDropdownMenuComponent,
    RequestApprovalModalsComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
    TableControlsComponent,
  ],
  templateUrl: './consolidado-pliego.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsolidadoPliegoComponent implements OnInit {
  private readonly api = inject(EstimacionIngresosApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly permissions = inject(PermissionService);

  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(
    CONSOLIDADO_PLIEGO_ID,
    CONSOLIDADO_PLIEGO_ROUTE,
    'Consolidado pliego de estimación de ingresos',
  );
  readonly umbralVariacion = UMBRAL_VARIACION_ESTIMACION_INGRESOS;
  readonly cargando = signal(true);
  readonly saving = signal(false);
  readonly modalGrabar = signal(false);
  readonly modalVerificar = signal(false);
  readonly modalEliminar = signal(false);
  readonly modalAprobar = signal(false);
  readonly modalObservar = signal(false);
  readonly motivoObservacion = signal('');
  readonly snackbarAbierto = signal(false);
  readonly snackbarVariante = signal<SnackbarVariant>('creation-elaborated');

  /** Consolidado «Nuevo» (sin `:id`). */
  readonly precarga = signal<PrecargaConsolidadoPliego | null>(null);
  /** Consolidado grabado (`:id`). */
  readonly detalle = signal<DetalleConsolidadoPliego | null>(null);
  readonly esNuevo = computed(() => this.precarga() !== null);

  readonly busqueda = signal('');
  readonly abiertas = signal<Set<string>>(new Set());
  readonly avisoUmbralCerrado = signal(false);

  readonly opcionesVista: ButtonGroupItem[] = [
    { label: 'Fuente Financ.', value: 'fuente' },
    { label: 'Clasif. Ing.', value: 'clasificador' },
    { label: 'Entidad', value: 'entidad' },
  ];
  readonly vista = signal<VistaConsolidado>('fuente');

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id');
          this.cargando.set(true);
          return id ? this.api.obtenerConsolidadoPliego(id) : this.api.obtenerPrecargaConsolidadoPliego();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (datos) => {
          if ('documentoId' in datos) {
            this.detalle.set(datos);
            this.precarga.set(null);
          } else {
            this.precarga.set(datos);
            this.detalle.set(null);
          }
          const arboles = 'documentoId' in datos ? [datos.pliegos, datos.pliegosPorClasificador, datos.pliegosPorEntidad] : [datos.pliegos];
          this.abiertas.set(new Set(arboles.flatMap(ramasConDetalle)));
          this.cargando.set(false);
          this.saving.set(false);
          const estado = history.state as { aviso?: SnackbarVariant } | null;
          if (estado?.aviso) this.mostrarAviso(estado.aviso);
        },
        error: () => this.cargando.set(false),
      });
  }

  readonly headerRole = computed<SolicitudeHeaderRole>(() => (this.permissions.currentRole() === 'approver' ? 'approver' : 'creator'));
  /** Revisor / Evaluador (rol `reviewer`): revisa los registros en solo lectura; la cabecera va sin botones. */
  readonly esEvaluador = computed(() => this.permissions.currentRole() === 'reviewer');

  readonly headerState = computed<SolicitudeHeaderState>(() => {
    if (this.esNuevo()) return 'new';
    const estado = this.detalle()?.estado;
    if (estado === 'Aprobado') return 'approved';
    if (estado === 'Verificado') return 'verified';
    if (estado === 'Observado') return 'observed';
    return 'elaborated';
  });

  readonly campos = computed<SolicitudeInfoField[]>(() => {
    const p = this.precarga();
    if (p) {
      return [
        { label: 'Fecha', value: aFechaHoraPe(p.fecha) },
        { label: 'Ente rector', value: p.enteRector },
        { label: 'Entidad', value: p.entidad },
        { label: 'Unidad ejecutora', value: p.unidadEjecutora },
      ];
    }
    const d = this.detalle();
    if (!d) return [];
    return [
      { label: 'Fecha', value: aFechaHoraPe(d.fecha) },
      { label: 'Ente rector', value: d.enteRector },
      { label: 'Entidad', value: d.entidad },
    ];
  });

  private readonly pliegos = computed(() => this.precarga()?.pliegos ?? this.detalle()?.pliegos ?? []);

  /** Raíz según la agrupación: cada una es su propio árbol del backend (Figma nodes 8349:509061 y 8349:491365). */
  private readonly raiz = computed(() => {
    const d = this.detalle();
    if (!d || this.vista() === 'fuente') return this.pliegos();
    return this.vista() === 'clasificador' ? d.pliegosPorClasificador : d.pliegosPorEntidad;
  });

  /** Filas visibles: las ramas abiertas; con búsqueda, todo lo que coincide (y sus ancestros) desplegado. */
  readonly filas = computed<FilaArbol[]>(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const abiertas = this.abiertas();
    const filas: FilaArbol[] = [];
    const recorrer = (nodos: NodoConsolidadoPliego[], profundidad: number) => {
      for (const nodo of nodos) {
        if (texto && !coincide(nodo, texto)) continue;
        const desplegable = !!nodo.hijos?.length;
        const abierta = desplegable && (!!texto || abiertas.has(nodo.id));
        const variacionMonto = nodo.anio2027 - nodo.promedioAnual;
        filas.push({
          nodo,
          nivel: profundidad,
          desplegable,
          abierta,
          variacionMonto,
          variacionPorcentaje: nodo.promedioAnual ? (variacionMonto / nodo.promedioAnual) * 100 : 0,
        });
        if (abierta) recorrer(nodo.hijos ?? [], profundidad + 1);
      }
    };
    recorrer(this.raiz(), 0);
    return filas;
  });

  /** TOTAL: suma de las fuentes de financiamiento (no cambia con la agrupación). */
  readonly total = computed(() => {
    const raiz = this.pliegos();
    const suma = (campo: 'promedioAnual' | 'anio2027' | 'anio2028' | 'anio2029') => raiz.reduce((s, n) => s + n[campo], 0);
    const a = suma('promedioAnual');
    const b = suma('anio2027');
    return {
      promedioAnual: a,
      anio2027: b,
      anio2028: suma('anio2028'),
      anio2029: suma('anio2029'),
      variacionMonto: b - a,
      variacionPorcentaje: a ? ((b - a) / a) * 100 : 0,
    };
  });

  /** «Variación fuera del umbral» (Figma node 7606:466323): clasificadores con (f) sobre el umbral. */
  readonly registrosFueraDelUmbral = computed(
    () => clasificadores(this.pliegos()).filter((n) => n.promedioAnual && ((n.anio2027 - n.promedioAnual) / n.promedioAnual) * 100 > this.umbralVariacion).length,
  );
  readonly mostrarAvisoUmbral = computed(() => !!this.detalle() && this.registrosFueraDelUmbral() > 0 && !this.avisoUmbralCerrado());
  readonly textoAvisoUmbral = computed(() => {
    const n = this.registrosFueraDelUmbral();
    const registros = n === 1 ? '1 registro supera' : `${n} registros superan`;
    return `${registros} el umbral de variación (±${this.umbralVariacion} %). Puede revisar el documento de sustento desde el detalle del registro o desde Más acciones (⋮).`;
  });

  readonly trazabilidad = computed<ActionTrackerSummary[]>(() => {
    const d = this.detalle();
    if (!d) return [];
    return [
      { label: 'Elaborado por', actionBy: d.elaboradoPor, date: aFechaHoraPe(d.fechaElaborado) },
      { label: 'Verificado por', actionBy: d.verificadoPor ?? '', date: d.fechaVerificado ? aFechaHoraPe(d.fechaVerificado) : '' },
      // Observar no firma ni cambia la acción: «Aprobado por» sigue sin asignar (estándar).
      { label: 'Aprobado por', actionBy: d.aprobadoPor ?? '', date: d.fechaAprobado ? aFechaHoraPe(d.fechaAprobado) : '' },
    ];
  });

  /** Observado: el comentario del aprobador en la pestaña Detalle. */
  readonly comentarioObservacion = computed<DetailHistoryComment | null>(() => {
    const d = this.detalle();
    return d?.estado === 'Observado' && d.motivoObservacion ? { label: 'Comentario de observación', texto: d.motivoObservacion } : null;
  });

  /** Pestaña Historial: una fila por observación (hoy una sola iteración). */
  readonly historialComentarios = computed<DetailHistoryEntry[]>(() => {
    const d = this.detalle();
    if (!d?.observadoPor || !d.fechaObservado) return [];
    const [fecha, hora] = aFechaHoraPe(d.fechaObservado).split(' ');
    return [{
      iteracion: 1,
      proceso: `${d.tipoAccion}-Observado`,
      comentario: 'Comentario',
      descripcion: d.motivoObservacion ?? '',
      fecha,
      hora,
      rol: 'Aprobador\nUE',
      usuario: d.observadoPor,
    }];
  });

  // ── Menú ⋮ de cada clasificador: los mismos detalles que en la solicitud ──
  private readonly accionesConBaseLegal: IconDropdownMenuItem[] = [
    { label: 'Ver detalle recaudación histórica', value: 'recaudacion-historica', icon: 'calculate' },
    { label: 'Ver detalle base legal de uso específico', value: 'base-legal', icon: 'balance' },
  ];
  private readonly accionesSinBaseLegal = this.accionesConBaseLegal.map((a) => (a.value === 'base-legal' ? { ...a, disabled: true } : a));
  readonly filaRecaudacion = signal<ClasificadorEstimacionIngresos | null>(null);
  readonly filaBaseLegal = signal<ClasificadorEstimacionIngresos | null>(null);

  accionesDe(nodo: NodoConsolidadoPliego): IconDropdownMenuItem[] {
    return nodo.baseLegal === 'SI' ? this.accionesConBaseLegal : this.accionesSinBaseLegal;
  }

  /** El clasificador del consolidado con la forma que piden los paneles de detalle de la solicitud. */
  private comoClasificador(nodo: NodoConsolidadoPliego): ClasificadorEstimacionIngresos {
    const variacionMonto = nodo.anio2027 - nodo.promedioAnual;
    return {
      ff: '2.09',
      clasificador: nodo.etiqueta,
      promedioAnual: nodo.promedioAnual,
      anio2027: nodo.anio2027,
      anio2028: nodo.anio2028,
      anio2029: nodo.anio2029,
      baseLegal: nodo.baseLegal ?? 'NO',
      variacionMonto,
      variacionPorcentaje: nodo.promedioAnual ? (variacionMonto / nodo.promedioAnual) * 100 : 0,
      ffDescripcion: 'RECURSOS DIRECTAMENTE RECAUDADOS',
      ffSigla: 'RDR',
    };
  }

  onAccion(nodo: NodoConsolidadoPliego, accion: string): void {
    if (accion === 'recaudacion-historica') this.filaRecaudacion.set(this.comoClasificador(nodo));
    if (accion === 'base-legal') this.filaBaseLegal.set(this.comoClasificador(nodo));
  }

  toggleRama(id: string): void {
    this.abiertas.update((actual) => {
      const nuevo = new Set(actual);
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id);
      return nuevo;
    });
  }

  regresar(): void {
    void this.router.navigateByUrl(CONSOLIDADO_PLIEGO_ROUTE);
  }

  private mostrarAviso(variante: SnackbarVariant): void {
    this.snackbarVariante.set(variante);
    this.snackbarAbierto.set(true);
  }

  /** Los clasificadores del consolidado: en «Nuevo» van todos (los checkbox están deshabilitados). */
  private registros(): string[] {
    return clasificadores(this.pliegos()).map((n) => n.id);
  }

  /** Grabar en «Nuevo»: el consolidado queda «Elaborado» y se abre grabado. */
  onConfirmarGrabar(): void {
    this.modalGrabar.set(false);
    this.saving.set(true);
    this.api.crearConsolidadoPliego({ registros: this.registros() }).subscribe({
      next: (creado) => void this.router.navigate([consolidadoPliegoRoute(creado.id)], { replaceUrl: true, state: { aviso: 'creation-elaborated' } }),
      error: () => this.saving.set(false),
    });
  }

  /** Verificar: en «Nuevo» graba y verifica de una vez; grabado, pasa de Elaborado a Verificado. */
  onConfirmarVerificar(): void {
    this.modalVerificar.set(false);
    this.saving.set(true);
    const id = this.detalle()?.documentoId;
    const verificar$ = id
      ? this.api.verificarConsolidadoPliego(id)
      : this.api.crearConsolidadoPliego({ registros: this.registros() }).pipe(switchMap((creado) => this.api.verificarConsolidadoPliego(creado.id)));
    verificar$.subscribe({
      next: (doc) => {
        if (!id) {
          void this.router.navigate([consolidadoPliegoRoute(doc.id)], { replaceUrl: true, state: { aviso: 'creation-verified' } });
          return;
        }
        this.refrescar(id, 'creation-verified');
      },
      error: () => this.saving.set(false),
    });
  }

  /** Aprobador: Aprobar (Verificado → Aprobado). */
  onConfirmarAprobar(): void {
    const id = this.detalle()?.documentoId;
    if (!id) return;
    this.modalAprobar.set(false);
    this.saving.set(true);
    this.api.aprobarConsolidadoPliego(id).subscribe({
      next: () => this.refrescar(id, 'creation-approved'),
      error: () => this.saving.set(false),
    });
  }

  abrirObservar(): void {
    this.motivoObservacion.set('');
    this.modalObservar.set(true);
  }

  /** Aprobador: Observar (Verificado → Observado) con el comentario. */
  onConfirmarObservar(): void {
    const id = this.detalle()?.documentoId;
    const motivo = this.motivoObservacion().trim();
    if (!id || !motivo) return;
    this.modalObservar.set(false);
    this.saving.set(true);
    this.api.observarConsolidadoPliego(id, motivo).subscribe({
      next: () => this.refrescar(id, 'creation-observed'),
      error: () => this.saving.set(false),
    });
  }

  cerrarModalesAprobador(): void {
    this.modalAprobar.set(false);
    this.modalObservar.set(false);
  }

  /**
   * Prototipo: doble clic en «Comentario de la observación» lo completa con el texto del Figma. Escribe en el
   * `<textarea>` como si lo tecleara el usuario (el campo enfocado no toma valores del padre).
   */
  completarObservacionDemo(evento: MouseEvent): void {
    if (!this.modalObservar()) return;
    const campo = evento.target as HTMLElement | null;
    if (!(campo instanceof HTMLTextAreaElement)) return;
    campo.value = 'La información registrada se encuentra incompleta.';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /** Misma ruta: el router no vuelve a cargar, así que se refresca el detalle aquí. */
  private refrescar(id: string, aviso: SnackbarVariant): void {
    this.api.obtenerConsolidadoPliego(id).subscribe((detalle) => {
      this.detalle.set(detalle);
      this.saving.set(false);
      this.mostrarAviso(aviso);
    });
  }

  onConfirmarEliminar(): void {
    const id = this.detalle()?.documentoId;
    if (!id) return;
    this.modalEliminar.set(false);
    this.saving.set(true);
    this.api.eliminarConsolidadoPliego(id).subscribe({
      next: () => this.regresar(),
      error: () => this.saving.set(false),
    });
  }
}
