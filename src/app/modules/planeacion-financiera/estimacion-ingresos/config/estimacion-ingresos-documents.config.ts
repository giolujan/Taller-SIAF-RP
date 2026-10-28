import type {
  DocumentsRecordsColumn,
  DocumentsRecordsConfig,
  DocumentsRecordsCreateProcessOption,
  DocumentsRecordsFilterOption,
  DocumentsRecordsMenuOption,
} from '../../../../shared/types/documents-records.types';
import { buildProcessBreadcrumbs } from '../../../../shared/utils/breadcrumbs.util';
import { PROCESS_ID, PROCESS_ROUTE, SOLICITUD_SEGMENT } from './estimacion-ingresos.rutas';

/**
 * Configuración de la bandeja «Documentos de estimación de Ingresos» (Figma CEL-005.01.01.01.01, node
 * 2448:146364). La pantalla completa la pinta `siaf-documents-records-page` con `modoConsulta: true`. La tab
 * Registros todavía no está implementada: `recordRows`/`recordColumns` quedan vacíos.
 *
 * A diferencia de otros procesos de solo consulta (ej. Ingresos tributarios SUNAT), este sí tiene «Crear
 * documento» y el flujo estándar creador/aprobador (Elaborado → Verificado → Aprobado) en la solicitud, por eso
 * `createDocumentOptions` convive con `modoConsulta: true` (la bandeja en sí no filtra filas por rol).
 */

const DOCUMENTO_LABEL = 'Solicitud de estimación de ingresos';

export const ESTIMACION_INGRESOS_CREATE_OPTIONS: DocumentsRecordsCreateProcessOption[] = [
  {
    id: PROCESS_ID,
    label: 'Estimación de ingresos',
    route: `${PROCESS_ROUTE}/${SOLICITUD_SEGMENT}`,
    documents: [DOCUMENTO_LABEL],
    documentOptions: [
      { label: DOCUMENTO_LABEL, route: `${PROCESS_ROUTE}/${SOLICITUD_SEGMENT}`, actionTypes: ['Creación', 'Modificación'] },
    ],
    actionTypes: ['Creación', 'Modificación'],
    // El campo «Número» de «Crear documento» se autocompleta con el siguiente correlativo (ver
    // `documents-records-page.component.ts`): no distingue Creación de Modificación.
    numberFieldLabel: 'Número',
  },
];

const documentColumns: DocumentsRecordsColumn[] = [
  { key: 'document', label: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[280px]' },
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

export const ESTIMACION_INGRESOS_DOCUMENTS_CONFIG: DocumentsRecordsConfig = {
  title: 'Estimación de ingresos',
  processId: PROCESS_ID,
  defaultRequestRoute: PROCESS_ROUTE,
  createDocumentOptions: ESTIMACION_INGRESOS_CREATE_OPTIONS,
  modoConsulta: true,
  breadcrumbs: buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE),
  documentRows: [],
  recordRows: [],
  documentColumns,
  recordColumns: [],
  documentTableMinWidthClass: 'min-w-[1200px]',
  recordTableMinWidthClass: 'min-w-[1200px]',
  recordTrackKey: 'id',
  recordHistoryDocumentLabel: 'Estimación de ingresos',
  recordHistoryKind: 'documento',
  statusFilterOptions: ['Elaborado', 'Verificado', 'Aprobado'],
  actionTypeFilterOptions: ['Creación'],
  filterCampoOptions,
  filterValorOptions,
  fieldsMenuOptions,
};
