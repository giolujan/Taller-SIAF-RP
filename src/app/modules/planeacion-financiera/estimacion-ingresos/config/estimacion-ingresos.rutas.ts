/** Rutas e ids del proceso. El id existe en `DEFAULT_PROCESS_TREE` (shared/utils/process-tree.util.ts). */
export const PROCESS_ROUTE = '/procesos/estimacion-ingresos';
/** Solicitud elaborada (de solo lectura) que crea «Crear documento». */
export const SOLICITUD_SEGMENT = 'solicitud';
export const solicitudRoute = (id: string): string => `${PROCESS_ROUTE}/${SOLICITUD_SEGMENT}/${id}`;
/** «Detalle de estimación de ingresos» de un registro (Figma node 4524:194826): se abre con clic en su fila. El
 *  registro va por el código del clasificador (ej. `3.1.5.1`), único dentro de la solicitud. */
export const REGISTRO_SEGMENT = 'registro';
export const registroRoute = (id: string, codigoClasificador: string): string =>
  `${solicitudRoute(id)}/${REGISTRO_SEGMENT}/${encodeURIComponent(codigoClasificador)}`;

/** Hoja «Registro de la estimación de Ingresos» del árbol de procesos: arma las migas de pan. */
export const PROCESS_ID = 'estimacion-ingresos-registro';

/** Hoja «Documentos de consolidado pliego de estimación de ingresos» (Figma CEL-005 node 4938:92579). */
export const CONSOLIDADO_PLIEGO_ID = 'estimacion-ingresos-consolidado-pliego';
export const CONSOLIDADO_PLIEGO_ROUTE = '/procesos/consolidado-pliego-estimacion-ingresos';
/** Consolidado «Nuevo» que abre «Crear documento» (misma pantalla que la solicitud de estimación de ingresos). */
export const CONSOLIDADO_PLIEGO_NUEVO_ROUTE = `${CONSOLIDADO_PLIEGO_ROUTE}/consolidado`;
/** Consolidado ya grabado (Figma node 7606:466323). */
export const consolidadoPliegoRoute = (id: string): string => `${CONSOLIDADO_PLIEGO_NUEVO_ROUTE}/${id}`;
