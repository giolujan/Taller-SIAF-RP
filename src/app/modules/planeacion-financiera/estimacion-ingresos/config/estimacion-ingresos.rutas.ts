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
/** «Crear documento»: crea el consolidado directo en Elaborado y abre `consolidadoPliegoRoute(id)`. */
export const CONSOLIDADO_PLIEGO_NUEVO_ROUTE = `${CONSOLIDADO_PLIEGO_ROUTE}/consolidado`;
/** Consolidado ya grabado (Figma node 7606:466323). */
export const consolidadoPliegoRoute = (id: string): string => `${CONSOLIDADO_PLIEGO_NUEVO_ROUTE}/${id}`;

/** Hoja «Documentos de consolidado DGTP de estimación de ingresos» (Figma page «F.1 Rol Creador», node 4938:253880). */
export const CONSOLIDADO_DGTP_ID = 'estimacion-ingresos-consolidado-dgtp';
export const CONSOLIDADO_DGTP_ROUTE = '/procesos/consolidado-dgtp-estimacion-ingresos';
/** «Crear documento» del DGTP: crea el consolidado directo en Elaborado y abre `consolidadoDgtpRoute(id)`. */
export const CONSOLIDADO_DGTP_NUEVO_ROUTE = `${CONSOLIDADO_DGTP_ROUTE}/consolidado`;
/** Consolidado DGTP ya creado (Figma node 4760:174853). */
export const consolidadoDgtpRoute = (id: string): string => `${CONSOLIDADO_DGTP_NUEVO_ROUTE}/${id}`;

/** Hoja «Documentos de proyección DGTP de ingresos»: replica la bandeja y el flujo de creación del consolidado DGTP. */
export const PROYECCION_DGTP_ID = 'estimacion-ingresos-proyeccion-dgtp';
export const PROYECCION_DGTP_ROUTE = '/procesos/proyeccion-dgtp-ingresos';
/** «Crear documento» de la proyección: la crea directo en Elaborado y abre `proyeccionDgtpRoute(id)`. */
export const PROYECCION_DGTP_NUEVO_ROUTE = `${PROYECCION_DGTP_ROUTE}/proyeccion`;
export const proyeccionDgtpRoute = (id: string): string => `${PROYECCION_DGTP_NUEVO_ROUTE}/${id}`;

/**
 * Qué consolidado se ve: el del pliego (consolida las unidades ejecutoras del pliego), el de la DGTP (consolida los
 * pliegos) o la proyección DGTP (mismo universo que el consolidado DGTP). Las bandejas y pantallas son las mismas;
 * cambian el título, las rutas y los datos. Va en el `data` de la ruta (`ambito`).
 */
export type AmbitoConsolidado = 'pliego' | 'dgtp' | 'proyeccion';

export interface DatosAmbitoConsolidado {
  /** Nombre del documento, ej. «Consolidado DGTP de estimación de ingresos». */
  documento: string;
  /** Título de la sección de la tabla: «Relación de pliegos consolidados» o «Universo consolidado» (DGTP). */
  seccion: string;
  /** Hoja del árbol de procesos (migas de pan). */
  procesoId: string;
  /** Bandeja del consolidado. */
  bandeja: string;
  /** «Crear documento»: crea el consolidado en Elaborado y abre `detalle(id)`. */
  nuevo: string;
  /** Consolidado ya grabado. */
  detalle: (id: string) => string;
  /** «Detalle de estimación de ingresos» de un registro del consolidado (clic en su fila). */
  registro: (id: string, codigoClasificador: string) => string;
  /** Al abrir, las ramas con detalle se despliegan (pliego) o todo empieza contraído (DGTP, Figma node 4760:174853). */
  abrirRamas: boolean;
}

export const AMBITOS_CONSOLIDADO: Record<AmbitoConsolidado, DatosAmbitoConsolidado> = {
  pliego: {
    documento: 'Consolidado pliego de estimación de ingresos',
    seccion: 'Relación de pliegos consolidados',
    procesoId: CONSOLIDADO_PLIEGO_ID,
    bandeja: CONSOLIDADO_PLIEGO_ROUTE,
    nuevo: CONSOLIDADO_PLIEGO_NUEVO_ROUTE,
    detalle: consolidadoPliegoRoute,
    registro: (id, codigo) => `${consolidadoPliegoRoute(id)}/${REGISTRO_SEGMENT}/${encodeURIComponent(codigo)}`,
    abrirRamas: true,
  },
  dgtp: {
    documento: 'Consolidado DGTP de estimación de ingresos',
    seccion: 'Universo consolidado',
    procesoId: CONSOLIDADO_DGTP_ID,
    bandeja: CONSOLIDADO_DGTP_ROUTE,
    nuevo: CONSOLIDADO_DGTP_NUEVO_ROUTE,
    detalle: consolidadoDgtpRoute,
    registro: (id, codigo) => `${consolidadoDgtpRoute(id)}/${REGISTRO_SEGMENT}/${encodeURIComponent(codigo)}`,
    abrirRamas: false,
  },
  proyeccion: {
    documento: 'Proyección DGTP de ingresos',
    seccion: 'Universo consolidado',
    procesoId: PROYECCION_DGTP_ID,
    bandeja: PROYECCION_DGTP_ROUTE,
    nuevo: PROYECCION_DGTP_NUEVO_ROUTE,
    detalle: proyeccionDgtpRoute,
    registro: (id, codigo) => `${proyeccionDgtpRoute(id)}/${REGISTRO_SEGMENT}/${encodeURIComponent(codigo)}`,
    abrirRamas: false,
  },
};
