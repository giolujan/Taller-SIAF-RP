/** Rutas e ids del proceso. Los ids existen en `DEFAULT_PROCESS_TREE` (shared/utils/process-tree.util.ts). */
export const PROCESS_ROUTE = '/procesos/ingresos-tributarios-sunat';
export const CONSULTAS_ROUTE = `${PROCESS_ROUTE}/consultas`;
/** Detalle de un documento (solo lectura, sin solicitud ni acciones). */
export const DOCUMENTO_SEGMENT = 'documento';
export const documentoRoute = (id: string): string => `${PROCESS_ROUTE}/${DOCUMENTO_SEGMENT}/${id}`;

/** Hoja «Documentos de Ingresos tributarios SUNAT» del árbol de procesos: arma las migas de pan. */
export const PROCESS_ID = 'ingresos-tributarios-sunat-documentos';
/** Hoja «Consulta de Ingresos tributarios SUNAT» del árbol de procesos. */
export const CONSULTAS_PROCESS_ID = 'ingresos-tributarios-sunat-consultas';
