import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY } from 'rxjs';
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
import { ActionTrackerComponent, ActionTrackerSummary } from '../../../../../shared/ui/action-tracker/action-tracker.component';
import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { ButtonGroupItem, ButtonsGroupComponent } from '../../../../../shared/ui/buttons-group/buttons-group.component';
import { DocumentSummaryCardComponent } from '../../../../../shared/ui/document-summary-card/document-summary-card.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { IconDropdownMenuComponent, IconDropdownMenuItem } from '../../../../../shared/ui/icon-dropdown-menu/icon-dropdown-menu.component';
import { SnackbarVariant } from '../../../../../shared/ui/snackbar/snackbar.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { EstimacionIngresosApiService } from '../../api/estimacion-ingresos-api.service';
import { AMBITOS_CONSOLIDADO, AmbitoConsolidado } from '../../config/estimacion-ingresos.rutas';
import { DetalleConsolidadoPliego, NodoConsolidadoPliego } from '../../models/consolidado-pliego.model';
import { ClasificadorEstimacionIngresos, UMBRAL_VARIACION_ESTIMACION_INGRESOS, estadoExpedienteEstimacion } from '../../models/estimacion-ingresos.model';
import { EstimacionIngresosDetalleBaseLegalComponent } from '../solicitud/detalles/estimacion-ingresos-detalle-base-legal.component';
import {
  accionesRegistroEstimacion,
  accionesRevisorRegistro,
  descargarSustentoRegistro,
  historialRegistro,
  textoEstadoEvaluacion,
} from '../solicitud/detalles/acciones-registro';
import { AccionEvaluarRegistro, EstimacionIngresosEvaluarRegistroComponent } from '../solicitud/detalles/estimacion-ingresos-evaluar-registro.component';
import { DocumentHistoryPanelComponent, DocumentHistorySummary } from '../../../../../shared/components/document-history-panel/document-history-panel.component';
import { RecordStatusTagComponent } from '../../../../../shared/ui/record-status-tag/record-status-tag.component';
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
 * «Consolidado pliego de estimación de ingresos». «Crear documento» (ruta sin `:id`) crea el consolidado directo en
 * Elaborado y abre `:id`, el consolidado grabado (Figma node 7606:466323): aviso de variación, ficha con N° y estado, la relación en solo lectura agrupada por Fuente de financiamiento, Clasificador (node 8349:509061) o
 * Entidad (node 8349:491365), con el menú ⋮ de cada clasificador, y la trazabilidad. En este documento Eliminar y
 * Editar se ven deshabilitados.
 *
 * Aprobador (mismo flujo que la solicitud de estimación de ingresos): en Verificado ve solo Observar y Aprobar
 * (Rechazar no está habilitado en este producto). Observar pide el comentario y deja el consolidado en Observado,
 * con las pestañas Detalle / Historial; Aprobar lo deja en Aprobado y firma «Aprobado por».
 *
 * Con `data: { ambito: 'dgtp' }` es el «Consolidado DGTP de estimación de ingresos» (Figma page «F.1 Rol Creador»,
 * node 4760:174853): igual, pero la ficha lleva solo Fecha y Ente rector, el «Universo consolidado» empieza contraído y solo Verificar está habilitado.
 */
@Component({
  selector: 'siaf-consolidado-pliego',
  standalone: true,
  imports: [
    ActionTrackerComponent,
    AlertComponent,
    ButtonComponent,
    ButtonsGroupComponent,
    DecimalPipe,
    DetailHistoryTabsComponent,
    DocumentHistoryPanelComponent,
    DocumentSummaryCardComponent,
    EstimacionIngresosEvaluarRegistroComponent,
    RecordStatusTagComponent,
    EstimacionIngresosDetalleBaseLegalComponent,
    EstimacionIngresosDetalleRecaudacionComponent,
    FormTableSearchComponent,
    IconComponent,
    IconDropdownMenuComponent,
    RequestApprovalModalsComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
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

  /** Consolidado del pliego o de la DGTP (`data.ambito` de la ruta): textos, rutas y datos. */
  private readonly ambito: AmbitoConsolidado = this.route.snapshot.data['ambito'] ?? 'pliego';
  private readonly datosAmbito = AMBITOS_CONSOLIDADO[this.ambito];
  readonly titulo = this.datosAmbito.documento;
  readonly tituloSeccion = this.datosAmbito.seccion;
  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(this.datosAmbito.procesoId, this.datosAmbito.bandeja, this.titulo);
  readonly umbralVariacion = UMBRAL_VARIACION_ESTIMACION_INGRESOS;
  /**
   * Proyección DGTP de ingresos (Figma node 4760:328500): la tabla solo lleva el «Universo consolidado» fijo y la
   * «Recaudación estimada» de 2027 a 2036, sin histórico, participación, base legal, variación ni menú ⋮.
   * Es el único ámbito con Observar habilitado para el aprobador (Verificado → Observado, con comentario).
   */
  readonly esProyeccion = this.ambito === 'proyeccion';
  readonly aniosProyeccion = Array.from({ length: 10 }, (_, i) => 2027 + i);
  readonly cargando = signal(true);
  readonly saving = signal(false);
  readonly modalVerificar = signal(false);
  readonly modalEliminar = signal(false);
  readonly modalAprobar = signal(false);
  readonly modalObservar = signal(false);
  readonly motivoObservacion = signal('');
  readonly snackbarAbierto = signal(false);
  readonly snackbarVariante = signal<SnackbarVariant>('creation-elaborated');

  /** Consolidado grabado (`:id`). */
  readonly detalle = signal<DetalleConsolidadoPliego | null>(null);

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
          if (!id) {
            this.crearDirecto();
            return EMPTY;
          }
          return this.api.obtenerConsolidadoPliego(id, this.ambito);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (datos) => {
          this.detalle.set(datos);
          const arboles = [datos.pliegos, datos.pliegosPorClasificador, datos.pliegosPorEntidad];
          this.abiertas.set(new Set(this.datosAmbito.abrirRamas ? arboles.flatMap(ramasConDetalle) : []));
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
  /**
   * Revisor / Evaluador del consolidado pliego: el mismo diseño y flujo que en la solicitud de estimación de ingresos
   * (Figma node 14733:117688): «Estado de la estimación», N° de expediente y su estado en la ficha, sin trazabilidad,
   * la columna Estado (Pendiente, Observado, Validado) solo en las filas de registro, y Validar / Observar / historial
   * en su menú ⋮. El expediente pasa de Creado a En trámite al evaluar un registro y a Archivado con todos validados.
   */
  readonly modoRevisor = computed(() => this.esEvaluador() && this.ambito === 'pliego');
  readonly ambitoConsolidado = this.ambito;

  readonly mostrarAvisoEvaluacion = computed(() => this.modoRevisor() && !!this.detalle() && !this.avisoUmbralCerrado());
  readonly textoAvisoEvaluacion = computed(() =>
    textoEstadoEvaluacion(this.detalle()?.registros ?? [], this.registrosFueraDelUmbral(), this.umbralVariacion),
  );
  readonly estadoExpediente = computed(() => estadoExpedienteEstimacion(this.detalle()?.registros));
  /** N° de expediente en la ficha (Figma: «0000001-2026»): N° del documento y año. */
  readonly numeroExpediente = computed(() => {
    const d = this.detalle();
    return d ? `${d.numero.padStart(7, '0')}-${new Date(d.fecha).getFullYear()}` : null;
  });

  readonly headerState = computed<SolicitudeHeaderState>(() => {
    const estado = this.detalle()?.estado;
    if (estado === 'Aprobado') return 'approved';
    if (estado === 'Verificado') return 'verified';
    if (estado === 'Observado') return 'observed';
    return 'elaborated';
  });

  readonly campos = computed<SolicitudeInfoField[]>(() => {
    const d = this.detalle();
    if (!d) return [];
    // El consolidado DGTP no es de una entidad: su ficha lleva solo Fecha y Ente rector (Figma node 4760:174853).
    return [
      { label: 'Fecha', value: aFechaHoraPe(d.fecha) },
      { label: 'Ente rector', value: d.enteRector },
      ...(d.entidad ? [{ label: 'Entidad', value: d.entidad }] : []),
    ];
  });

  private readonly pliegos = computed(() => this.detalle()?.pliegos ?? []);

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

  /** TOTAL de la proyección: suma de las fuentes de financiamiento, año por año. */
  readonly totalProyeccion = computed(() =>
    this.aniosProyeccion.map((anio) => this.pliegos().reduce((s, n) => s + this.montoProyectado(n, anio), 0)),
  );

  /**
   * Recaudación estimada de un año de la proyección. 2027–2029 son los del consolidado; de 2030 en adelante se
   * proyecta con el crecimiento de 2029 sobre 2028 (en el Figma es un crecimiento constante año a año).
   */
  montoProyectado(nodo: Pick<NodoConsolidadoPliego, 'anio2027' | 'anio2028' | 'anio2029'>, anio: number): number {
    if (anio <= 2027) return nodo.anio2027;
    if (anio === 2028) return nodo.anio2028;
    if (anio === 2029) return nodo.anio2029;
    const crecimiento = nodo.anio2028 ? nodo.anio2029 / nodo.anio2028 : 1;
    return Math.round(nodo.anio2029 * crecimiento ** (anio - 2029));
  }

  /** «Variación fuera del umbral» (Figma node 7606:466323): clasificadores con (f) sobre el umbral. */
  readonly registrosFueraDelUmbral = computed(
    () => clasificadores(this.pliegos()).filter((n) => n.promedioAnual && ((n.anio2027 - n.promedioAnual) / n.promedioAnual) * 100 > this.umbralVariacion).length,
  );
  readonly mostrarAvisoUmbral = computed(
    // La proyección no muestra variación, así que tampoco su aviso.
    () =>
      !this.esProyeccion && !this.modoRevisor() && !!this.detalle() && this.registrosFueraDelUmbral() > 0 && !this.avisoUmbralCerrado(),
  );
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

  /**
   * Observado: el comentario del aprobador en la pestaña Detalle. Solo en la proyección DGTP, una vez observada, las
   * pestañas Detalle e Historial se quedan en todos los estados siguientes (Elaborado, Verificado y Aprobado).
   */
  readonly comentarioObservacion = computed<DetailHistoryComment | null>(() => {
    const d = this.detalle();
    const conObservacion = d?.estado === 'Observado' || this.esProyeccion;
    return conObservacion && d?.motivoObservacion ? { label: 'Comentario de observación', texto: d.motivoObservacion } : null;
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
      // El consolidado DGTP y la proyección DGTP los observa el aprobador de la DGTP; el del pliego, el de la UE.
      rol: this.ambito === 'pliego' ? 'Aprobador\nUE' : 'Aprobador\nDGTP',
      usuario: d.observadoPor,
    }];
  });

  // ── Menú ⋮ y clic en cada clasificador: lo mismo que en la solicitud ──
  readonly filaRecaudacion = signal<ClasificadorEstimacionIngresos | null>(null);
  readonly filaBaseLegal = signal<ClasificadorEstimacionIngresos | null>(null);

  /** El registro de la solicitud con el mismo código de clasificador (ej. «3.1.5.1»), si llegó al consolidado. */
  private registroDe(nodo: NodoConsolidadoPliego): ClasificadorEstimacionIngresos | undefined {
    const codigo = nodo.etiqueta.split(' ')[0];
    return this.detalle()?.registros?.find((r) => r.clasificador.split(' ')[0] === codigo);
  }

  /** El registro completo de la solicitud; si no está, uno armado con los montos de la fila. */
  private comoClasificador(nodo: NodoConsolidadoPliego): ClasificadorEstimacionIngresos {
    const registro = this.registroDe(nodo);
    if (registro) return registro;
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

  /** Menú ⋮ de la solicitud (`acciones-registro.ts`), con el registro completo; el revisor, el suyo. */
  accionesDe(nodo: NodoConsolidadoPliego): IconDropdownMenuItem[] {
    const fila = this.comoClasificador(nodo);
    return this.modoRevisor() && this.registroDe(nodo) ? accionesRevisorRegistro(fila) : accionesRegistroEstimacion(fila);
  }

  /** Estado de la evaluación de la fila; solo las filas de registro lo tienen. */
  estadoEvaluacionDe(nodo: NodoConsolidadoPliego): string | null {
    if (!nodo.clasificador) return null;
    const registro = this.registroDe(nodo);
    return registro ? (registro.estadoEvaluacion ?? 'Pendiente') : null;
  }

  onAccion(nodo: NodoConsolidadoPliego, accion: string): void {
    const fila = this.comoClasificador(nodo);
    if (accion === 'recaudacion-historica') this.filaRecaudacion.set(fila);
    if (accion === 'base-legal') this.filaBaseLegal.set(fila);
    if (accion === 'descargar-sustento') descargarSustentoRegistro(fila);
    if (accion === 'validar' || accion === 'observar') {
      this.filaEvaluar.set(fila);
      this.accionEvaluar.set(accion);
    }
    if (accion === 'historial') this.abrirHistorialRegistro(fila);
  }

  /** Validar (modal) u Observar (panel), en `siaf-estimacion-ingresos-evaluar-registro`. */
  readonly filaEvaluar = signal<ClasificadorEstimacionIngresos | null>(null);
  readonly accionEvaluar = signal<AccionEvaluarRegistro | null>(null);

  /** Tras evaluar: cambian la columna Estado, el aviso y el estado del expediente. */
  onRegistroEvaluado(fila: ClasificadorEstimacionIngresos): void {
    this.detalle.update((d) =>
      d ? { ...d, registros: d.registros.map((r) => (r.clasificador === fila.clasificador ? fila : r)) } : d,
    );
  }

  readonly historialRegistroAbierto = signal(false);
  readonly resumenHistorialRegistro = signal<DocumentHistorySummary>({ solicitudId: '', document: '', number: '', actionType: '' });

  private abrirHistorialRegistro(fila: ClasificadorEstimacionIngresos): void {
    const d = this.detalle();
    if (!d) return;
    this.resumenHistorialRegistro.set(historialRegistro(d, fila));
    this.historialRegistroAbierto.set(true);
  }

  /** La fila de un clasificador con registro abre su «Detalle de estimación de ingresos», como en la solicitud. */
  tieneDetalle(nodo: NodoConsolidadoPliego): boolean {
    return !!nodo.clasificador && !!this.registroDe(nodo);
  }

  abrirRegistro(nodo: NodoConsolidadoPliego): void {
    const id = this.detalle()?.documentoId;
    if (!id || !this.tieneDetalle(nodo)) return;
    void this.router.navigateByUrl(this.datosAmbito.registro(id, nodo.etiqueta.split(' ')[0]));
  }

  toggleRama(id: string): void {
    this.abiertas.update((actual) => {
      const nuevo = new Set(actual);
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id);
      return nuevo;
    });
  }

  regresar(): void {
    void this.router.navigateByUrl(this.datosAmbito.bandeja);
  }

  private mostrarAviso(variante: SnackbarVariant): void {
    this.snackbarVariante.set(variante);
    this.snackbarAbierto.set(true);
  }

  /** «Crear documento»: crea el consolidado en Elaborado y lo abre (reemplaza la ruta de creación). */
  private crearDirecto(): void {
    this.api.crearConsolidadoPliego(this.ambito).subscribe({
      next: (creado) =>
        void this.router.navigate([this.datosAmbito.detalle(creado.id)], { replaceUrl: true, state: { aviso: 'creation-elaborated' } }),
      error: () => this.cargando.set(false),
    });
  }

  /** Verificar: Elaborado → Verificado. */
  onConfirmarVerificar(): void {
    const id = this.detalle()?.documentoId;
    if (!id) return;
    this.modalVerificar.set(false);
    this.saving.set(true);
    this.api.verificarConsolidadoPliego(id, this.ambito).subscribe({
      next: () => this.refrescar(id, 'creation-verified'),
      error: () => this.saving.set(false),
    });
  }

  /** Aprobador: Aprobar (Verificado → Aprobado). */
  onConfirmarAprobar(): void {
    const id = this.detalle()?.documentoId;
    if (!id) return;
    this.modalAprobar.set(false);
    this.saving.set(true);
    this.api.aprobarConsolidadoPliego(id, this.ambito).subscribe({
      next: () => this.refrescar(id, 'creation-approved'),
      error: () => this.saving.set(false),
    });
  }

  /**
   * Proyección DGTP observada, vista del creador: en vez de Editar y Eliminar, el encabezado lleva solo «Recalcular».
   * Recalcular la devuelve a Elaborado (Eliminar y Editar deshabilitados, Verificar), como el flujo de creación.
   */
  readonly accionesRecalculo = computed(
    () => this.esProyeccion && this.headerRole() === 'creator' && this.detalle()?.estado === 'Observado',
  );

  /** Creador: recalcula la proyección observada y la deja en Elaborado (sin verificador en la trazabilidad). */
  recalcular(): void {
    const id = this.detalle()?.documentoId;
    if (!id) return;
    this.saving.set(true);
    this.api.recalcularConsolidadoPliego(id, this.ambito).subscribe({
      next: () =>
        this.api.obtenerConsolidadoPliego(id, this.ambito).subscribe((detalle) => {
          this.detalle.set(detalle);
          this.saving.set(false);
        }),
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
    this.api.observarConsolidadoPliego(id, motivo, this.ambito).subscribe({
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
    this.api.obtenerConsolidadoPliego(id, this.ambito).subscribe((detalle) => {
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
    this.api.eliminarConsolidadoPliego(id, this.ambito).subscribe({
      next: () => this.regresar(),
      error: () => this.saving.set(false),
    });
  }
}
