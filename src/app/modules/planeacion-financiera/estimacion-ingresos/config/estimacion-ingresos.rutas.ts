/** Rutas e ids del proceso. El id existe en `DEFAULT_PROCESS_TREE` (shared/utils/process-tree.util.ts). */
export const PROCESS_ROUTE = '/procesos/estimacion-ingresos';
/** Solicitud elaborada (de solo lectura) que crea «Crear documento». */
export const SOLICITUD_SEGMENT = 'solicitud';
export const solicitudRoute = (id: string): string => `${PROCESS_ROUTE}/${SOLICITUD_SEGMENT}/${id}`;

/** Hoja «Registro de la estimación de Ingresos» del árbol de procesos: arma las migas de pan. */
export const PROCESS_ID = 'estimacion-ingresos-registro';
