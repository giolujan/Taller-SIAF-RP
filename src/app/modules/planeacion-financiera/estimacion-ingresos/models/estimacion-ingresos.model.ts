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
  /** Datos que muestra «Editar estimación de ingresos» (Figma node 4145:309441). Opcionales: las filas grabadas
   *  antes de esta pantalla no los traen. */
  ffDescripcion?: string;
  ffSigla?: string;
  clasificadorAnterior?: string;
  /** Monto que el prototipo carga en «Año 2027 (b)» con doble clic (Figma node 4304:67918). Solo demo. */
  anio2027Propuesto?: number;
  /** Distribución mensual del año 2027 (enero a diciembre): su suma debe igualar `anio2027`. */
  distribucionMensual?: number[];
  descripcionCualitativa?: string;
  /** «Base legal de uso específico» (Figma node 4304:68021): monto con asignación específica de los años 2027, 2028
   *  y 2029, en ese orden. */
  montoAsignacionEspecifica?: number[];
  /** Secuencias del documento del marco legal («Agregar secuencia», Figma node 7202:123062). */
  secuenciasBaseLegal?: SecuenciaBaseLegal[];
  /** Documento de sustento: solo nombre y tamaño (un `File` no se puede guardar en `localStorage`). */
  sustento?: ArchivoSustentoEstimacion | null;
}

/** Una secuencia de la base legal: reparte parte del monto con asignación específica de cada año. */
export interface SecuenciaBaseLegal {
  secuencia: number;
  /** Monto según base legal de 2027, 2028 y 2029, en ese orden. */
  montos: number[];
  tipoDocumento: string;
  marcoLegal: string;
  descripcion: string;
  sePresupuesta: 'SI' | 'NO';
  /** Genéricas de gasto con su monto con asignación específica («Agregar genérica de gasto», Figma node 7202:123276). */
  genericas?: GenericaGastoSecuencia[];
}

/** Una genérica de gasto de una secuencia, con su monto de 2027, 2028 y 2029 (en ese orden). */
export interface GenericaGastoSecuencia {
  codigo: string;
  nombre: string;
  montos: number[];
}

/** Genéricas de gasto del clasificador presupuestario (datos de demo para la tabla del panel). */
export const GENERICAS_GASTO: readonly Pick<GenericaGastoSecuencia, 'codigo' | 'nombre'>[] = [
  { codigo: '1', nombre: 'PERSONAL Y OBLIGACIONES SOCIALES' },
  { codigo: '2', nombre: 'PENSIONES Y OTRAS PRESTACIONES SOCIALES' },
  { codigo: '3', nombre: 'BIENES Y SERVICIOS' },
  { codigo: '4', nombre: 'DONACIONES Y TRANSFERENCIAS' },
  { codigo: '5', nombre: 'OTROS GASTOS' },
];

/** Opciones de «Tipo documento marco legal» (datos de demo: el Figma no trae el catálogo). */
export const TIPOS_DOCUMENTO_MARCO_LEGAL = [
  '01 Resolución Directoral', '02 Resolución Ministerial', '03 Decreto Supremo', '04 Decreto Legislativo', '05 Ley', '06 Ordenanza',
] as const;

export interface ArchivoSustentoEstimacion {
  name: string;
  size?: number;
}

/** Nombre de cada fuente de financiamiento para «Total por FF» (Figma node 8308:460985). */
export const NOMBRES_FUENTE_FINANCIAMIENTO: Readonly<Record<string, string>> = {
  '2.09': 'Recursos Directamente Recaudados',
  '4.13': 'Donaciones y Transferencias',
};

/** Meses de «Distribución mensual 2027», en orden. */
export const MESES_ESTIMACION_INGRESOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

/** Variación (e) y (f) de una fila: e = b − a, f = (e / a) x 100 con un decimal. */
export function calcularVariacionEstimacion(promedioAnual: number, anio2027: number): Pick<ClasificadorEstimacionIngresos, 'variacionMonto' | 'variacionPorcentaje'> {
  const variacionMonto = anio2027 - promedioAnual;
  return {
    variacionMonto,
    variacionPorcentaje: promedioAnual ? Number(((variacionMonto / promedioAnual) * 100).toFixed(1)) : 0,
  };
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
