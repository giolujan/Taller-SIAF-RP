/**
 * Proceso «Ingresos tributarios SUNAT».
 *
 * A diferencia de «Registro de cuentas bancarias» y «Documentos de Saldos iniciales», estos documentos no los crea
 * un usuario: los genera automáticamente el motor de integración con SUNAT (notas de débito, reportes de
 * recaudación…). Por eso la bandeja es de solo consulta (`modoConsulta` en `DocumentsRecordsConfig`): sin «Crear
 * documento» ni Verificar/Aprobar. Dos documentos de ejemplo (`itb-3`, `itb-4`) además avanzan solos de estado
 * cada 10 s (Registrado → Pendiente → Procesado) para mostrar cómo luce la bandeja mientras el motor trabaja.
 */

export type EstadoIngresoTributario = 'Registrado' | 'Pendiente' | 'Procesado';

export interface IngresoTributarioRegistro {
  id: string;
  /** Nombre del documento generado (ej. «Solicitud automática de Nota de débito»). */
  documento: string;
  numero: string;
  tipoAccion: string;
  estado: EstadoIngresoTributario;
  /** Fecha de registro (ISO). */
  fecha: string;
  entidad: string;
}

/** Pestaña secundaria de la tab Registros: cada una pinta su propia tabla. */
export type TipoRegistroIngresoTributario = 'reporte-recaudacion' | 'nota-debito';

/**
 * Un registro de la tab Registros (Reporte de recaudación o Nota de débito): a diferencia de `IngresoTributarioRegistro`
 * (la tab Documentos), no referencia una solicitud — es la fila ya consolidada por el motor de integración.
 */
export interface RegistroIngresoTributario {
  id: string;
  tipo: TipoRegistroIngresoTributario;
  nro: number;
  /** Número del reporte de recaudación o de la nota de débito, según `tipo`. */
  numeroOrigen: string;
  entidadFinanciera: string;
  moneda: string;
  montoTotal: string;
  estado: 'Activo' | 'Inactivo';
  /** Documento (solicitud automática) que originó el registro. */
  documentoNumero: string;
  documentoNombre: string;
}

/** Una fila de la tabla clave-valor del detalle de un documento (CAMPO / DESCRIPCIÓN / VALOR del Figma). */
export interface CampoDetalleDocumento {
  campo: string;
  descripcion: string;
  valor: string;
}

/**
 * Detalle de un documento de Ingresos tributarios SUNAT: la pantalla a la que lleva su fila en la tab Documentos.
 * Sin formulario ni acciones (Grabar, Verificar…): es de solo lectura, generado por el motor de integración.
 *
 * Mientras el documento no está `Procesado`, la tabla de `campos` trae menos filas (solo lo crudo, sin los nombres
 * que resuelve el motor al terminar) y la trazabilidad trae un único ítem. Ese único ítem usa la etiqueta
 * `accionLabel` si viene (ej. «Acción por» en la Nota de débito recién Registrada) o «Registrado por» si no.
 */
export interface DetalleDocumentoIngresoTributario {
  documentoId: string;
  documento: string;
  numero: string;
  fecha: string;
  enteRector: string;
  estado: EstadoIngresoTributario;
  campos: CampoDetalleDocumento[];
  accionLabel?: string;
  registradoPor: string;
  fechaRegistrado: string;
  procesadoPor?: string;
  fechaProcesado?: string;
}
