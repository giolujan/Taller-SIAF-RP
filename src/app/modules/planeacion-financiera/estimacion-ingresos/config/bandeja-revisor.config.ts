import type { DocumentsRecordsColumn, DocumentsRecordsConfig, DocumentsRecordsRow } from '../../../../shared/types/documents-records.types';
import { EstadoEvaluacionRegistro, estadoExpedienteEstimacion, numeroExpedienteEstimacion } from '../models/estimacion-ingresos.model';

/**
 * Bandeja del Revisor / Evaluador (Figma node 14751:191854): la misma para las solicitudes de estimación de ingresos y
 * para el consolidado pliego. Solo le llegan los documentos Aprobados, con su expediente, el estado del expediente, la
 * fecha de evaluación y el evaluador; la tabla mide 1716 px y se desplaza en horizontal. Es de solo lectura: sin
 * «Crear documento» ni acción principal.
 */
const COLUMNAS_REVISOR: DocumentsRecordsColumn[] = [
  { key: 'document', label: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[260px]', kind: 'document-link' },
  { key: 'number', label: 'Número', visibility: 'visible', group: 'default', widthClass: 'w-[90px]' },
  { key: 'actionType', label: 'Tipo de acción', visibility: 'visible', group: 'default', widthClass: 'w-[140px]' },
  { key: 'status', label: 'Estado', visibility: 'visible', group: 'default', widthClass: 'w-[120px]', kind: 'flow-status' },
  { key: 'system', label: 'Sistema', visibility: 'visible', group: 'default', widthClass: 'w-[150px]' },
  { key: 'date', label: 'Fecha de registro', visibility: 'visible', group: 'default', widthClass: 'w-[116px]' },
  { key: 'entity', label: 'Entidad', visibility: 'visible', group: 'default', widthClass: 'w-[130px]' },
  { key: 'expediente', label: 'Expediente', visibility: 'visible', group: 'default', widthClass: 'w-[236px]' },
  { key: 'estadoExpediente', label: 'Estado del expediente', visibility: 'visible', group: 'default', widthClass: 'w-[120px]', kind: 'expediente-status' },
  { key: 'fechaEvaluacion', label: 'Fecha de evaluación', visibility: 'visible', group: 'default', widthClass: 'w-[116px]' },
  { key: 'usuarioEvaluador', label: 'Usuario evaluador', visibility: 'visible', group: 'default', widthClass: 'w-[190px]', kind: 'two-lines' },
];

/** Evaluador asignado en la demo (el usuario Revisor / Evaluador): nombre y correo, como el Figma. */
const EVALUADOR_DEMO = { nombre: 'Rosa Quispe Huamán', correo: 'rosa.quispe@taller.pe' };

/** Un documento aprobado tal como lo necesita la bandeja del revisor. */
export interface DocumentoRevisor {
  numero: string;
  /** Fecha de registro (ISO): da el año del expediente. */
  fecha: string;
  fechaAprobado?: string;
  /** Registros con su evaluación: dan el estado del expediente (sin registros evaluados, «Creado»). */
  registros?: { estadoEvaluacion?: EstadoEvaluacionRegistro }[];
}

/** ISO → "dd/mm/aaaa". */
function aFechaPe(iso: string): string {
  const fecha = new Date(iso);
  return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
}

/**
 * La bandeja de `base` en la vista del revisor: solo las filas Aprobadas (`documentoDe` da el documento de cada fila),
 * con las columnas del expediente y la evaluación.
 */
export function bandejaRevisor(
  base: DocumentsRecordsConfig,
  filas: DocumentsRecordsRow[],
  documentoDe: (fila: DocumentsRecordsRow) => DocumentoRevisor | undefined,
): DocumentsRecordsConfig {
  const documentRows = filas
    .filter((r) => r['status'] === 'Aprobado')
    .flatMap((r) => {
      const d = documentoDe(r);
      if (!d) return [];
      return [{
        ...r,
        entity: String(r['entity'] ?? '').replace(/^(\d+)\s+/, '$1 - '),
        expediente: numeroExpedienteEstimacion(d),
        estadoExpediente: estadoExpedienteEstimacion(d.registros),
        fechaEvaluacion: aFechaPe(d.fechaAprobado ?? d.fecha),
        usuarioEvaluador: EVALUADOR_DEMO.nombre,
        usuarioEvaluadorDetalle: EVALUADOR_DEMO.correo,
      }];
    });
  return {
    ...base,
    documentColumns: COLUMNAS_REVISOR,
    documentTableMinWidthClass: 'min-w-[1716px]',
    fieldsMenuOptions: [
      ...base.fieldsMenuOptions,
      { label: 'Expediente' },
      { label: 'Estado del expediente' },
      { label: 'Fecha de evaluación' },
      { label: 'Usuario evaluador' },
    ],
    filterCampoOptions: [
      ...base.filterCampoOptions,
      { label: 'Expediente', value: 'expediente' },
      { label: 'Estado del expediente', value: 'estadoExpediente' },
    ],
    documentRows,
    statusFilterOptions: ['Aprobado'],
    modoConsulta: false,
  };
}
