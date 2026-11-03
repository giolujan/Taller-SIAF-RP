/**
 * Proceso «Registro de la estimación de Ingresos» (Planeación financiera > Flujos de caja proyectados >
 * Estimación de ingresos). La bandeja tiene «Crear documento» (Creación o Modificación, Número autocompletado con
 * el siguiente correlativo) y el documento sigue el flujo estándar creador/aprobador: Elaborado → Verificado →
 * Aprobado.
 */

/** Estados del Figma «flow tags» para esta bandeja: gris (Elaborado), azul (Verificado) y verde (Aprobado). */
export type EstadoEstimacionIngresos = 'Elaborado' | 'Verificado' | 'Aprobado';

export interface EstimacionIngresosRegistro {
  id: string;
  documento: string;
  numero: string;
  tipoAccion: string;
  estado: EstadoEstimacionIngresos;
  sistema: string;
  /** Fecha de registro (ISO). */
  fecha: string;
  entidad: string;
  /** Se completan al verificar (ver `EstimacionIngresosApiService.verificar`). */
  verificadoPor?: string;
  fechaVerificado?: string;
  /** Se completan al aprobar (ver `EstimacionIngresosApiService.aprobar`). */
  aprobadoPor?: string;
  fechaAprobado?: string;
  /** Se completan al editar (ver `EstimacionIngresosApiService.actualizar`); sin editar, el detalle usa los
   *  valores por defecto (`CLASIFICADORES_ESTIMACION_INGRESOS` y «Montos»). */
  tipoModificacionTexto?: string;
  clasificadoresPersonalizados?: ClasificadorEstimacionIngresos[];
}

/** Una fila de la tabla de clasificadores de ingresos (Figma node 4021:103273, «Table Estimacion_Ingresos»). */
export interface ClasificadorEstimacionIngresos {
  /** Código de la genérica de ingreso (columna «FF»). */
  ff: string;
  clasificador: string;
  /** Recaudación histórica, promedio anual (a). */
  promedioAnual: number;
  /** Recaudación estimada (b), (c), (d). */
  anio2027: number;
  anio2028: number;
  anio2029: number;
  baseLegal: 'SI' | 'NO';
  /** Variación (b) vs (a): monto (e) y porcentaje (f). */
  variacionMonto: number;
  variacionPorcentaje: number;
}

/**
 * Detalle de una «Solicitud de estimación de ingresos» (Figma node 4021:103234, «Solicitud elaborada»): de solo
 * lectura, como el resto de documentos de este proceso — se arma al crearse y no tiene flujo de edición.
 */
export interface DetalleEstimacionIngresos {
  documentoId: string;
  documento: string;
  numero: string;
  fecha: string;
  enteRector: string;
  entidad: string;
  unidadEjecutora: string;
  estado: EstadoEstimacionIngresos;
  tipoAccion: string;
  /** Solo en Modificación (ej. «Montos»): el campo «Tipo de modificación» del Figma. */
  tipoModificacion?: string;
  clasificadores: ClasificadorEstimacionIngresos[];
  elaboradoPor: string;
  fechaElaborado: string;
  /** Solo cuando `estado` es `Verificado` o `Aprobado`. */
  verificadoPor?: string;
  fechaVerificado?: string;
  /** Solo cuando `estado === 'Aprobado'`. */
  aprobadoPor?: string;
  fechaAprobado?: string;
}

/**
 * Precarga de una solicitud «Nuevo» (Figma node 2448:143931, «Registrar solicitud»): lo que muestra la pantalla
 * antes de Grabar, sin número ni estado.
 */
export type PrecargaEstimacionIngresos = Pick<DetalleEstimacionIngresos, 'fecha' | 'enteRector' | 'entidad' | 'unidadEjecutora' | 'clasificadores'>;

/** Payload de Grabar una solicitud «Nuevo»: crea el documento en «Elaborado». */
export interface CrearEstimacionIngresosPayload {
  tipoAccion: string;
  tipoModificacionTexto?: string;
  clasificadores?: ClasificadorEstimacionIngresos[];
}

/** Variación (f) por encima de este porcentaje se marca con el ícono de tendencia en la tabla de clasificadores. */
export const UMBRAL_VARIACION_ESTIMACION_INGRESOS = 15;

/** Payload de Grabar en edición: solo documentos «Elaborado» aceptan este endpoint. */
export interface ActualizarEstimacionIngresosPayload {
  tipoModificacionTexto?: string;
  clasificadores?: ClasificadorEstimacionIngresos[];
}

/** Opciones del selector «Tipo de modificación» (Figma «Text fields», node 4021:103143). */
export const TIPOS_MODIFICACION_ESTIMACION_INGRESOS = ['Montos', 'Datos'] as const;

/**
 * Payload para editar una fila de la tabla de clasificadores (Figma node 4021:102921, «Solicitud elaborada»):
 * la variación (monto y %) la recalcula el backend a partir de `promedioAnual` y `anio2027`.
 */
export interface ActualizarClasificadorPayload {
  ff: string;
  clasificador: string;
  promedioAnual: number;
  anio2027: number;
  anio2028: number;
  anio2029: number;
  baseLegal: 'SI' | 'NO';
}
