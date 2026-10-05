/**
 * Proceso «Registro de saldos iniciales en libro banco y libreta de cuentas de registro».
 *
 * Una solicitud (documento SIL) propone el saldo inicial de UNA cuenta bancaria de la entidad, tal como figura en
 * el libro banco y en la libreta de cuentas de registro. El creador la graba y la verifica; el aprobador la aprueba,
 * la observa o la rechaza. Al aprobarse, el saldo pasa a los registros (pestaña Registros) y a la consulta.
 */

export type Moneda = 'PEN' | 'USD';
export type EstadoRegistro = 'Activo' | 'Inactivo';

export interface OpcionCatalogo {
  value: string;
  label: string;
}

export const BANCOS: OpcionCatalogo[] = [
  { value: '018', label: 'Banco de la Nación' },
  { value: '002', label: 'Banco de Crédito del Perú' },
  { value: '003', label: 'Interbank' },
  { value: '011', label: 'BBVA Perú' },
  { value: '009', label: 'Scotiabank Perú' },
];

export const MONEDAS: OpcionCatalogo[] = [
  { value: 'PEN', label: 'Soles' },
  { value: 'USD', label: 'Dólares' },
];

/** Código del documento en el catálogo de documentos. */
export const CODIGO_DOCUMENTO = 'SIL';
export const NOMBRE_DOCUMENTO = 'Documentos de Saldos iniciales';

/** Lo que el creador llena en la solicitud. */
export interface SaldoInicialDatos {
  bancoCodigo: string;
  moneda: Moneda;
  /** Número de la cuenta bancaria en el libro banco. Solo dígitos, de 10 a 20. */
  numeroCuenta: string;
  /** Número de la libreta de la cuenta de registro. Solo dígitos. */
  numeroLibreta: string;
  /** Importe del saldo inicial. */
  saldoInicial: number;
  /** Fecha de corte del saldo (yyyy-mm-dd). */
  fechaSaldo: string;
}

/** Un saldo inicial aprobado: la pestaña Registros y la consulta. */
export interface SaldoInicialRegistro extends SaldoInicialDatos {
  id: string;
  /** Código correlativo del registro (SIL-0001). */
  codigo: string;
  estado: EstadoRegistro;
  entidadSiglas: string;
  /** Solicitud que lo creó. */
  documentoId: string;
  numeroDocumento: string;
  /** Fecha de aprobación (ISO). */
  fechaRegistro: string;
}

export function nombreBanco(codigo: string): string {
  return BANCOS.find((b) => b.value === codigo)?.label ?? codigo;
}

export function nombreMoneda(codigo: string): string {
  return MONEDAS.find((m) => m.value === codigo)?.label ?? codigo;
}
