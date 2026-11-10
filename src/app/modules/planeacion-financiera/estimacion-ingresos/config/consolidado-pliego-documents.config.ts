import type {
  DocumentsRecordsColumn,
  DocumentsRecordsConfig,
  DocumentsRecordsCreateProcessOption,
  DocumentsRecordsFilterOption,
  DocumentsRecordsMenuOption,
} from '../../../../shared/types/documents-records.types';
import { buildProcessBreadcrumbs } from '../../../../shared/utils/breadcrumbs.util';
import { CONSOLIDADO_PLIEGO_ID, CONSOLIDADO_PLIEGO_NUEVO_ROUTE, CONSOLIDADO_PLIEGO_ROUTE } from './estimacion-ingresos.rutas';

/**
 * Bandeja «Documentos de consolidado pliego de estimación de ingresos» (Figma CEL-005.01.01.01.01, node 4938:92579),
 * vista del creador del pliego. La pinta `siaf-documents-records-page` con `modoConsulta: true`, como la bandeja de
 * las solicitudes: muestra todos los estados y tiene «Crear documento». La tab Registros todavía no está diseñada.
 */

export const DOCUMENTO_CONSOLIDADO_PLIEGO = 'Consolidado pliego de estimación de ingresos';

/** «Crear documento»: Aceptar abre el consolidado «Nuevo» (relación de pliegos consolidados). */
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
