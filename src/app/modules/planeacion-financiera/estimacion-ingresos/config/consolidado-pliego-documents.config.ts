import type {
  DocumentsRecordsColumn,
  DocumentsRecordsConfig,
  DocumentsRecordsCreateProcessOption,
  DocumentsRecordsFilterOption,
  DocumentsRecordsMenuOption,
} from '../../../../shared/types/documents-records.types';
import { buildProcessBreadcrumbs } from '../../../../shared/utils/breadcrumbs.util';
import { AMBITOS_CONSOLIDADO, AmbitoConsolidado, CONSOLIDADO_PLIEGO_ID, CONSOLIDADO_PLIEGO_NUEVO_ROUTE, CONSOLIDADO_PLIEGO_ROUTE } from './estimacion-ingresos.rutas';

/**
 * Bandeja «Documentos de consolidado pliego de estimación de ingresos» (Figma CEL-005.01.01.01.01, node 4938:92579),
 * vista del creador del pliego. La pinta `siaf-documents-records-page` con `modoConsulta: true`, como la bandeja de
 * las solicitudes: muestra todos los estados y tiene «Crear documento». La tab Registros todavía no está diseñada.
 *
 * La bandeja «Documentos de consolidado DGTP de estimación de ingresos» (Figma node 4938:253880) es la misma con otro
 * título, documento y rutas: `consolidadoDocumentsConfig('dgtp')`.
 */

export const DOCUMENTO_CONSOLIDADO_PLIEGO = 'Consolidado pliego de estimación de ingresos';

/** «Crear documento»: Aceptar crea el consolidado en Elaborado y lo abre. */
const createDocumentOptions: DocumentsRecordsCreateProcessOption[] = [
  {
    id: CONSOLIDADO_PLIEGO_ID,
    label: 'Estimación de ingresos',
    route: CONSOLIDADO_PLIEGO_NUEVO_ROUTE,
    documents: [DOCUMENTO_CONSOLIDADO_PLIEGO],
    documentOptions: [{ label: DOCUMENTO_CONSOLIDADO_PLIEGO, route: CONSOLIDADO_PLIEGO_NUEVO_ROUTE, actionTypes: ['Creación'] }],
    actionTypes: ['Creación'],
    numberFieldLabel: 'Número',
  },
];

const documentColumns: DocumentsRecordsColumn[] = [
  { key: 'document', label: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[280px]', kind: 'document-link' },
  { key: 'number', label: 'Número', visibility: 'visible', group: 'default', widthClass: 'w-[90px]' },
  { key: 'actionType', label: 'Tipo de acción', visibility: 'visible', group: 'default', widthClass: 'w-[140px]' },
  { key: 'status', label: 'Estado', visibility: 'visible', group: 'default', widthClass: 'w-[120px]', kind: 'flow-status' },
  { key: 'system', label: 'Sistema', visibility: 'visible', group: 'default', widthClass: 'w-[150px]' },
  { key: 'date', label: 'Fecha de registro', visibility: 'visible', group: 'default', widthClass: 'w-[120px]' },
  { key: 'entity', label: 'Entidad', visibility: 'visible', group: 'default', widthClass: 'w-[280px]' },
];

const fieldsMenuOptions: DocumentsRecordsMenuOption[] = [
  { label: 'Documento' },
  { label: 'Número' },
  { label: 'Tipo de acción' },
  { label: 'Estado' },
  { label: 'Sistema' },
  { label: 'Fecha de registro', hasChildren: true },
  { label: 'Entidad' },
];

const filterCampoOptions: DocumentsRecordsFilterOption[] = [
  { label: 'Documento', value: 'document' },
  { label: 'Número', value: 'number' },
  { label: 'Tipo de acción', value: 'actionType' },
  { label: 'Estado', value: 'status' },
  { label: 'Sistema', value: 'system' },
  { label: 'Fecha', value: 'date' },
  { label: 'Entidad', value: 'entity' },
];

const filterValorOptions: DocumentsRecordsFilterOption[] = [
  { label: 'Elaborado', value: 'Elaborado' },
  { label: 'Verificado', value: 'Verificado' },
  { label: 'Aprobado', value: 'Aprobado' },
  { label: 'Creación', value: 'Creación' },
];

export const CONSOLIDADO_PLIEGO_DOCUMENTS_CONFIG: DocumentsRecordsConfig = {
  title: 'Documentos de consolidado pliego de estimación de ingresos',
  processId: CONSOLIDADO_PLIEGO_ID,
  defaultRequestRoute: CONSOLIDADO_PLIEGO_ROUTE,
  createDocumentOptions,
  modoConsulta: true,
  breadcrumbs: buildProcessBreadcrumbs(CONSOLIDADO_PLIEGO_ID, CONSOLIDADO_PLIEGO_ROUTE),
  documentRows: [],
  recordRows: [],
  documentColumns,
  recordColumns: [],
  documentTableMinWidthClass: 'min-w-[1200px]',
  recordTableMinWidthClass: 'min-w-[1200px]',
  recordTrackKey: 'id',
  recordHistoryDocumentLabel: DOCUMENTO_CONSOLIDADO_PLIEGO,
  recordHistoryKind: 'documento',
  statusFilterOptions: ['Elaborado', 'Verificado', 'Aprobado'],
  actionTypeFilterOptions: ['Creación'],
  filterCampoOptions,
  filterValorOptions,
  fieldsMenuOptions,
};

/** El consolidado DGTP se crea por Creación o por Modificación; el del pliego y la proyección DGTP solo por Creación. */
const TIPOS_ACCION: Record<AmbitoConsolidado, string[]> = {
  pliego: ['Creación'],
  dgtp: ['Creación', 'Modificación'],
  proyeccion: ['Creación'],
};

/** La bandeja del consolidado (pliego o DGTP) o de la proyección DGTP: misma tabla, filtros y campos; cambian textos y rutas. */
export function consolidadoDocumentsConfig(ambito: AmbitoConsolidado): DocumentsRecordsConfig {
  if (ambito === 'pliego') return CONSOLIDADO_PLIEGO_DOCUMENTS_CONFIG;
  const a = AMBITOS_CONSOLIDADO[ambito];
  const tipos = TIPOS_ACCION[ambito];
  return {
    ...CONSOLIDADO_PLIEGO_DOCUMENTS_CONFIG,
    title: `Documentos de ${a.documento.charAt(0).toLowerCase()}${a.documento.slice(1)}`,
    processId: a.procesoId,
    defaultRequestRoute: a.bandeja,
    breadcrumbs: buildProcessBreadcrumbs(a.procesoId, a.bandeja),
    recordHistoryDocumentLabel: a.documento,
    createDocumentOptions: [
      {
        id: a.procesoId,
        label: 'Estimación de ingresos',
        route: a.nuevo,
        documents: [a.documento],
        documentOptions: [{ label: a.documento, route: a.nuevo, actionTypes: tipos }],
        actionTypes: tipos,
        numberFieldLabel: 'Número',
      },
    ],
    actionTypeFilterOptions: tipos,
    // La proyección DGTP se puede observar: su bandeja también filtra por Observado.
    ...(ambito === 'proyeccion'
      ? { statusFilterOptions: ['Elaborado', 'Verificado', 'Observado', 'Aprobado'] }
      : {}),
    filterValorOptions: tipos.includes('Modificación')
      ? [...filterValorOptions, { label: 'Modificación', value: 'Modificación' }]
      : filterValorOptions,
  };
}
