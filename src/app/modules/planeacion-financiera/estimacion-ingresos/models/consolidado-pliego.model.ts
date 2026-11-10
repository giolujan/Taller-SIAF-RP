/**
 * «Documentos de consolidado pliego de estimación de ingresos» (Planeación financiera > Flujos de caja proyectados >
 * Estimación de ingresos). El pliego consolida las solicitudes de estimación de ingresos de sus unidades ejecutoras
 * cuando todas están validadas (Figma CEL-005.01.01.01.01, node 4938:92579).
 */
import { EstadoEstimacionIngresos } from './estimacion-ingresos.model';

/** Un documento de la bandeja del consolidado pliego. */
export interface ConsolidadoPliegoRegistro {
  id: string;
  documento: string;
  numero: string;
  tipoAccion: string;
  estado: EstadoEstimacionIngresos;
  sistema: string;
  /** Fecha de registro (ISO). */
  fecha: string;
  entidad: string;
  /** Quién grabó y, si corresponde, quién verificó (las sembradas no lo traen: se muestra el creador demo). */
  elaboradoPor?: string;
  verificadoPor?: string;
  fechaVerificado?: string;
  /** Aprobador: se completan al aprobar u observar (en este producto no hay Rechazar). */
  aprobadoPor?: string;
  fechaAprobado?: string;
  observadoPor?: string;
  fechaObservado?: string;
  motivoObservacion?: string;
}

/** Consolidado ya grabado (Figma node 7606:466323): cabecera, relación de pliegos y trazabilidad. */
export interface DetalleConsolidadoPliego {
  documentoId: string;
  numero: string;
  estado: ConsolidadoPliegoRegistro['estado'];
  tipoAccion: string;
  fecha: string;
  enteRector: string;
  /** Pliego del consolidado (ej. «PRESIDENCIA DEL CONSEJO DE MINISTROS»). */
  entidad: string;
  /** Relación agrupada por fuente de financiamiento (Figma node 7606:466323). */
  pliegos: NodoConsolidadoPliego[];
  /** Agrupada por clasificador de ingresos (Figma node 8349:509061). */
  pliegosPorClasificador: NodoConsolidadoPliego[];
  /** Agrupada por entidad (Figma node 8349:491365). */
  pliegosPorEntidad: NodoConsolidadoPliego[];
  elaboradoPor: string;
  fechaElaborado: string;
  verificadoPor?: string;
  fechaVerificado?: string;
  aprobadoPor?: string;
  fechaAprobado?: string;
  observadoPor?: string;
  fechaObservado?: string;
  motivoObservacion?: string;
}

/** Bandeja del consolidado pliego: sus documentos y cuántas unidades ejecutoras ya validaron su solicitud. */
export interface BandejaConsolidadoPliego {
  documentos: ConsolidadoPliegoRegistro[];
  /** Unidades ejecutoras del pliego con su solicitud de estimación de ingresos validada. */
  unidadesValidadas: number;
  /** Total de unidades ejecutoras del pliego. */
  unidadesTotal: number;
}

/**
 * Un nodo de «Relación de pliegos consolidados» (Figma node 7606:466337): fuente de financiamiento › rubro › pliego
 * › unidad ejecutora › clasificador de ingresos. Los montos (a), (b) y (c) vienen del backend; la variación se
 * calcula en la pantalla (e = b − a, f = e / a × 100).
 */
export interface NodoConsolidadoPliego {
  id: string;
  /** Texto de la fila, ej. «2 Recursos Directamente Recaudados» o «3.1.5.1 Venta de Publicaciones». */
  etiqueta: string;
  /** Recaudación histórica, promedio anual (a). */
  promedioAnual: number;
  /** Recaudación estimada (b), (c) y (d). */
  anio2027: number;
  anio2028: number;
  anio2029: number;
  /** Participación en el pliego (%), con dos decimales. */
  participacion: number;
  /** ¿Base legal de uso específico? Solo los clasificadores la traen. */
  baseLegal?: 'SI' | 'NO';
  /** Clasificadores que se pueden elegir para el consolidado (solo los registros de una unidad ejecutora). */
  seleccionable?: boolean;
  /** Fila de un clasificador de ingresos (lleva el menú ⋮ de detalles), aunque se despliegue en otra agrupación. */
  clasificador?: boolean;
  /** Fila final que nunca se despliega (sin flecha), ej. las unidades ejecutoras en «Clasif. Ing.». */
  hoja?: boolean;
  /** Sin `hijos`, la fila no se despliega (en la demo solo trae detalle la «003 Secretaría General - PCM»). */
  hijos?: NodoConsolidadoPliego[];
}

/** Lo que muestra un consolidado «Nuevo» antes de Grabar: cabecera y relación de pliegos. */
export interface PrecargaConsolidadoPliego {
  fecha: string;
  enteRector: string;
  entidad: string;
  unidadEjecutora: string;
  pliegos: NodoConsolidadoPliego[];
}

/** Grabar un consolidado «Nuevo»: los clasificadores elegidos (ids de nodo). */
export interface CrearConsolidadoPliegoPayload {
  registros: string[];
}
