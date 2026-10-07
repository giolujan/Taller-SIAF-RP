import type {
  DocumentsRecordsColumn,
  DocumentsRecordsConfig,
  DocumentsRecordsFilterOption,
  DocumentsRecordsMenuOption,
} from '../../../../shared/types/documents-records.types';
import { buildProcessBreadcrumbs } from '../../../../shared/utils/breadcrumbs.util';
import type { TipoRegistroIngresoTributario } from '../models/ingreso-tributario.model';
import { PROCESS_ID, PROCESS_ROUTE } from './ingresos-tributarios-sunat.rutas';

/**
 * Configuración de la bandeja «Documentos de Ingresos tributarios SUNAT». La pantalla completa la pinta
 * `siaf-documents-records-page` con `modoConsulta: true`: sin «Crear documento» ni acción principal, porque los
 * documentos los genera el motor de integración con SUNAT, no un usuario.
 */

const documentColumns: DocumentsRecordsColumn[] = [
  { key: 'document', label: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[300px]', kind: 'document-link' },
  { key: 'number', label: 'Número', visibility: 'visible', group: 'default', widthClass: 'w-[130px]' },
  { key: 'actionType', label: 'Tipo de acción', visibility: 'visible', group: 'default', widthClass: 'w-[130px]' },
  { key: 'status', label: 'Estado', visibility: 'visible', group: 'default', widthClass: 'w-[106px]', kind: 'flow-status' },
  { key: 'date', label: 'Fecha de registro', visibility: 'visible', group: 'default', widthClass: 'w-[170px]' },
  { key: 'entity', label: 'Entidad', visibility: 'visible', group: 'default', widthClass: 'w-[300px]' },
];

const fieldsMenuOptions: DocumentsRecordsMenuOption[] = [
  { label: 'Documento' },
  { label: 'Tipo de acción' },
  { label: 'Estado' },
  { label: 'Fecha de registro', hasChildren: true },
  { label: 'Entidad' },
];

const filterCampoOptions: DocumentsRecordsFilterOption[] = [
  { label: 'Documento', value: 'document' },
  { label: 'Número', value: 'number' },
  { label: 'Tipo de acción', value: 'actionType' },
  { label: 'Estado', value: 'status' },
  { label: 'Fecha', value: 'date' },
  { label: 'Entidad', value: 'entity' },
];

const filterValorOptions: DocumentsRecordsFilterOption[] = [
  { label: 'Registrado', value: 'Registrado' },
  { label: 'Pendiente', value: 'Pendiente' },
  { label: 'Procesado', value: 'Procesado' },
  { label: 'Creación', value: 'Creación' },
];

/** Etiqueta de la sub-pestaña («Buttons group») del Figma de Registros. */
export const TIPOS_REGISTRO: { value: TipoRegistroIngresoTributario; label: string }[] = [
  { value: 'reporte-recaudacion', label: 'Reporte de recaudación' },
  { value: 'nota-debito', label: 'Nota de débito' },
];

/**
 * Columnas de la tab Registros, por tipo (Reporte de recaudación / Nota de débito): mismas columnas, el número de
 * origen cambia de etiqueta según el tipo seleccionado. «Documento» es una cabecera agrupada (`headerGroup`) sobre
 * Número y Nombre, tal como en el Figma.
 */
export function recordColumnsFor(tipo: TipoRegistroIngresoTributario): DocumentsRecordsColumn[] {
  const etiquetaOrigen = tipo === 'nota-debito' ? 'Número de la Nota de Débito' : 'Número del Reporte de Recaudación';
  return [
    { key: 'nro', label: 'Nro', visibility: 'visible', group: 'default', widthClass: 'w-[60px]' },
    { key: 'numeroOrigen', label: etiquetaOrigen, visibility: 'visible', group: 'default', widthClass: 'w-[200px]' },
    { key: 'entidadFinanciera', label: 'Entidad Financiera', visibility: 'visible', group: 'default', widthClass: 'w-[250px]' },
    { key: 'moneda', label: 'Moneda', visibility: 'visible', group: 'default', widthClass: 'w-[90px]' },
    { key: 'montoTotal', label: 'Monto total', visibility: 'visible', group: 'default', widthClass: 'w-[130px]' },
    { key: 'status', label: 'Estado del registro', visibility: 'visible', group: 'default', widthClass: 'w-[140px]', kind: 'record-status' },
    { key: 'documentoNumero', label: 'Número', visibility: 'visible', group: 'default', widthClass: 'w-[130px]', headerGroup: 'Documento' },
    { key: 'documentoNombre', label: 'Nombre', visibility: 'visible', group: 'default', widthClass: 'w-[280px]', headerGroup: 'Documento' },
  ];
}

export const INGRESOS_TRIBUTARIOS_SUNAT_DOCUMENTS_CONFIG: DocumentsRecordsConfig = {
  title: 'Ingresos tributarios SUNAT',
  processId: PROCESS_ID,
  defaultRequestRoute: PROCESS_ROUTE,
  createDocumentOptions: [],
  modoConsulta: true,
  breadcrumbs: buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE),
  documentRows: [],
  recordRows: [],
  documentColumns,
  recordColumns: recordColumnsFor('reporte-recaudacion'),
  documentTableMinWidthClass: 'min-w-[1200px]',
  recordTableMinWidthClass: 'min-w-[1400px]',
  recordTrackKey: 'id',
  recordHistoryDocumentLabel: 'Ingresos tributarios SUNAT',
  recordHistoryKind: 'documento',
  statusFilterOptions: ['Registrado', 'Pendiente', 'Procesado'],
  actionTypeFilterOptions: ['Creación'],
  filterCampoOptions,
  filterValorOptions,
  fieldsMenuOptions,
};
