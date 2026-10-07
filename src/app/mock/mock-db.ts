import type { NotificacionResponse } from '../core/api/notificaciones-api.service';
import type { HistorialItem, SolicitudResponse } from '../core/api/solicitudes-api.service';
import type { EstadoDocumento } from '../core/models/documento.model';
import {
  CODIGO_DOCUMENTO,
  CuentaBancariaDatos,
  CuentaBancariaRegistro,
  NOMBRE_DOCUMENTO,
} from '../modules/tesoreria/cuentas-bancarias/models/cuenta-bancaria.model';
import {
  CODIGO_DOCUMENTO as CODIGO_DOCUMENTO_SIL,
  NOMBRE_DOCUMENTO as NOMBRE_DOCUMENTO_SIL,
  SaldoInicialDatos,
  SaldoInicialRegistro,
} from '../modules/tesoreria/saldos-iniciales/models/saldo-inicial.model';
import {
  CampoDetalleDocumento,
  DetalleDocumentoIngresoTributario,
  EstadoIngresoTributario,
  IngresoTributarioRegistro,
  RegistroIngresoTributario,
} from '../modules/tesoreria/ingresos-tributarios-sunat/models/ingreso-tributario.model';
import { USUARIOS_DEMO, UsuarioDemo } from './usuarios-demo';

/**
 * «Base de datos» del backend simulado: vive en el `localStorage` del navegador, así lo que hace un usuario lo ve
 * otro al iniciar sesión (en el mismo navegador). `reiniciarDatosDemo()` vuelve a los datos iniciales.
 */

const CLAVE = 'taller-siaf-rp:datos';
const VERSION = 5;

export interface NotificacionMock extends NotificacionResponse {
  /** Destinatario: un usuario puntual o, si no hay, todos los perfiles con este rol. */
  paraUsuarioId?: string;
  paraRolCodigo?: 'CREADOR' | 'APROBADOR';
}

export interface DatosTaller {
  version: number;
  solicitudes: SolicitudResponse[];
  registros: CuentaBancariaRegistro[];
  registrosSaldos: SaldoInicialRegistro[];
  ingresosTributarios: IngresoTributarioRegistro[];
  registrosIngresosTributarios: RegistroIngresoTributario[];
  /** Instante (ISO) en que arrancó la simulación en vivo de Ingresos tributarios SUNAT — ver más abajo. */
  demoIngresosTributariosInicio: string;
  notificaciones: NotificacionMock[];
  correlativoDocumento: number;
  correlativoDocumentoSaldos: number;
  correlativoRegistro: number;
  correlativoRegistroSaldos: number;
  secuencia: number;
}

export const TIPO_DOCUMENTO = { id: 'td-srcb', codigo: CODIGO_DOCUMENTO, nombre: NOMBRE_DOCUMENTO };
export const TIPO_DOCUMENTO_SIL = { id: 'td-sil', codigo: CODIGO_DOCUMENTO_SIL, nombre: NOMBRE_DOCUMENTO_SIL };
export const TIPOS_DOCUMENTO = [TIPO_DOCUMENTO, TIPO_DOCUMENTO_SIL];
export const ENTIDAD_CREADORA = { id: 'ent-mef', codMef: '0001', siglas: 'MEF', nombre: 'Ministerio de Economía y Finanzas' };
export const UNIDAD_CREADORA = { id: 'uo-oga', sigla: 'OGA', nombre: 'Oficina General de Administración' };

export function leerDatos(): DatosTaller {
  try {
    const guardados = localStorage.getItem(CLAVE);
    if (guardados) {
      const datos = JSON.parse(guardados) as DatosTaller;
      if (datos.version === VERSION) return datos;
    }
  } catch {
    // Datos corruptos o sin acceso al almacenamiento: se empieza de nuevo.
  }
  const iniciales = crearDatosIniciales();
  guardarDatos(iniciales);
  return iniciales;
}

export function guardarDatos(datos: DatosTaller): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    // Sin almacenamiento (modo privado estricto): los cambios duran lo que dure la pestaña.
  }
}

/** Vuelve a los datos iniciales de la demo. */
export function reiniciarDatosDemo(): void {
  guardarDatos(crearDatosIniciales());
}

export function nuevoId(datos: DatosTaller, prefijo: string): string {
  datos.secuencia += 1;
  return `${prefijo}-${datos.secuencia}`;
}

export function numeroDocumento(correlativo: number, fecha: Date, codigo: string = CODIGO_DOCUMENTO): string {
  return `PCB-${codigo}-${String(correlativo).padStart(5, '0')}-${fecha.getFullYear()}-MEF-OGA`;
}

export function filaHistorial(
  datos: DatosTaller,
  anterior: EstadoDocumento | null,
  nuevo: EstadoDocumento,
  fecha: string,
  usuario: UsuarioDemo,
  rol: { codigo: string; nombre: string },
  comentario: string | null = null,
): HistorialItem {
  return {
    id: nuevoId(datos, 'hist'),
    estadoAnterior: anterior,
    estadoNuevo: nuevo,
    comentario,
    createdAt: fecha,
    creador: { nombres: usuario.nombres, apellidoPaterno: usuario.apellidoPaterno, apellidoMaterno: usuario.apellidoMaterno },
    perfil: { cfgPerfil: { rol } },
  };
}

// ─── Datos iniciales ───────────────────────────────────────────────

const ROL_CREADOR = { codigo: 'CREADOR', nombre: 'Creador' };
const ROL_APROBADOR = { codigo: 'APROBADOR', nombre: 'Aprobador' };

interface Semilla {
  datos: CuentaBancariaDatos;
  /** Día en que se creó la solicitud (yyyy-mm-dd). */
  creada: string;
  estado: 'ELABORADO' | 'VERIFICADO' | 'APROBADO' | 'OBSERVADO' | 'RECHAZADO';
  justificacion: string;
  comentario?: string;
  registroInactivo?: boolean;
}

function cuenta(banco: string, tipo: 'CORRIENTE' | 'AHORROS', moneda: 'PEN' | 'USD', n: number, denominacion: string, apertura: string, recaudadora: boolean): CuentaBancariaDatos {
  return {
    bancoCodigo: banco,
    tipoCuenta: tipo,
    moneda,
    numeroCuenta: `${banco}100${String(58213400000000 + n * 7919).slice(-14)}`,
    denominacion,
    fechaApertura: apertura,
    esRecaudadora: recaudadora,
  };
}

const SEMILLAS: Semilla[] = [
  { creada: '2026-01-16', estado: 'APROBADO', justificacion: 'Cuenta para la recaudación de tasas por procedimientos administrativos.', datos: cuenta('018', 'CORRIENTE', 'PEN', 1, 'Recaudación de tasas administrativas', '2026-01-15', true) },
  { creada: '2026-02-04', estado: 'APROBADO', justificacion: 'Cuenta para pagos a proveedores del exterior en dólares.', datos: cuenta('002', 'CORRIENTE', 'USD', 2, 'Pagos a proveedores del exterior', '2026-02-03', false) },
  { creada: '2026-02-23', estado: 'APROBADO', justificacion: 'Cuenta de ahorros para el fondo de caja chica de la oficina.', datos: cuenta('003', 'AHORROS', 'PEN', 3, 'Fondo de caja chica', '2026-02-20', false) },
  { creada: '2026-03-12', estado: 'APROBADO', justificacion: 'Cuenta para la recaudación de multas administrativas.', datos: cuenta('011', 'CORRIENTE', 'PEN', 4, 'Recaudación de multas', '2026-03-11', true) },
  { creada: '2026-04-09', estado: 'APROBADO', justificacion: 'Cuenta para las transferencias a unidades ejecutoras.', datos: cuenta('018', 'CORRIENTE', 'PEN', 5, 'Transferencias a unidades ejecutoras', '2026-04-08', false) },
  { creada: '2026-05-20', estado: 'APROBADO', justificacion: 'Cuenta para garantías recibidas en moneda extranjera.', datos: cuenta('009', 'AHORROS', 'USD', 6, 'Garantías en moneda extranjera', '2026-05-19', false), registroInactivo: true },
  { creada: '2026-06-03', estado: 'APROBADO', justificacion: 'Cuenta para la recaudación de servicios no exclusivos.', datos: cuenta('018', 'CORRIENTE', 'PEN', 7, 'Recaudación de servicios no exclusivos', '2026-06-02', true) },
  { creada: '2026-07-15', estado: 'APROBADO', justificacion: 'Cuenta de ahorros para encargos a las oficinas desconcentradas.', datos: cuenta('002', 'AHORROS', 'PEN', 8, 'Encargos a oficinas desconcentradas', '2026-07-14', false) },
  { creada: '2026-08-06', estado: 'RECHAZADO', justificacion: 'Cuenta para la recaudación de derechos de trámite.', datos: cuenta('009', 'CORRIENTE', 'PEN', 9, 'Recaudación de derechos de trámite', '2026-08-05', true), comentario: '[Información incorrecta] La cuenta ya está registrada con el código CB-0004.' },
  { creada: '2026-08-24', estado: 'VERIFICADO', justificacion: 'Cuenta en dólares para los fondos de cooperación internacional.', datos: cuenta('003', 'CORRIENTE', 'USD', 10, 'Fondos de cooperación internacional', '2026-08-21', false) },
  { creada: '2026-09-02', estado: 'OBSERVADO', justificacion: 'Cuenta para la recaudación por alquiler de ambientes.', datos: cuenta('011', 'CORRIENTE', 'PEN', 11, 'Recaudación de alquileres', '2026-09-01', true), comentario: 'Adjunte la constancia de apertura emitida por el banco.' },
  { creada: '2026-09-09', estado: 'ELABORADO', justificacion: 'Cuenta de ahorros para el fondo de viáticos.', datos: cuenta('018', 'AHORROS', 'PEN', 12, 'Fondo de viáticos', '2026-09-08', false) },
];

interface SemillaSaldo {
  datos: SaldoInicialDatos;
  /** Día en que se creó la solicitud (yyyy-mm-dd). */
  creada: string;
  estado: 'ELABORADO' | 'VERIFICADO' | 'APROBADO' | 'OBSERVADO' | 'RECHAZADO';
  justificacion: string;
  comentario?: string;
  registroInactivo?: boolean;
}

function saldo(banco: string, moneda: 'PEN' | 'USD', n: number, libreta: string, importe: number, fechaSaldo: string): SaldoInicialDatos {
  return {
    bancoCodigo: banco,
    moneda,
    numeroCuenta: `${banco}100${String(58213400000000 + n * 7919).slice(-14)}`,
    numeroLibreta: libreta,
    saldoInicial: importe,
    fechaSaldo,
  };
}

const SEMILLAS_SALDOS: SemillaSaldo[] = [
  { creada: '2026-01-20', estado: 'APROBADO', justificacion: 'Saldo inicial del libro banco de la cuenta de recaudación de tasas.', datos: saldo('018', 'PEN', 1, 'LB-000123', 45230.5, '2026-01-01') },
  { creada: '2026-03-05', estado: 'APROBADO', justificacion: 'Saldo inicial del libro banco de la cuenta de pagos a proveedores del exterior.', datos: saldo('002', 'USD', 2, 'LB-000456', 12800, '2026-01-01') },
  { creada: '2026-05-10', estado: 'APROBADO', justificacion: 'Saldo inicial del libro banco del fondo de caja chica.', datos: saldo('003', 'PEN', 3, 'LB-000789', 3500, '2026-01-01'), registroInactivo: true },
  { creada: '2026-07-02', estado: 'RECHAZADO', justificacion: 'Saldo inicial del libro banco de la cuenta de multas administrativas.', datos: saldo('011', 'PEN', 4, 'LB-000321', 9820.25, '2026-01-01'), comentario: '[Información incorrecta] El saldo no coincide con el estado de cuenta del banco.' },
  { creada: '2026-08-18', estado: 'VERIFICADO', justificacion: 'Saldo inicial del libro banco de los fondos de cooperación internacional.', datos: saldo('009', 'USD', 5, 'LB-000654', 21000, '2026-01-01') },
  { creada: '2026-09-05', estado: 'ELABORADO', justificacion: 'Saldo inicial del libro banco del fondo de viáticos.', datos: saldo('018', 'PEN', 6, 'LB-000987', 6100.75, '2026-01-01') },
];

function enFecha(dia: string, horas: number, dias = 0): string {
  const fecha = new Date(`${dia}T00:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(horas, 15 + dias * 7, 0, 0);
  return fecha.toISOString();
}

/**
 * Semilla de «Ingresos tributarios SUNAT»: documentos generados por el motor de integración, no por un creador.
 * `id` se completa en `crearDatosIniciales()`.
 */
const INGRESOS_TRIBUTARIOS_SEMILLA: Omit<IngresoTributarioRegistro, 'id'>[] = [
  {
    documento: 'Solicitud automática de Nota de débito',
    numero: '987654-2026',
    tipoAccion: 'Creación',
    estado: 'Procesado',
    fecha: '2026-11-09T15:06:30',
    entidad: '009 - Ministerio de Economia y Finanzas',
  },
  {
    documento: 'Solicitud automática de Reporte de recaudación',
    numero: '123456-2026',
    tipoAccion: 'Creación',
    estado: 'Procesado',
    fecha: '2026-11-09T15:06:27',
    entidad: '009 - Ministerio de Economia y Finanzas',
  },
];

/**
 * Detalle clave-valor de «Solicitud automática de Nota de débito» (documento `itb-1`, primero de
 * `INGRESOS_TRIBUTARIOS_SEMILLA`): la pantalla a la que lleva su fila en la tab Documentos. Calcado del Figma
 * node-id=1476-39617. Los demás documentos todavía no tienen esta pantalla diseñada.
 */
const DETALLE_NOTA_DEBITO: DetalleDocumentoIngresoTributario = {
  documentoId: 'itb-1',
  documento: 'Solicitud automática de Nota de débito',
  numero: '987654-2026',
  fecha: '09/11/2026     15:06:30',
  enteRector: 'DIRECCIÓN GENERAL DEL TESORO PÚBLICO',
  estado: 'Procesado',
  campos: [
    { campo: '001', descripcion: 'Número de Reporte de Recaudación', valor: '02698147' },
    { campo: '002', descripcion: 'Fecha de emisión de la Nota de Débito', valor: '09/11/2026 15:06:30' },
    { campo: '003', descripcion: 'Código de la Entidad Financiera', valor: '02' },
    { campo: '004', descripcion: 'Nombre de la Entidad Financiera', valor: 'BANCO DE CRÉDITO DEL PERÚ' },
    { campo: '005', descripcion: 'Monto total', valor: '35.50' },
    { campo: '006', descripcion: 'Moneda', valor: 'PEN' },
    { campo: '007', descripcion: 'Cuenta bancaria', valor: '000698456321' },
    { campo: '008', descripcion: 'Cargo / Propietario', valor: 'SUNAT' },
    { campo: '009', descripcion: 'Cargo / Nro de cuenta bancaria', valor: '000698456321' },
    { campo: '010', descripcion: 'Abono / Propietario', valor: 'BANCO DE CRÉDITO DEL PERÚ' },
    { campo: '011', descripcion: 'Abono / Nro de cuenta bancaria', valor: '0033-429384-0-12' },
    { campo: '012', descripcion: 'Concepto / Código', valor: '418' },
    { campo: '013', descripcion: 'Concepto / Importe', valor: '35.50' },
    { campo: '014', descripcion: 'Gastos bancarios / Código', valor: '418' },
    { campo: '015', descripcion: 'Gastos bancarios / Concepto', valor: 'Gastos bancarios' },
    { campo: '016', descripcion: 'Gastos bancarios / Importe', valor: '35.50' },
  ],
  registradoPor: 'SIAF RP',
  fechaRegistrado: '09/11/2026     15:06:30',
  procesadoPor: 'SIAF RP',
  fechaProcesado: '09/11/2026     15:06:39',
};

/**
 * Detalle clave-valor de «Solicitud automática de Reporte de recaudación» (documento `itb-2`, segundo de
 * `INGRESOS_TRIBUTARIOS_SEMILLA`). Calcado del Figma node-id=1481-43880: el reporte reparte la recaudación entre
 * 4 beneficiarios, cada uno con sus tipos de tributo y clasificadores de ingreso.
 */
const DETALLE_REPORTE_RECAUDACION: DetalleDocumentoIngresoTributario = {
  documentoId: 'itb-2',
  documento: 'Solicitud automática de Reporte de recaudación',
  numero: '123456-2026',
  fecha: '09/11/2026     15:06:27',
  enteRector: 'DIRECCIÓN GENERAL DEL TESORO PÚBLICO',
  estado: 'Procesado',
  campos: [
    { campo: '001', descripcion: 'Número del Reporte de recaudación', valor: '02698147' },
    { campo: '002', descripcion: 'Fecha de emisión del Reporte de recaudación', valor: '09/11/2026 11:00:56' },
    { campo: '003', descripcion: 'Código de la Entidad financiera', valor: '002' },
    { campo: '004', descripcion: 'Entidad financiera', valor: 'BANCO DE CRÉDITO DEL PERÚ' },
    { campo: '005', descripcion: 'Monto total', valor: '4,077.54' },
    { campo: '006', descripcion: 'Moneda', valor: 'PEN' },
    { campo: '007', descripcion: 'Cuenta bancaria (CUT)', valor: '000392930212' },
    { campo: '008', descripcion: 'RUC de la Entidad administradora del ingreso', valor: '20345678901' },
    { campo: '009', descripcion: 'ID CAT CLAS Y CAT', valor: 'Clasificador Institucional' },
    { campo: '010', descripcion: 'Código clasificador', valor: '1.1.1.1.1001.000' },
    { campo: '011', descripcion: 'Nombre de la Entidad administradora del ingreso', valor: 'SUNAT' },
    { campo: '012', descripcion: 'Beneficiario 1 / Código ente', valor: '0001' },
    { campo: '013', descripcion: 'Beneficiario 1 / Código', valor: '000001' },
    { campo: '014', descripcion: 'Beneficiario 1 / Descripción', valor: 'TESORO PÚBLICO' },
    { campo: '015', descripcion: 'Beneficiario 1 / Cuenta de registro', valor: '11223344556677889901' },
    { campo: '016', descripcion: 'Beneficiario 1 / Monto total', valor: '3,838.59' },
    { campo: '017', descripcion: 'Beneficiario 1 / Tipo de tributo 1 / Código', valor: '11.22.33.44' },
    { campo: '018', descripcion: 'Beneficiario 1 / Tipo de tributo 1 / Monto', valor: '800.00' },
    { campo: '019', descripcion: 'Beneficiario 1 / Clasificador de ingreso 1 / Código', valor: '11.22.33.44' },
    { campo: '020', descripcion: 'Beneficiario 1 / Clasificador de ingreso 1 / Nombre', valor: 'Impuesto a la Renta – 1era Categoría' },
    { campo: '021', descripcion: 'Beneficiario 1 / Clasificador de ingreso 1 / Monto', valor: '800.00' },
    { campo: '022', descripcion: 'Beneficiario 1 / Tipo de tributo 2 / Código', valor: '11.22.33.33' },
    { campo: '023', descripcion: 'Beneficiario 1 / Tipo de tributo 2 / Monto', valor: '1500.00' },
    { campo: '024', descripcion: 'Beneficiario 1 / Clasificador de ingreso 2 / Código', valor: '11.22.33.33' },
    { campo: '025', descripcion: 'Beneficiario 1 / Clasificador de ingreso 2 / Nombre', valor: 'Impuesto a la Renta – 5ta Categoría' },
    { campo: '026', descripcion: 'Beneficiario 1 / Clasificador de ingreso 2 / Monto', valor: '1500.00' },
    { campo: '027', descripcion: 'Beneficiario 1 / Tipo de tributo 3 / Código', valor: '11.22.33.66' },
    { campo: '028', descripcion: 'Beneficiario 1 / Tipo de tributo 3 / Monto', valor: '1500.00' },
    { campo: '029', descripcion: 'Beneficiario 1 / Clasificador de ingreso 3 / Código', valor: '11.22.33.66' },
    { campo: '030', descripcion: 'Beneficiario 1 / Clasificador de ingreso 3 / Nombre', valor: 'Impuesto General a las Ventas' },
    { campo: '031', descripcion: 'Beneficiario 1 / Clasificador de ingreso 3 / Monto', valor: '1500.00' },
    { campo: '032', descripcion: 'Beneficiario 1 / Tipo de tributo 4 / Código', valor: '11.22.33.22' },
    { campo: '033', descripcion: 'Beneficiario 1 / Tipo de tributo 4 / Monto', valor: '38.59' },
    { campo: '034', descripcion: 'Beneficiario 1 / Clasificador de ingreso 4 / Código', valor: '11.22.33.22' },
    { campo: '035', descripcion: 'Beneficiario 1 / Clasificador de ingreso 4 / Nombre', valor: 'Impuesto a las Embarcaciones' },
    { campo: '036', descripcion: 'Beneficiario 1 / Clasificador de ingreso 4 / Monto', valor: '38.59' },
    { campo: '037', descripcion: 'Beneficiario 2 / Código ente', valor: '0002' },
    { campo: '038', descripcion: 'Beneficiario 2 / Código', valor: '000002' },
    { campo: '039', descripcion: 'Beneficiario 2 / Descripción', valor: 'TRIBUNAL FISCAL' },
    { campo: '040', descripcion: 'Beneficiario 2 / Cuenta de registro', valor: '11223344556677889902' },
    { campo: '041', descripcion: 'Beneficiario 2 / Monto total', valor: '1.44' },
    { campo: '042', descripcion: 'Beneficiario 2 / Tipo de tributo 1 / Código', valor: '11.22.33.44' },
    { campo: '043', descripcion: 'Beneficiario 2 / Tipo de tributo 1 / Monto', valor: '0.40' },
    { campo: '044', descripcion: 'Beneficiario 2 / Clasificador de ingreso 1 / Código', valor: '11.22.33.44' },
    { campo: '045', descripcion: 'Beneficiario 2 / Clasificador de ingreso 1 / Nombre', valor: 'Impuesto a la Renta – 1era Categoría' },
    { campo: '046', descripcion: 'Beneficiario 2 / Clasificador de ingreso 1 / Monto', valor: '0.40' },
    { campo: '047', descripcion: 'Beneficiario 2 / Tipo de tributo 2 / Código', valor: '11.22.33.33' },
    { campo: '048', descripcion: 'Beneficiario 2 / Tipo de tributo 2 / Monto', valor: '0.50' },
    { campo: '049', descripcion: 'Beneficiario 2 / Clasificador de ingreso 2 / Código', valor: '11.22.33.33' },
    { campo: '050', descripcion: 'Beneficiario 2 / Clasificador de ingreso 2 / Nombre', valor: 'Impuesto a la Renta – 5ta Categoría' },
    { campo: '051', descripcion: 'Beneficiario 2 / Clasificador de ingreso 2 / Monto', valor: '0.50' },
    { campo: '052', descripcion: 'Beneficiario 2 / Tipo de tributo 3 / Código', valor: '11.22.33.66' },
    { campo: '053', descripcion: 'Beneficiario 2 / Tipo de tributo 3 / Monto', valor: '0.50' },
    { campo: '054', descripcion: 'Beneficiario 2 / Clasificador de ingreso 3 / Código', valor: '11.22.33.66' },
    { campo: '055', descripcion: 'Beneficiario 2 / Clasificador de ingreso 3 / Nombre', valor: 'Impuesto General a las Ventas' },
    { campo: '056', descripcion: 'Beneficiario 2 / Clasificador de ingreso 3 / Monto', valor: '0.50' },
    { campo: '057', descripcion: 'Beneficiario 2 / Tipo de tributo 4 / Código', valor: '11.22.33.22' },
    { campo: '058', descripcion: 'Beneficiario 2 / Tipo de tributo 4 / Monto', valor: '0.04' },
    { campo: '059', descripcion: 'Beneficiario 2 / Clasificador de ingreso 4 / Código', valor: '11.22.33.22' },
    { campo: '060', descripcion: 'Beneficiario 2 / Clasificador de ingreso 4 / Nombre', valor: 'Impuesto a las Embarcaciones' },
    { campo: '061', descripcion: 'Beneficiario 2 / Clasificador de ingreso 4 / Monto', valor: '0.04' },
    { campo: '062', descripcion: 'Beneficiario 3 / Código ente', valor: '0003' },
    { campo: '063', descripcion: 'Beneficiario 3 / Código', valor: '000003' },
    { campo: '064', descripcion: 'Beneficiario 3 / Descripción', valor: 'SUNAT - INGRESOS PROPIOS' },
    { campo: '065', descripcion: 'Beneficiario 3 / Cuenta de registro', valor: '11223344556677889903' },
    { campo: '066', descripcion: 'Beneficiario 3 / Monto total', valor: '108.77' },
    { campo: '067', descripcion: 'Beneficiario 3 / Tipo de tributo 1 / Código', valor: '11.22.33.55' },
    { campo: '068', descripcion: 'Beneficiario 3 / Tipo de tributo 1 / Monto', valor: '108.77' },
    { campo: '069', descripcion: 'Beneficiario 3 / Clasificador de ingreso 1 / Código', valor: '11.22.33.55' },
    { campo: '070', descripcion: 'Beneficiario 3 / Clasificador de ingreso 1 / Nombre', valor: 'Servicios por recaudación de servicios internos' },
    { campo: '071', descripcion: 'Beneficiario 3 / Clasificador de ingreso 1 / Monto', valor: '108.77' },
    { campo: '072', descripcion: 'Beneficiario 4 / Código ente', valor: '0004' },
    { campo: '073', descripcion: 'Beneficiario 4 / Código', valor: '000004' },
    { campo: '074', descripcion: 'Beneficiario 4 / Descripción', valor: 'FONDO DE PROMOCIÓN MUNICIPAL' },
    { campo: '075', descripcion: 'Beneficiario 4 / Cuenta de registro', valor: '11223344556677889904' },
    { campo: '076', descripcion: 'Beneficiario 4 / Monto total', valor: '128.74' },
    { campo: '077', descripcion: 'Beneficiario 4 / Tipo de tributo 1 / Código', valor: '11.22.99.11' },
    { campo: '078', descripcion: 'Beneficiario 4 / Tipo de tributo 1 / Monto', valor: '50.00' },
    { campo: '079', descripcion: 'Beneficiario 4 / Clasificador de ingreso 1 / Código', valor: '11.22.99.11' },
    { campo: '080', descripcion: 'Beneficiario 4 / Clasificador de ingreso 1 / Nombre', valor: 'Impuesto de Promoción Municipal' },
    { campo: '081', descripcion: 'Beneficiario 4 / Clasificador de ingreso 1 / Monto', valor: '50.00' },
    { campo: '082', descripcion: 'Beneficiario 4 / Tipo de tributo 2 / Código', valor: '11.22.99.22' },
    { campo: '083', descripcion: 'Beneficiario 4 / Tipo de tributo 2 / Monto', valor: '50.00' },
    { campo: '084', descripcion: 'Beneficiario 4 / Clasificador de ingreso 2 / Código', valor: '11.22.99.22' },
    { campo: '085', descripcion: 'Beneficiario 4 / Clasificador de ingreso 2 / Nombre', valor: 'Impuesto al Rodaje' },
    { campo: '086', descripcion: 'Beneficiario 4 / Clasificador de ingreso 2 / Monto', valor: '50.00' },
    { campo: '087', descripcion: 'Beneficiario 4 / Tipo de tributo 3 / Código', valor: '11.22.33.22' },
    { campo: '088', descripcion: 'Beneficiario 4 / Tipo de tributo 3 / Monto', valor: '28.74' },
    { campo: '089', descripcion: 'Beneficiario 4 / Clasificador de ingreso 3 / Código', valor: '11.22.33.22' },
    { campo: '090', descripcion: 'Beneficiario 4 / Clasificador de ingreso 3 / Nombre', valor: 'Impuesto a las Embarcaciones' },
    { campo: '091', descripcion: 'Beneficiario 4 / Clasificador de ingreso 3 / Monto', valor: '28.74' },
  ],
  registradoPor: 'SIAF RP',
  fechaRegistrado: '09/11/2026     15:06:27',
  procesadoPor: 'SIAF RP',
  fechaProcesado: '09/11/2026     15:06:39',
};

/** Detalles disponibles por id de documento (`itb-1`, `itb-2`…). */
export const DETALLES_DOCUMENTOS_INGRESOS_TRIBUTARIOS: Record<string, DetalleDocumentoIngresoTributario> = {
  'itb-1': DETALLE_NOTA_DEBITO,
  'itb-2': DETALLE_REPORTE_RECAUDACION,
};

// ─── Simulación en vivo: dos documentos nuevos que avanzan solos de estado ──
//
// Sobre los dos documentos de ejemplo de arriba (ya «Procesados», como si el taller llevara tiempo corriendo), se
// suman un Reporte de recaudación y una Nota de débito que recién entran por la bandeja y van avanzando de estado
// solos, sin que el usuario haga nada: Registrado → Pendiente → Procesado, cada paso a los 10 s. El estado se
// calcula con la hora actual contra `demoIngresosTributariosInicio` (no hay timers ni estado guardado del lado del
// backend simulado): el Reporte arranca junto con el taller; la Nota recién aparece cuando el Reporte pasa a
// Pendiente (a los 10 s). Mientras un documento no está Procesado, su tabla de campos trae menos filas (sin los
// nombres que resuelve el motor al terminar) y la trazabilidad, un único ítem. La bandeja (`IngresosTributariosSunat
// DocumentsComponent`) además vuelve a pedir estos datos cada 10 s sola, para que el avance se vea sin que haga
// falta entrar a ningún documento.

const PASO_SIMULACION_MS = 10000;
const REPORTE_VIVO_ID = 'itb-3';
const NOTA_VIVO_ID = 'itb-4';
const REPORTE_VIVO_NUMERO = '223456-2026';
const NOTA_VIVO_NUMERO = '887654-2026';

function formatoFechaDemo(fecha: Date): string {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const hh = String(fecha.getHours()).padStart(2, '0');
  const mi = String(fecha.getMinutes()).padStart(2, '0');
  const ss = String(fecha.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${fecha.getFullYear()} ${hh}:${mi}:${ss}`;
}

/** Estado de un documento vivo según cuánto pasó desde que apareció en la bandeja (`null`: todavía no aparece). */
function estadoSimulado(apareceEn: Date, ahora: Date): EstadoIngresoTributario | null {
  const transcurrido = ahora.getTime() - apareceEn.getTime();
  if (transcurrido < 0) return null;
  if (transcurrido < PASO_SIMULACION_MS) return 'Registrado';
  if (transcurrido < PASO_SIMULACION_MS * 2) return 'Pendiente';
  return 'Procesado';
}

/** Tabla reducida (sin nombres resueltos) del Reporte de recaudación: Registrado y Pendiente la usan por igual. */
function camposReporteReducido(): CampoDetalleDocumento[] {
  return [
    { campo: '001', descripcion: 'Número del Reporte de recaudación', valor: '02698147' },
    { campo: '002', descripcion: 'Fecha de emisión del Reporte de recaudación', valor: '09/11/2026 11:00:56' },
    { campo: '003', descripcion: 'Código de la Entidad financiera', valor: '002' },
    { campo: '004', descripcion: 'Monto total', valor: '4,077.54' },
    { campo: '005', descripcion: 'Moneda', valor: 'PEN' },
    { campo: '006', descripcion: 'Cuenta bancaria (CUT)', valor: '000392930212' },
    { campo: '007', descripcion: 'RUC de la Entidad administradora del ingreso', valor: '20345678901' },
    { campo: '008', descripcion: 'Beneficiario 1 / Código ente', valor: '0001' },
    { campo: '009', descripcion: 'Beneficiario 1 / Cuenta de registro', valor: '11223344556677889901' },
    { campo: '010', descripcion: 'Beneficiario 1 / Monto total', valor: '3,838.59' },
    { campo: '011', descripcion: 'Beneficiario 1 / Tipo de tributo 1 / Código', valor: '11.22.33.44' },
    { campo: '012', descripcion: 'Beneficiario 1 / Tipo de tributo 1 / Monto', valor: '800.00' },
    { campo: '013', descripcion: 'Beneficiario 1 / Tipo de tributo 2 / Código', valor: '11.22.33.33' },
    { campo: '014', descripcion: 'Beneficiario 1 / Tipo de tributo 2 / Monto', valor: '1500.00' },
    { campo: '015', descripcion: 'Beneficiario 1 / Tipo de tributo 3 / Código', valor: '11.22.33.66' },
    { campo: '016', descripcion: 'Beneficiario 1 / Tipo de tributo 3 / Monto', valor: '1500.00' },
    { campo: '017', descripcion: 'Beneficiario 1 / Tipo de tributo 4 / Código', valor: '11.22.33.22' },
    { campo: '018', descripcion: 'Beneficiario 1 / Tipo de tributo 4 / Monto', valor: '38.59' },
    { campo: '019', descripcion: 'Beneficiario 2 / Código ente', valor: '0002' },
    { campo: '020', descripcion: 'Beneficiario 2 / Cuenta de registro', valor: '11223344556677889902' },
    { campo: '021', descripcion: 'Beneficiario 2 / Monto total', valor: '1.44' },
    { campo: '022', descripcion: 'Beneficiario 2 / Tipo de tributo 1 / Código', valor: '11.22.33.44' },
    { campo: '023', descripcion: 'Beneficiario 2 / Tipo de tributo 1 / Monto', valor: '0.40' },
    { campo: '024', descripcion: 'Beneficiario 2 / Tipo de tributo 2 / Código', valor: '11.22.33.33' },
    { campo: '025', descripcion: 'Beneficiario 2 / Tipo de tributo 2 / Monto', valor: '0.50' },
    { campo: '026', descripcion: 'Beneficiario 2 / Tipo de tributo 3 / Código', valor: '11.22.33.66' },
    { campo: '027', descripcion: 'Beneficiario 2 / Tipo de tributo 3 / Monto', valor: '0.50' },
    { campo: '028', descripcion: 'Beneficiario 2 / Tipo de tributo 4 / Código', valor: '11.22.33.22' },
    { campo: '029', descripcion: 'Beneficiario 2 / Tipo de tributo 4 / Monto', valor: '0.04' },
    { campo: '030', descripcion: 'Beneficiario 3 / Código ente', valor: '0003' },
    { campo: '031', descripcion: 'Beneficiario 3 / Cuenta de registro', valor: '11223344556677889903' },
    { campo: '032', descripcion: 'Beneficiario 3 / Monto total', valor: '108.77' },
    { campo: '033', descripcion: 'Beneficiario 3 / Tipo de tributo 1 / Código', valor: '11.22.33.55' },
    { campo: '034', descripcion: 'Beneficiario 3 / Tipo de tributo 1 / Monto', valor: '108.77' },
    { campo: '035', descripcion: 'Beneficiario 4 / Código ente', valor: '0004' },
    { campo: '036', descripcion: 'Beneficiario 4 / Cuenta de registro', valor: '11223344556677889904' },
    { campo: '037', descripcion: 'Beneficiario 4 / Monto total', valor: '128.74' },
    { campo: '038', descripcion: 'Beneficiario 4 / Tipo de tributo 1 / Código', valor: '11.22.99.11' },
    { campo: '039', descripcion: 'Beneficiario 4 / Tipo de tributo 1 / Monto', valor: '50.00' },
    { campo: '040', descripcion: 'Beneficiario 4 / Tipo de tributo 2 / Código', valor: '11.22.99.22' },
    { campo: '041', descripcion: 'Beneficiario 4 / Tipo de tributo 2 / Monto', valor: '50.00' },
    { campo: '042', descripcion: 'Beneficiario 4 / Tipo de tributo 3 / Código', valor: '11.22.33.22' },
    { campo: '043', descripcion: 'Beneficiario 4 / Tipo de tributo 3 / Monto', valor: '28.74' },
  ];
}

/** Tabla reducida de la Nota de débito: solo en Registrado (en Pendiente y Procesado ya trae las 16 completas). */
function camposNotaReducido(): CampoDetalleDocumento[] {
  return [
    { campo: '001', descripcion: 'Número de Reporte de Recaudación', valor: '02698147' },
    { campo: '002', descripcion: 'Fecha de emisión de la Nota de Débito', valor: '09/11/2026 15:06:30' },
    { campo: '003', descripcion: 'Código de la Entidad Financiera', valor: '02' },
    { campo: '004', descripcion: 'Monto total', valor: '35.50' },
    { campo: '005', descripcion: 'Moneda', valor: 'PEN' },
    { campo: '006', descripcion: 'Cuenta bancaria', valor: '000698456321' },
    { campo: '007', descripcion: 'Cargo / Propietario', valor: 'SUNAT' },
    { campo: '008', descripcion: 'Cargo / Nro de cuenta bancaria', valor: '000698456321' },
    { campo: '009', descripcion: 'Abono / Propietario', valor: 'BANCO DE CRÉDITO DEL PERÚ' },
    { campo: '010', descripcion: 'Abono / Nro de cuenta bancaria', valor: '0033-429384-0-12' },
    { campo: '011', descripcion: 'Concepto / Código', valor: '418' },
    { campo: '012', descripcion: 'Concepto / Importe', valor: '35.50' },
  ];
}

function detalleReporteVivo(estado: EstadoIngresoTributario, apareceEn: Date): DetalleDocumentoIngresoTributario {
  const fechaAparicion = formatoFechaDemo(apareceEn);
  const procesadoEn = formatoFechaDemo(new Date(apareceEn.getTime() + PASO_SIMULACION_MS * 2));
  return {
    documentoId: REPORTE_VIVO_ID,
    documento: 'Solicitud automática de Reporte de recaudación',
    numero: REPORTE_VIVO_NUMERO,
    fecha: fechaAparicion,
    enteRector: 'DIRECCIÓN GENERAL DEL TESORO PÚBLICO',
    estado,
    // Igual que la Nota de débito: la reducida es solo para Registrado; Pendiente ya trae la tabla completa.
    campos: estado === 'Registrado' ? camposReporteReducido() : DETALLE_REPORTE_RECAUDACION.campos,
    registradoPor: 'SIAF RP',
    fechaRegistrado: fechaAparicion,
    procesadoPor: estado === 'Procesado' ? 'SIAF RP' : undefined,
    fechaProcesado: estado === 'Procesado' ? procesadoEn : undefined,
  };
}

function detalleNotaVivo(estado: EstadoIngresoTributario, apareceEn: Date): DetalleDocumentoIngresoTributario {
  const fechaAparicion = formatoFechaDemo(apareceEn);
  const procesadoEn = formatoFechaDemo(new Date(apareceEn.getTime() + PASO_SIMULACION_MS * 2));
  return {
    documentoId: NOTA_VIVO_ID,
    documento: 'Solicitud automática de Nota de débito',
    numero: NOTA_VIVO_NUMERO,
    fecha: fechaAparicion,
    enteRector: 'DIRECCIÓN GENERAL DEL TESORO PÚBLICO',
    estado,
    // Acá la reducida es solo para Registrado: Pendiente ya muestra la tabla completa (16 campos).
    campos: estado === 'Registrado' ? camposNotaReducido() : DETALLE_NOTA_DEBITO.campos,
    accionLabel: estado === 'Registrado' ? 'Acción por' : undefined,
    registradoPor: 'SIAF RP',
    fechaRegistrado: fechaAparicion,
    procesadoPor: estado === 'Procesado' ? 'SIAF RP' : undefined,
    fechaProcesado: estado === 'Procesado' ? procesadoEn : undefined,
  };
}

/** Filas de la tab Documentos para el Reporte y la Nota en vivo (vacío mientras ninguno apareció todavía). */
export function documentosIngresosTributariosVivos(inicioIso: string, ahora: Date): IngresoTributarioRegistro[] {
  const inicio = new Date(inicioIso);
  const resultado: IngresoTributarioRegistro[] = [];
  const entidad = '009 - Ministerio de Economia y Finanzas';

  const estadoReporte = estadoSimulado(inicio, ahora);
  if (estadoReporte) {
    resultado.push({
      id: REPORTE_VIVO_ID,
      documento: 'Solicitud automática de Reporte de recaudación',
      numero: REPORTE_VIVO_NUMERO,
      tipoAccion: 'Creación',
      estado: estadoReporte,
      fecha: inicio.toISOString(),
      entidad,
    });
  }

  const apareceNota = new Date(inicio.getTime() + PASO_SIMULACION_MS);
  const estadoNota = estadoSimulado(apareceNota, ahora);
  if (estadoNota) {
    resultado.push({
      id: NOTA_VIVO_ID,
      documento: 'Solicitud automática de Nota de débito',
      numero: NOTA_VIVO_NUMERO,
      tipoAccion: 'Creación',
      estado: estadoNota,
      fecha: apareceNota.toISOString(),
      entidad,
    });
  }

  return resultado;
}

/** Detalle del Reporte o la Nota en vivo, o `null` si el id no es uno de los dos o todavía no apareció. */
export function detalleIngresoTributarioVivo(id: string, inicioIso: string, ahora: Date): DetalleDocumentoIngresoTributario | null {
  const inicio = new Date(inicioIso);

  if (id === REPORTE_VIVO_ID) {
    const estado = estadoSimulado(inicio, ahora);
    return estado ? detalleReporteVivo(estado, inicio) : null;
  }

  if (id === NOTA_VIVO_ID) {
    const apareceNota = new Date(inicio.getTime() + PASO_SIMULACION_MS);
    const estado = estadoSimulado(apareceNota, ahora);
    return estado ? detalleNotaVivo(estado, apareceNota) : null;
  }

  return null;
}

/** Registros que suma el Reporte y la Nota en vivo al llegar a Procesado (antes de eso, ninguno). */
export function registrosIngresosTributariosVivos(inicioIso: string, ahora: Date): RegistroIngresoTributario[] {
  const inicio = new Date(inicioIso);
  const resultado: RegistroIngresoTributario[] = [];

  if (estadoSimulado(inicio, ahora) === 'Procesado') {
    resultado.push({
      id: 'rit-3',
      tipo: 'reporte-recaudacion',
      nro: 2,
      numeroOrigen: '02698147',
      entidadFinanciera: 'BANCO DE CRÉDITO DEL PERÚ',
      moneda: 'PEN',
      montoTotal: '4,077.54',
      estado: 'Activo',
      documentoNumero: REPORTE_VIVO_NUMERO,
      documentoNombre: 'Solicitud de Reporte de Recaudación',
    });
  }

  const apareceNota = new Date(inicio.getTime() + PASO_SIMULACION_MS);
  if (estadoSimulado(apareceNota, ahora) === 'Procesado') {
    resultado.push({
      id: 'rit-4',
      tipo: 'nota-debito',
      nro: 2,
      numeroOrigen: '02698147',
      entidadFinanciera: 'BANCO DE CRÉDITO DEL PERÚ',
      moneda: 'PEN',
      montoTotal: '35.50',
      estado: 'Activo',
      documentoNumero: NOTA_VIVO_NUMERO,
      documentoNombre: 'Solicitud de Nota de débito',
    });
  }

  return resultado;
}

/**
 * Semilla de la tab Registros de «Ingresos tributarios SUNAT»: un registro por tipo, enlazado al documento que lo
 * originó por `documentoNumero`. `id` se completa en `crearDatosIniciales()`.
 */
const REGISTROS_INGRESOS_TRIBUTARIOS_SEMILLA: Omit<RegistroIngresoTributario, 'id'>[] = [
  {
    tipo: 'reporte-recaudacion',
    nro: 1,
    numeroOrigen: '02698147',
    entidadFinanciera: 'BANCO DE CRÉDITO DEL PERÚ',
    moneda: 'PEN',
    montoTotal: '4,077.54',
    estado: 'Activo',
    documentoNumero: '123456-2026',
    documentoNombre: 'Solicitud de Reporte de Recaudación',
  },
  {
    tipo: 'nota-debito',
    nro: 1,
    numeroOrigen: '02698147',
    entidadFinanciera: 'BANCO DE CRÉDITO DEL PERÚ',
    moneda: 'PEN',
    montoTotal: '35.50',
    estado: 'Activo',
    documentoNumero: '987654-2026',
    documentoNombre: 'Solicitud de Nota de débito',
  },
];

function crearDatosIniciales(): DatosTaller {
  const datos: DatosTaller = {
    version: VERSION,
    solicitudes: [],
    registros: [],
    registrosSaldos: [],
    ingresosTributarios: INGRESOS_TRIBUTARIOS_SEMILLA.map((d, i) => ({ ...d, id: `itb-${i + 1}` })),
    registrosIngresosTributarios: REGISTROS_INGRESOS_TRIBUTARIOS_SEMILLA.map((r, i) => ({ ...r, id: `rit-${i + 1}` })),
    demoIngresosTributariosInicio: new Date().toISOString(),
    notificaciones: [],
    correlativoDocumento: 0,
    correlativoDocumentoSaldos: 0,
    correlativoRegistro: 0,
    correlativoRegistroSaldos: 0,
    secuencia: 0,
  };
  const ana = USUARIOS_DEMO[0];
  const luis = USUARIOS_DEMO[1];

  for (const semilla of SEMILLAS) {
    const id = nuevoId(datos, 'sol');
    datos.correlativoDocumento += 1;
    const creada = enFecha(semilla.creada, 9);
    const numero = numeroDocumento(datos.correlativoDocumento, new Date(creada));
    const historial: HistorialItem[] = [
      filaHistorial(datos, null, 'NUEVO', creada, ana, ROL_CREADOR),
      filaHistorial(datos, 'NUEVO', 'ELABORADO', enFecha(semilla.creada, 9, 0), ana, ROL_CREADOR),
    ];
    if (semilla.estado !== 'ELABORADO') {
      historial.push(filaHistorial(datos, 'ELABORADO', 'VERIFICADO', enFecha(semilla.creada, 10, 1), ana, ROL_CREADOR));
    }
    if (['APROBADO', 'OBSERVADO', 'RECHAZADO'].includes(semilla.estado)) {
      historial.push(filaHistorial(datos, 'VERIFICADO', semilla.estado, enFecha(semilla.creada, 11, 2), luis, ROL_APROBADOR, semilla.comentario ?? null));
    }
    const ultima = historial[historial.length - 1].createdAt;

    const solicitud: SolicitudResponse = {
      id,
      numero,
      catDocumento: TIPO_DOCUMENTO,
      tipoAccion: 'creacion',
      estado: semilla.estado,
      asuntoMotivo: `[OFICINA GENERAL DE ADMINISTRACIÓN] ${semilla.justificacion}`,
      entidadCreadora: ENTIDAD_CREADORA,
      unidadCreadora: UNIDAD_CREADORA,
      creador: { id: ana.id, nombres: ana.nombres, apellidoPaterno: ana.apellidoPaterno, apellidoMaterno: ana.apellidoMaterno },
      fechaRegistro: creada,
      createdAt: creada,
      updatedAt: ultima,
      itemsCuenta: [],
      detalleCuentaBancaria: { documentoId: id, ...semilla.datos },
      sustentos: [
        {
          id: nuevoId(datos, 'sus'),
          tipoSustento: 'sustento',
          archivo: { nombreOriginal: `Constancia de apertura ${String(datos.correlativoDocumento).padStart(2, '0')}.pdf`, storagePath: 'taller' },
        },
      ],
      historialEstados: historial,
    };
    datos.solicitudes.push(solicitud);

    if (semilla.estado === 'APROBADO') {
      datos.correlativoRegistro += 1;
      datos.registros.push({
        id: nuevoId(datos, 'cb'),
        codigo: `CB-${String(datos.correlativoRegistro).padStart(4, '0')}`,
        estado: semilla.registroInactivo ? 'Inactivo' : 'Activo',
        entidadSiglas: 'MEF',
        documentoId: id,
        numeroDocumento: numero,
        fechaRegistro: ultima,
        ...semilla.datos,
      });
    }
  }

  for (const semilla of SEMILLAS_SALDOS) {
    const id = nuevoId(datos, 'sol');
    datos.correlativoDocumentoSaldos += 1;
    const creada = enFecha(semilla.creada, 9);
    const numero = numeroDocumento(datos.correlativoDocumentoSaldos, new Date(creada), CODIGO_DOCUMENTO_SIL);
    const historial: HistorialItem[] = [
      filaHistorial(datos, null, 'NUEVO', creada, ana, ROL_CREADOR),
      filaHistorial(datos, 'NUEVO', 'ELABORADO', enFecha(semilla.creada, 9, 0), ana, ROL_CREADOR),
    ];
    if (semilla.estado !== 'ELABORADO') {
      historial.push(filaHistorial(datos, 'ELABORADO', 'VERIFICADO', enFecha(semilla.creada, 10, 1), ana, ROL_CREADOR));
    }
    if (['APROBADO', 'OBSERVADO', 'RECHAZADO'].includes(semilla.estado)) {
      historial.push(filaHistorial(datos, 'VERIFICADO', semilla.estado, enFecha(semilla.creada, 11, 2), luis, ROL_APROBADOR, semilla.comentario ?? null));
    }
    const ultima = historial[historial.length - 1].createdAt;

    const solicitud: SolicitudResponse = {
      id,
      numero,
      catDocumento: TIPO_DOCUMENTO_SIL,
      tipoAccion: 'creacion',
      estado: semilla.estado,
      asuntoMotivo: `[OFICINA GENERAL DE ADMINISTRACIÓN] ${semilla.justificacion}`,
      entidadCreadora: ENTIDAD_CREADORA,
      unidadCreadora: UNIDAD_CREADORA,
      creador: { id: ana.id, nombres: ana.nombres, apellidoPaterno: ana.apellidoPaterno, apellidoMaterno: ana.apellidoMaterno },
      fechaRegistro: creada,
      createdAt: creada,
      updatedAt: ultima,
      itemsCuenta: [],
      detalleSaldoInicial: { documentoId: id, ...semilla.datos },
      sustentos: [
        {
          id: nuevoId(datos, 'sus'),
          tipoSustento: 'sustento',
          archivo: { nombreOriginal: `Estado de cuenta ${String(datos.correlativoDocumento).padStart(2, '0')}.pdf`, storagePath: 'taller' },
        },
      ],
      historialEstados: historial,
    };
    datos.solicitudes.push(solicitud);

    if (semilla.estado === 'APROBADO') {
      datos.correlativoRegistroSaldos += 1;
      datos.registrosSaldos.push({
        id: nuevoId(datos, 'sil'),
        codigo: `SIL-${String(datos.correlativoRegistroSaldos).padStart(4, '0')}`,
        estado: semilla.registroInactivo ? 'Inactivo' : 'Activo',
        entidadSiglas: 'MEF',
        documentoId: id,
        numeroDocumento: numero,
        fechaRegistro: ultima,
        ...semilla.datos,
      });
    }
  }

  // Notificaciones: el aprobador tiene una solicitud por aprobar; el creador, una observada y otras ya leídas.
  const aviso = (s: SolicitudResponse, tipo: string, titulo: string, mensaje: string, leida: boolean, destino: Pick<NotificacionMock, 'paraUsuarioId' | 'paraRolCodigo'>): NotificacionMock => ({
    id: nuevoId(datos, 'not'),
    tipo,
    titulo,
    mensaje,
    leida,
    leidaEn: leida ? s.updatedAt ?? null : null,
    createdAt: s.updatedAt ?? s.createdAt,
    documento: { id: s.id, numero: s.numero, catDocumento: (s.catDocumento as typeof TIPO_DOCUMENTO) ?? TIPO_DOCUMENTO },
    ...destino,
  });
  const porEstado = (estado: string) => datos.solicitudes.filter((s) => s.estado === estado);
  for (const s of porEstado('VERIFICADO')) {
    datos.notificaciones.push(aviso(s, 'DOCUMENTO_VERIFICADO', 'Solicitud por aprobar', `La solicitud ${s.numero} fue verificada y espera su aprobación.`, false, { paraRolCodigo: 'APROBADOR' }));
  }
  for (const s of porEstado('OBSERVADO')) {
    datos.notificaciones.push(aviso(s, 'DOCUMENTO_OBSERVADO', 'Solicitud observada', `La solicitud ${s.numero} fue observada: revise el comentario y subsane.`, false, { paraUsuarioId: ana.id }));
  }
  for (const s of porEstado('RECHAZADO')) {
    datos.notificaciones.push(aviso(s, 'DOCUMENTO_RECHAZADO', 'Solicitud rechazada', `La solicitud ${s.numero} fue rechazada.`, true, { paraUsuarioId: ana.id }));
  }
  const ultimaAprobada = porEstado('APROBADO').at(-1);
  if (ultimaAprobada) {
    datos.notificaciones.push(aviso(ultimaAprobada, 'DOCUMENTO_APROBADO', 'Solicitud aprobada', `La solicitud ${ultimaAprobada.numero} fue aprobada.`, true, { paraUsuarioId: ana.id }));
  }

  return datos;
}
