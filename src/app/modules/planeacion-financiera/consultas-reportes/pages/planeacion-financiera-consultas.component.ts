import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { QueryReportExportEvent, QueryReportPageComponent } from '../../../../shared/components/query-report-page/query-report-page.component';
import type {
  QueryReportColumn,
  QueryReportConfig,
  QueryReportFavorite,
  QueryReportParameters,
  QueryReportResult,
  QueryReportRow,
} from '../../../../shared/types/query-report.types';
import { buildProcessBreadcrumbs } from '../../../../shared/utils/breadcrumbs.util';
import { EstimacionIngresosApiService } from '../../estimacion-ingresos/api/estimacion-ingresos-api.service';
import { AMBITOS_CONSOLIDADO, AmbitoConsolidado, solicitudRoute } from '../../estimacion-ingresos/config/estimacion-ingresos.rutas';
import type { ClasificadorEstimacionIngresos } from '../../estimacion-ingresos/models/estimacion-ingresos.model';
import { CONSULTAS_PF_ID, CONSULTAS_PF_ROUTE } from '../config/consultas-reportes.rutas';
import { exportarConsultaPlaneacion } from '../utils/consultas-reportes-export.util';

const TITULO = 'Consultas y reportes de la planeación financiera';

/** «Nivel de consulta» (Figma node 10607:46392): la recaudación histórica o un tipo de documento. */
type TipoDocumento = 'solicitud' | AmbitoConsolidado;
type NivelConsulta = 'historica' | TipoDocumento;

const opciones = (valores: string[]) => valores.map((v) => ({ value: v, label: v }));

const ANIOS_FISCALES = opciones(['2026', '2025', '2024', '2023', '2022']);
/** «Tipo de información» (Figma node 10607:46292). Egresos aún no tiene documentos: su consulta sale vacía. */
const TIPOS_INFORMACION = [
  { value: 'ingresos', label: 'Estimación de ingresos' },
  { value: 'egresos', label: 'Estimación de egresos' },
];
const NIVELES: { value: NivelConsulta; label: string }[] = [
  { value: 'historica', label: 'Recaudación histórica' },
  { value: 'solicitud', label: 'Solicitud de estimación de ingresos' },
  { value: 'pliego', label: 'Consolidado Pliego de estimación de ingresos' },
  { value: 'dgtp', label: AMBITOS_CONSOLIDADO.dgtp.documento },
  { value: 'proyeccion', label: AMBITOS_CONSOLIDADO.proyeccion.documento },
];
const nombreNivel = (nivel: string): string => NIVELES.find((n) => n.value === nivel)?.label ?? nivel;
/** Opciones de Entidad, Unidad ejecutora, Fuente de financiamiento y Clasificador (Figma nodes 8913:170918, 8913:170909,
 *  8913:170941 y 8913:170915; el clasificador suma los del ejemplo lleno, node 9396:44276). */
const ENTIDADES = opciones(['1 PRESIDENCIA DEL CONSEJO DE MINISTROS', '36 MINISTERIO DE TRANSPORTES Y COMUNICACIONES', '11 M. DE SALUD']);
const UNIDADES_EJECUTORAS = opciones(['Secretaría General - PCM', 'PCM SEC TEC', 'PROY TRANS', 'ANATP CHANCAY', 'PROG MEJ AT CID']);
const FUENTES = opciones([
  '1.00 RECURSOS ORDINARIOS',
  '2.09 RECURSOS DIRECTAMENTE RECAUDADOS',
  '3.14 RECURSOS POR OPERACIONES OFICIALES DE CREDITO',
  '4 DONACIONES Y TRANSFERENCIAS',
  '5 RECURSOS DETERMINADOS',
]);
const CLASIFICADORES = opciones(['VENTA DE PUBLICACIONES', 'TASAS REGISTRALES', 'LICENCIA DE CONSTRUCCIÓN', 'OTRAS MULTAS', 'DE TRANSPORTE', 'JUDICIALES']);

const ESTADOS = opciones(['Elaborado', 'Verificado', 'Observado', 'Aprobado']);
const TIPOS_ACCION = opciones(['Creación', 'Modificación']);

/** Comparación sin tildes ni mayúsculas. */
const normalizar = (texto: string): string => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
/** Código numérico inicial («001 PRESIDENCIA…» → 1, «2.09 …» → 2). */
const codigo = (texto: string): string => String(Number(texto.trim().split(/[\s.-]/)[0]));

const formatoMonto = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const monto = (valor: number | undefined): string => formatoMonto.format(valor ?? 0);
const porcentaje = (valor: number | undefined): string => (valor ?? 0).toFixed(1);

/** ISO → dd/mm/aaaa (el formato que agrupa por mes la vista de gráficas). */
const aFechaPe = (iso: string): string => {
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

/** Documento con sus registros, ya traído del servidor, antes de pasarlo a filas. */
interface DocumentoConsultado {
  tipo: TipoDocumento;
  id: string;
  documento: string;
  numero: string;
  estado: string;
  tipoAccion: string;
  fecha: string;
  entidad: string;
  unidadEjecutora: string;
  registros: ClasificadorEstimacionIngresos[];
}

const COLUMNAS: QueryReportColumn[] = [
  { key: 'documento', label: 'Documento', group: 'Documento', width: 280, kind: 'link' },
  { key: 'numero', label: 'Número', group: 'Documento', width: 100 },
  { key: 'tipoAccion', label: 'Tipo de acción', group: 'Documento', width: 130 },
  { key: 'fecha', label: 'Fecha', group: 'Documento', width: 120 },
  { key: 'entidad', label: 'Entidad', width: 260, hiddenByDefault: true },
  { key: 'unidadEjecutora', label: 'Unidad ejecutora', width: 260, hiddenByDefault: true },
  { key: 'ff', label: 'FF', group: 'Clasificador', width: 90 },
  { key: 'clasificador', label: 'Clasificador de ingresos', group: 'Clasificador', width: 300 },
  { key: 'promedioAnual', label: 'Promedio anual (a)', group: 'Rec. histórica', width: 150, align: 'right' },
  { key: 'anio2027', label: 'Año 2027 (b)', group: 'Recaudación estimada', width: 130, align: 'right' },
  { key: 'anio2028', label: 'Año 2028 (c)', group: 'Recaudación estimada', width: 130, align: 'right' },
  { key: 'anio2029', label: 'Año 2029 (d)', group: 'Recaudación estimada', width: 130, align: 'right' },
  { key: 'baseLegal', label: '¿Base legal?', width: 120, hiddenByDefault: true },
  { key: 'variacionMonto', label: 'Monto (e)', group: 'Variación (b) vs (a)', width: 120, align: 'right' },
  { key: 'variacionPorcentaje', label: '(%) (f)', group: 'Variación (b) vs (a)', width: 90, align: 'right' },
  { key: 'estado', label: 'Estado', width: 120, fixed: true },
];

/** Columnas de «Recaudación histórica»: sin datos de documento ni de la estimación. */
const COLUMNAS_HISTORICA: QueryReportColumn[] = [
  { key: 'entidad', label: 'Entidad', width: 280 },
  { key: 'unidadEjecutora', label: 'Unidad ejecutora', width: 260 },
  { key: 'ff', label: 'FF', group: 'Clasificador', width: 220 },
  { key: 'clasificador', label: 'Clasificador de ingresos', group: 'Clasificador', width: 300 },
  { key: 'promedioAnual', label: 'Promedio anual', width: 160, align: 'right', fixed: true },
];

const PANEL_DOCUMENTO: QueryReportConfig['columnsPanel'] = {
  baseGroups: ['Documento', 'Clasificador'],
  groupLabels: { 'Rec. histórica': 'Recaudación histórica' },
};
const PANEL_HISTORICA: QueryReportConfig['columnsPanel'] = { baseGroups: ['Clasificador'] };

const PRESETS_DOCUMENTO = [
  { key: 'estado', label: 'Estado', options: ESTADOS },
  { key: 'tipoAccion', label: 'Tipo de acción', options: TIPOS_ACCION },
];

const GRAFICAS_DOCUMENTO: QueryReportConfig['charts'] = {
  kpis: [
    { title: 'Registros', icon: 'list_alt', tone: 'informative', aggregate: 'count' },
    { title: 'Recaudación estimada 2027', icon: 'trending_up', tone: 'success', column: 'anio2027', prefix: 'S/ ' },
    { title: 'Recaudación histórica', icon: 'history', tone: 'warning', column: 'promedioAnual', prefix: 'S/ ' },
    { title: 'Variación (b) vs (a)', icon: 'query_stats', tone: 'danger', column: 'variacionMonto', prefix: 'S/ ' },
  ],
  charts: [
    {
      title: 'Recaudación estimada 2027 por fuente',
      description: 'Suma del año 2027 (b) de los registros de cada fuente de financiamiento',
      type: 'bar',
      groupBy: 'ff',
      column: 'anio2027',
      seriesName: 'Año 2027',
      categoryLabel: 'FF',
      width: 'wide',
    },
    { title: 'Registros por estado', description: 'Cantidad de registros según el estado de su documento', type: 'donut', groupBy: 'estado', aggregate: 'count', seriesName: 'Registros', width: 'narrow' },
  ],
};

const GRAFICAS_HISTORICA: QueryReportConfig['charts'] = {
  kpis: [
    { title: 'Clasificadores', icon: 'list_alt', tone: 'informative', aggregate: 'count' },
    { title: 'Recaudación histórica', icon: 'history', tone: 'warning', column: 'promedioAnual', prefix: 'S/ ' },
  ],
  charts: [
    {
      title: 'Recaudación histórica por fuente',
      description: 'Suma del promedio anual de los clasificadores de cada fuente de financiamiento',
      type: 'bar',
      groupBy: 'ff',
      column: 'promedioAnual',
      seriesName: 'Promedio anual',
      categoryLabel: 'FF',
      width: 'wide',
    },
  ],
};

/** Favoritos de la consulta, solo en este navegador (el backend simulado no los guarda). */
const CLAVE_FAVORITOS = 'siaf.consultas-planeacion-financiera.favoritos';
function leerFavoritos(): QueryReportFavorite[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_FAVORITOS) ?? '[]') as QueryReportFavorite[];
  } catch {
    return [];
  }
}

/**
 * «Consultas y reportes de la planeación financiera»: la misma pantalla de consultas de Taller-libretas
 * (`siaf-query-report-page`: parámetros, resultado con pestañas, filtros avanzados con agrupado, favoritos, columnas,
 * vista de gráficas y Exportar), con los datos de Estimación de ingresos. Una fila por registro (clasificador) de cada
 * documento consultado y una pestaña por tipo de documento: solicitudes, consolidados del pliego y de la DGTP, y
 * proyecciones DGTP.
 */
@Component({
  selector: 'siaf-planeacion-financiera-consultas',
  standalone: true,
  imports: [QueryReportPageComponent],
  template: `
    <siaf-query-report-page
      [config]="config()"
      [result]="resultado()"
      [loading]="cargando()"
      [favorites]="favoritos()"
      (queried)="consultar($event)"
      (favoritesChange)="guardarFavoritos($event)"
      (exported)="exportar($event)"
      (linkClicked)="abrirDocumento($event.row)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaneacionFinancieraConsultasComponent {
  private readonly api = inject(EstimacionIngresosApiService);
  private readonly router = inject(Router);

  readonly resultado = signal<QueryReportResult | null>(null);
  readonly cargando = signal(false);
  readonly favoritos = signal<QueryReportFavorite[]>(leerFavoritos());

  readonly config = signal<QueryReportConfig>({
    title: TITULO,
    breadcrumbs: buildProcessBreadcrumbs(CONSULTAS_PF_ID, CONSULTAS_PF_ROUTE),
    // Parámetros de consulta (Figma node 9396:44276).
    parameterFields: [
      { key: 'anio', label: 'Año fiscal', type: 'select', required: true, icon: 'calendar_today', options: ANIOS_FISCALES },
      { key: 'tipoInformacion', label: 'Tipo de información', type: 'select', required: true, icon: 'category', options: TIPOS_INFORMACION },
      { key: 'nivel', label: 'Nivel de consulta', type: 'select', required: true, icon: 'description', options: NIVELES },
      { key: 'entidad', label: 'Entidad', type: 'select-multiple', icon: 'account_balance', options: ENTIDADES },
      { key: 'unidadEjecutora', label: 'Unidad ejecutora', type: 'select-multiple', icon: 'apartment', options: UNIDADES_EJECUTORAS },
      { key: 'ff', label: 'Fuente de financiamiento', type: 'select-multiple', icon: 'payments', options: FUENTES },
      { key: 'clasificador', label: 'Clasificador de ingreso', type: 'select-multiple', icon: 'list_alt', options: CLASIFICADORES },
    ],
    advancedFilterFields: [
      { key: 'estado', label: 'Estado', groupable: true, groupableIn: ['agrupado'], groupLabelPrefix: 'Estado', hidesColumns: ['estado'] },
      { key: 'tipoAccion', label: 'Tipo de acción', groupable: true, groupableIn: ['agrupado'], groupLabelPrefix: 'Acción', hidesColumns: ['tipoAccion'] },
      { key: 'numero', label: 'Documento', pluralLabel: 'Documentos', groupable: true, groupableIn: ['agrupado'], groupLabelPrefix: 'N°', hidesColumns: ['numero'] },
      { key: 'entidad', label: 'Entidad', groupable: true, groupableIn: ['agrupado'], hierarchy: 1, groupLabelPrefix: 'Ent.', hidesColumns: ['entidad'] },
      { key: 'unidadEjecutora', label: 'Unidad ejecutora', groupable: true, groupableIn: ['agrupado'], hierarchy: 2, groupLabelPrefix: 'UE.', hidesColumns: ['unidadEjecutora'] },
      { key: 'ff', label: 'Fuente de financiamiento', pluralLabel: 'Fuentes de financiamiento', groupable: true, groupableIn: ['agrupado'], groupLabelPrefix: 'FF', hidesColumns: ['ff'] },
      { key: 'clasificador', label: 'Clasificador de ingresos', pluralLabel: 'Clasificadores de ingresos', groupable: true, groupableIn: ['agrupado'], groupLabelPrefix: 'Clasif.', hidesColumns: ['clasificador'] },
      { key: 'fecha', label: 'Fecha', type: 'date', noFuture: true },
    ],
    columns: COLUMNAS,
    searchMinChars: 3,
    columnsPanel: PANEL_DOCUMENTO,
    rowKey: 'id',
    resultTitle: 'Resultado de reporte',
    tableLabel: TITULO,
    exportFormats: ['excel', 'csv', 'pdf'],
    presetFilters: PRESETS_DOCUMENTO,
    charts: GRAFICAS_DOCUMENTO,
    emptyTitle: 'Realice una consulta',
    emptyDescription:
      'Elija el año fiscal, el tipo de información y el nivel de consulta y, si quiere, la entidad, la unidad ejecutora, la fuente de financiamiento y el clasificador.',
  });

  consultar(parametros: QueryReportParameters): void {
    const anio = String(parametros['anio'] ?? '');
    const tipoInformacion = String(parametros['tipoInformacion'] ?? '');
    const nivel = (String(parametros['nivel'] ?? '') || 'solicitud') as NivelConsulta;
    const lista = (clave: string) => (parametros[clave] as string[] | undefined) ?? [];
    const entidades = lista('entidad').map(codigo);
    const unidades = lista('unidadEjecutora').map(normalizar);
    const fuentes = lista('ff').map(codigo);
    const clasificadores = lista('clasificador').map(normalizar);

    const delAnio = (d: { fecha: string }) => !anio || d.fecha.slice(0, 4) === anio;
    const cumpleDocumento = (d: DocumentoConsultado) =>
      (!entidades.length || entidades.includes(codigo(d.entidad))) && (!unidades.length || unidades.includes(normalizar(d.unidadEjecutora)));
    const cumpleRegistro = (r: ClasificadorEstimacionIngresos) =>
      (!fuentes.length || fuentes.includes(codigo(r.ff))) &&
      (!clasificadores.length || clasificadores.some((c) => normalizar(r.clasificador).includes(c)));

    const historica = nivel === 'historica';
    this.config.update((actual) => ({
      ...actual,
      columns: historica ? COLUMNAS_HISTORICA : COLUMNAS,
      columnsPanel: historica ? PANEL_HISTORICA : PANEL_DOCUMENTO,
      presetFilters: historica ? [] : PRESETS_DOCUMENTO,
      charts: historica ? GRAFICAS_HISTORICA : GRAFICAS_DOCUMENTO,
    }));

    // Egresos todavía no tiene documentos: su consulta sale vacía.
    const documentos$: Observable<DocumentoConsultado[]> =
      tipoInformacion === 'egresos' ? of([]) : this.documentosDe(historica ? 'solicitud' : nivel, delAnio);
    this.cargando.set(true);
    documentos$.subscribe({
      next: (docs) => {
        const documentos = docs
          .filter(cumpleDocumento)
          .map((d) => ({ ...d, registros: d.registros.filter(cumpleRegistro) }))
          .filter((d) => d.registros.length);
        this.mostrar(nivel, documentos);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  private mostrar(nivel: NivelConsulta, documentos: DocumentoConsultado[]): void {
    if (nivel === 'historica') {
      const filas = this.filasHistoricas(documentos);
      const totalHistorico = filas.reduce((s, f) => s + Number(String(f['promedioAnual']).replace(/,/g, '')), 0);
      this.resultado.set({
        rows: filas,
        summary: {
          label: 'Nivel de consulta',
          icon: 'history',
          title: nombreNivel(nivel),
          description: `${filas.length} ${filas.length === 1 ? 'clasificador' : 'clasificadores'}`,
          fields: [{ label: 'Recaudación histórica', value: `S/ ${monto(totalHistorico)}` }],
        },
      });
      return;
    }
    const total = (campo: 'anio2027' | 'promedioAnual') =>
      documentos.reduce((s, d) => s + d.registros.reduce((t, r) => t + (r[campo] ?? 0), 0), 0);
    const filas = documentos.flatMap((d) => d.registros.map((r) => this.aFila(d, r)));
    this.resultado.set({
      rows: filas,
      summary: {
        label: 'Nivel de consulta',
        icon: 'description',
        title: nombreNivel(nivel),
        description: `${documentos.length} ${documentos.length === 1 ? 'documento' : 'documentos'} · ${filas.length} ${filas.length === 1 ? 'registro' : 'registros'}`,
        fields: [
          { label: 'Recaudación histórica', value: `S/ ${monto(total('promedioAnual'))}` },
          { label: 'Recaudación estimada 2027', value: `S/ ${monto(total('anio2027'))}` },
        ],
      },
    });
  }

  /** «Recaudación histórica»: un renglón por entidad, unidad ejecutora, fuente y clasificador, con su promedio anual. */
  private filasHistoricas(documentos: DocumentoConsultado[]): QueryReportRow[] {
    const valores = new Map<string, { fila: QueryReportRow; valor: number }>();
    for (const d of documentos) {
      for (const r of d.registros) {
        const id = [d.entidad, d.unidadEjecutora, r.ff, r.clasificador].join('|');
        const valor = Math.max(valores.get(id)?.valor ?? 0, r.promedioAnual ?? 0);
        const ff = r.ffDescripcion ? `${r.ff} ${r.ffDescripcion}` : r.ff;
        valores.set(id, {
          valor,
          fila: { id, entidad: d.entidad, unidadEjecutora: d.unidadEjecutora, ff, clasificador: r.clasificador, promedioAnual: monto(valor) },
        });
      }
    }
    return [...valores.values()].map((v) => v.fila);
  }

  guardarFavoritos(lista: QueryReportFavorite[]): void {
    this.favoritos.set(lista);
    try {
      localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify(lista));
    } catch {
      // Sin almacenamiento (navegación privada): los favoritos duran lo que la pantalla.
    }
  }

  exportar(evento: QueryReportExportEvent): void {
    const todas = this.config().columns;
    const columnas = todas.filter((c) => evento.visibleColumns.includes(c.key));
    void exportarConsultaPlaneacion(evento.format, TITULO, columnas.length ? columnas : todas, evento.rows);
  }

  /** El nombre del documento abre su detalle (solicitud, consolidado o proyección). */
  abrirDocumento(fila: QueryReportRow): void {
    if (fila['ruta']) void this.router.navigateByUrl(fila['ruta']);
  }

  /** Documentos de un tipo que cumplen los parámetros, con sus registros (uno por clasificador). */
  private documentosDe(tipo: TipoDocumento, cumple: (d: { fecha: string }) => boolean): Observable<DocumentoConsultado[]> {
    if (tipo === 'solicitud') {
      return this.api.listarDocumentos().pipe(
        map((docs) => docs.filter(cumple)),
        switchMap((docs) =>
          docs.length
            ? forkJoin(
                docs.map((d) =>
                  this.api.obtenerDetalle(d.id).pipe(
                    map((det): DocumentoConsultado => ({
                      tipo,
                      id: d.id,
                      documento: d.documento,
                      numero: d.numero,
                      estado: d.estado,
                      tipoAccion: d.tipoAccion,
                      fecha: d.fecha,
                      entidad: det.entidad || d.entidad,
                      unidadEjecutora: det.unidadEjecutora ?? '',
                      registros: det.clasificadores ?? [],
                    })),
                    catchError(() => of(null)),
                  ),
                ),
              ).pipe(map((lista) => lista.filter((d): d is DocumentoConsultado => !!d)))
            : of([]),
        ),
      );
    }
    return this.api.listarConsolidadosPliego(tipo).pipe(
      map((bandeja) => bandeja.documentos.filter(cumple)),
      switchMap((docs) =>
        docs.length
          ? forkJoin(
              docs.map((d) =>
                this.api.obtenerConsolidadoPliego(d.id, tipo).pipe(
                  map((det): DocumentoConsultado => ({
                    tipo,
                    id: d.id,
                    documento: d.documento,
                    numero: d.numero,
                    estado: d.estado,
                    tipoAccion: d.tipoAccion,
                    fecha: d.fecha,
                    entidad: det.entidad || d.entidad,
                    unidadEjecutora: '',
                    registros: det.registros ?? [],
                  })),
                  catchError(() => of(null)),
                ),
              ),
            ).pipe(map((lista) => lista.filter((d): d is DocumentoConsultado => !!d)))
          : of([]),
      ),
    );
  }

  private aFila(d: DocumentoConsultado, r: ClasificadorEstimacionIngresos): QueryReportRow {
    return {
      id: `${d.tipo}-${d.id}-${r.ff}-${r.clasificador}`,
      documento: d.documento,
      numero: d.numero,
      tipoAccion: d.tipoAccion,
      fecha: aFechaPe(d.fecha),
      entidad: d.entidad,
      unidadEjecutora: d.unidadEjecutora,
      ff: r.ffDescripcion ? `${r.ff} ${r.ffDescripcion}` : r.ff,
      clasificador: r.clasificador,
      promedioAnual: monto(r.promedioAnual),
      anio2027: monto(r.anio2027),
      anio2028: monto(r.anio2028),
      anio2029: monto(r.anio2029),
      baseLegal: r.baseLegal,
      variacionMonto: monto(r.variacionMonto),
      variacionPorcentaje: porcentaje(r.variacionPorcentaje),
      estado: d.estado,
      ruta: d.tipo === 'solicitud' ? solicitudRoute(d.id) : AMBITOS_CONSOLIDADO[d.tipo].detalle(d.id),
    };
  }
}
