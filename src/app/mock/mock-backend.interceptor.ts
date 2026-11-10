import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { delay, mergeMap } from 'rxjs/operators';

import type { CambiarPerfilResponse, LoginResponse, PerfilItem } from '../core/api/auth-api.service';
import type { SolicitudResponse } from '../core/api/solicitudes-api.service';
import { APP_CONFIG } from '../core/config/app.config';
import type { EstadoDocumento } from '../core/models/documento.model';
import type { CuentaBancariaDatos } from '../modules/tesoreria/cuentas-bancarias/models/cuenta-bancaria.model';
import type { SaldoInicialDatos } from '../modules/tesoreria/saldos-iniciales/models/saldo-inicial.model';
import {
  CLASIFICADORES_ESTIMACION_INGRESOS,
  CONSOLIDADO_PLIEGO_SEMILLA,
  ESTIMACION_INGRESOS_APROBADAS_SEMILLA,
  RELACION_PLIEGOS_CONSOLIDADOS,
  RELACION_PLIEGOS_POR_CLASIFICADOR,
  RELACION_PLIEGOS_POR_ENTIDAD,
  UNIDADES_EJECUTORAS_PLIEGO,
  DatosTaller,
  DETALLES_DOCUMENTOS_INGRESOS_TRIBUTARIOS,
  detalleIngresoTributarioVivo,
  documentosIngresosTributariosVivos,
  registrosIngresosTributariosVivos,
  ENTIDAD_CREADORA,
  NotificacionMock,
  TIPO_DOCUMENTO,
  TIPO_DOCUMENTO_SIL,
  TIPOS_DOCUMENTO,
  UNIDAD_CREADORA,
  filaHistorial,
  guardarDatos,
  leerDatos,
  nuevoId,
  numeroDocumento,
} from './mock-db';
import { CONTRASENA_DEMO, USUARIOS_DEMO, UsuarioDemo, buscarUsuarioPorPerfil } from './usuarios-demo';

/**
 * Backend simulado del taller.
 *
 * Responde las llamadas a `APP_CONFIG.api.baseUrl` como lo haría el backend de SIAF-RP, con los datos de `mock-db.ts`,
 * y deja pasar todo lo demás (assets). Respeta las reglas del flujo de una solicitud: quién puede hacer cada
 * transición, comentario obligatorio al observar o rechazar, sustento obligatorio para elaborar, número al elaborar y
 * registro al aprobar. Para sumar un endpoint: una entrada en `RUTAS` con su manejador.
 */

interface Sesion {
  usuario: UsuarioDemo;
  perfil: PerfilItem;
}

interface Contexto {
  req: HttpRequest<unknown>;
  params: string[];
  query: URLSearchParams;
  sesion: Sesion | null;
  datos: DatosTaller;
}

interface Respuesta {
  status: number;
  body?: unknown;
}

type Manejador = (ctx: Contexto) => Respuesta;

const LATENCIA_MS = 250;

// ─── Token (JWT sin firma: la app solo lee `exp`) ──────────────────

function base64Url(objeto: object): string {
  return btoa(JSON.stringify(objeto)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function firmarToken(usuario: UsuarioDemo, perfil: PerfilItem): string {
  const ahora = Math.floor(Date.now() / 1000);
  const payload = { sub: usuario.id, perfilId: perfil.id, sesionId: 'taller', iat: ahora, exp: ahora + 8 * 3600 };
  return `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url(payload)}.taller`;
}

function sesionDelToken(token: string | null | undefined): Sesion | null {
  if (!token) return null;
  try {
    const segmento = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(segmento)) as { perfilId?: string };
    return payload.perfilId ? buscarUsuarioPorPerfil(payload.perfilId) : null;
  } catch {
    return null;
  }
}

// ─── Respuestas ────────────────────────────────────────────────────

const ok = (body: unknown = null, status = 200): Respuesta => ({ status, body });
const error = (status: number, message: string): Respuesta => ({ status, body: { message } });

function nombreCompleto(u: { nombres: string; apellidoPaterno: string; apellidoMaterno: string }): string {
  return `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}`;
}

function rolDe(perfil: PerfilItem): { codigo: string; nombre: string } {
  return { codigo: perfil.rolCodigo, nombre: perfil.rol };
}

// ─── Autenticación ─────────────────────────────────────────────────

function respuestaLogin(usuario: UsuarioDemo): LoginResponse {
  const perfilActivo = usuario.perfiles[0];
  return { accessToken: firmarToken(usuario, perfilActivo), debeCambiarPassword: false, perfilActivo, perfilesDisponibles: usuario.perfiles };
}

const login: Manejador = ({ req }) => {
  const { dni, password } = (req.body ?? {}) as { dni?: string; password?: string };
  const usuario = USUARIOS_DEMO.find((u) => u.dni === dni?.trim());
  if (!usuario || password !== CONTRASENA_DEMO) return error(401, 'DNI o contraseña incorrectos.');
  return ok(respuestaLogin(usuario));
};

const refresh: Manejador = ({ sesion }) => {
  const actual = sesion ?? sesionDelToken(localStorage.getItem('siaf_access_token'));
  if (!actual) return error(401, 'Sesión expirada.');
  return ok({ accessToken: firmarToken(actual.usuario, actual.perfil) });
};

const cambiarPerfil: Manejador = ({ req, sesion }) => {
  if (!sesion) return error(401, 'Sesión expirada.');
  const { perfilId } = (req.body ?? {}) as { perfilId?: string };
  const perfil = sesion.usuario.perfiles.find((p) => p.id === perfilId);
  if (!perfil) return error(404, 'El perfil no pertenece al usuario.');
  const respuesta: CambiarPerfilResponse = { accessToken: firmarToken(sesion.usuario, perfil), perfilActivo: perfil };
  return ok(respuesta);
};

const solicitarOtp: Manejador = ({ req }) => {
  const { email } = (req.body ?? {}) as { email?: string };
  return USUARIOS_DEMO.some((u) => u.email === email?.trim()) ? ok(null, 204) : error(404, 'El correo no está registrado.');
};

const verificarOtp: Manejador = ({ req }) => {
  const { email, codigo } = (req.body ?? {}) as { email?: string; codigo?: string };
  const usuario = USUARIOS_DEMO.find((u) => u.email === email?.trim());
  if (!usuario) return error(404, 'El correo no está registrado.');
  if (codigo !== '123456') return error(400, 'El código no es válido. En el taller es 123456.');
  return ok(respuestaLogin(usuario));
};

// ─── Catálogos ─────────────────────────────────────────────────────

const tiposDocumento: Manejador = () => ok([
  {
    ...TIPO_DOCUMENTO,
    modulo: 'tesoreria',
    esActivo: true,
    accionesPermitidas: [{ tipoAccion: 'creacion' }],
    proceso: { codigo: 'registro-cuentas-bancarias', nombre: 'Registro de cuentas bancarias', modulo: 'tesoreria' },
  },
  {
    ...TIPO_DOCUMENTO_SIL,
    modulo: 'tesoreria',
    esActivo: true,
    accionesPermitidas: [{ tipoAccion: 'creacion' }],
    proceso: { codigo: 'registro-saldos-iniciales', nombre: 'Registro de saldos iniciales en libro banco y libreta de cuentas de registro', modulo: 'tesoreria' },
  },
]);

// ─── Notificaciones ────────────────────────────────────────────────

function visibles(datos: DatosTaller, sesion: Sesion): NotificacionMock[] {
  return datos.notificaciones
    .filter((n) => (n.paraUsuarioId ? n.paraUsuarioId === sesion.usuario.id : n.paraRolCodigo === sesion.perfil.rolCodigo))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const notificaciones: Manejador = ({ datos, sesion }) => ok(sesion ? visibles(datos, sesion).slice(0, 20) : []);
const historialNotificaciones: Manejador = ({ datos, sesion }) => ok(sesion ? visibles(datos, sesion) : []);
const contadorNotificaciones: Manejador = ({ datos, sesion }) => ok({ total: sesion ? visibles(datos, sesion).filter((n) => !n.leida).length : 0 });

const marcarLeidas: Manejador = ({ datos, sesion }) => {
  if (sesion) {
    const ahora = new Date().toISOString();
    visibles(datos, sesion).forEach((n) => { n.leida = true; n.leidaEn = n.leidaEn ?? ahora; });
    guardarDatos(datos);
  }
  return ok(null, 204);
};

const marcarLeidaDocumento: Manejador = ({ datos, sesion, params }) => {
  if (sesion) {
    const ahora = new Date().toISOString();
    visibles(datos, sesion).filter((n) => n.documento?.id === params[0]).forEach((n) => { n.leida = true; n.leidaEn = n.leidaEn ?? ahora; });
    guardarDatos(datos);
  }
  return ok(null, 204);
};

function notificar(datos: DatosTaller, s: SolicitudResponse, estado: EstadoDocumento, comentario: string | null): void {
  const textos: Partial<Record<EstadoDocumento, { titulo: string; mensaje: string }>> = {
    VERIFICADO: { titulo: 'Solicitud por aprobar', mensaje: `La solicitud ${s.numero} fue verificada y espera su aprobación.` },
    APROBADO: { titulo: 'Solicitud aprobada', mensaje: `La solicitud ${s.numero} fue aprobada.` },
    OBSERVADO: { titulo: 'Solicitud observada', mensaje: `La solicitud ${s.numero} fue observada: ${comentario ?? 'revise el comentario'}.` },
    RECHAZADO: { titulo: 'Solicitud rechazada', mensaje: `La solicitud ${s.numero} fue rechazada.` },
  };
  const texto = textos[estado];
  if (!texto) return;
  const destino = estado === 'VERIFICADO' ? { paraRolCodigo: 'APROBADOR' as const } : { paraUsuarioId: s.creador?.id };
  datos.notificaciones.push({
    id: nuevoId(datos, 'not'),
    tipo: `DOCUMENTO_${estado}`,
    ...texto,
    leida: false,
    leidaEn: null,
    createdAt: new Date().toISOString(),
    documento: { id: s.id, numero: s.numero, catDocumento: TIPO_DOCUMENTO },
    ...destino,
  });
}

// ─── Solicitudes ───────────────────────────────────────────────────

function buscarSolicitud(datos: DatosTaller, id: string): SolicitudResponse | undefined {
  return datos.solicitudes.find((s) => s.id === id);
}

function bandeja(ctx: Contexto, estados?: EstadoDocumento[]): Respuesta {
  const { datos, sesion, query } = ctx;
  if (!sesion) return error(401, 'Sesión expirada.');
  const tipos = (query.get('tipos') ?? '').split(',').filter(Boolean);
  const busqueda = (query.get('search') ?? '').trim().toLowerCase();

  let lista = datos.solicitudes.filter((s) => s.entidadCreadora?.id === sesion.perfil.entidadId && s.estado !== 'NUEVO');
  if (estados) lista = lista.filter((s) => estados.includes(s.estado));
  if (tipos.length) lista = lista.filter((s) => tipos.includes(s.catDocumento?.codigo ?? ''));
  if (busqueda) {
    lista = lista.filter((s) =>
      [s.numero, s.asuntoMotivo, s.catDocumento?.nombre, s.creador ? nombreCompleto(s.creador) : '']
        .some((valor) => (valor ?? '').toLowerCase().includes(busqueda)),
    );
  }
  lista = [...lista].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pagina = Number(query.get('page'));
  const limite = Number(query.get('limit'));
  if (pagina && limite) {
    return ok({ data: lista.slice((pagina - 1) * limite, pagina * limite), total: lista.length, page: pagina, limit: limite });
  }
  return ok(lista);
}

const bandejaCreador: Manejador = (ctx) => bandeja(ctx);
const bandejaAprobador: Manejador = (ctx) => bandeja(ctx, ['VERIFICADO', 'OBSERVADO', 'APROBADO', 'RECHAZADO']);

const detalleSolicitud: Manejador = ({ datos, params }) => {
  const s = buscarSolicitud(datos, params[0]);
  return s ? ok(s) : error(404, 'La solicitud no existe.');
};

const crearSolicitud: Manejador = ({ req, datos, sesion }) => {
  if (!sesion) return error(401, 'Sesión expirada.');
  if (sesion.perfil.rolCodigo !== 'CREADOR') return error(403, 'Solo un creador puede registrar solicitudes.');
  const dto = (req.body ?? {}) as { tipoDocumentoId?: string; tipoAccion?: string; organoLinea?: string; justificacion?: string };
  const ahora = new Date().toISOString();
  const id = nuevoId(datos, 'sol');
  const tipo = TIPOS_DOCUMENTO.find((t) => t.id === dto.tipoDocumentoId) ?? TIPO_DOCUMENTO;
  const s: SolicitudResponse = {
    id,
    numero: null,
    catDocumento: tipo,
    tipoAccion: dto.tipoAccion ?? 'creacion',
    estado: 'NUEVO',
    asuntoMotivo: `[${dto.organoLinea ?? ''}] ${dto.justificacion ?? ''}`,
    entidadCreadora: ENTIDAD_CREADORA,
    unidadCreadora: UNIDAD_CREADORA,
    creador: { id: sesion.usuario.id, nombres: sesion.usuario.nombres, apellidoPaterno: sesion.usuario.apellidoPaterno, apellidoMaterno: sesion.usuario.apellidoMaterno },
    fechaRegistro: ahora,
    createdAt: ahora,
    updatedAt: ahora,
    itemsCuenta: [],
    detalleCuentaBancaria: null,
    detalleSaldoInicial: null,
    sustentos: [],
    historialEstados: [filaHistorial(datos, null, 'NUEVO', ahora, sesion.usuario, rolDe(sesion.perfil))],
  };
  datos.solicitudes.push(s);
  guardarDatos(datos);
  return ok(s, 201);
};

const actualizarSolicitud: Manejador = ({ req, datos, params, sesion }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  if (sesion?.perfil.rolCodigo !== 'CREADOR') return error(403, 'Solo el creador puede editar la solicitud.');
  if (!['ELABORADO', 'OBSERVADO'].includes(s.estado)) return error(409, 'Solo se edita una solicitud elaborada u observada.');
  const dto = (req.body ?? {}) as { justificacion?: string; organoLinea?: string };
  s.asuntoMotivo = `[${dto.organoLinea ?? ''}] ${dto.justificacion ?? ''}`;
  s.updatedAt = new Date().toISOString();
  guardarDatos(datos);
  return ok(s);
};

const guardarCuentaBancaria: Manejador = ({ req, datos, params }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  if (!['NUEVO', 'ELABORADO', 'OBSERVADO'].includes(s.estado)) return error(409, 'La solicitud ya no admite cambios.');
  const cuenta = req.body as CuentaBancariaDatos;
  if (!/^\d{10,20}$/.test(cuenta?.numeroCuenta ?? '')) return error(400, 'El número de cuenta debe tener entre 10 y 20 dígitos.');
  s.detalleCuentaBancaria = { documentoId: s.id, ...cuenta };
  s.updatedAt = new Date().toISOString();
  guardarDatos(datos);
  return ok({ message: 'Cuenta guardada' });
};

const guardarSaldoInicial: Manejador = ({ req, datos, params }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  if (!['NUEVO', 'ELABORADO', 'OBSERVADO'].includes(s.estado)) return error(409, 'La solicitud ya no admite cambios.');
  const saldo = req.body as SaldoInicialDatos;
  if (!/^\d{10,20}$/.test(saldo?.numeroCuenta ?? '')) return error(400, 'El número de cuenta debe tener entre 10 y 20 dígitos.');
  s.detalleSaldoInicial = { documentoId: s.id, ...saldo };
  s.updatedAt = new Date().toISOString();
  guardarDatos(datos);
  return ok({ message: 'Saldo inicial guardado' });
};

const subirSustento: Manejador = ({ req, datos, params }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  const formulario = req.body instanceof FormData ? req.body : null;
  const archivo = formulario?.get('archivo');
  if (!(archivo instanceof File)) return error(400, 'Adjunte un archivo.');
  const sustento = {
    id: nuevoId(datos, 'sus'),
    tipoSustento: String(formulario?.get('tipoSustento') ?? 'sustento'),
    createdAt: new Date().toISOString(),
    archivo: {
      id: nuevoId(datos, 'arc'),
      nombreOriginal: archivo.name,
      extension: archivo.name.split('.').pop() ?? '',
      mimeType: archivo.type,
      sizeBytes: String(archivo.size),
      storagePath: 'taller',
    },
  };
  // El taller guarda solo el nombre del archivo (no su contenido) y un único sustento por solicitud.
  s.sustentos = [sustento];
  guardarDatos(datos);
  return ok(sustento, 201);
};

const listarSustentos: Manejador = ({ datos, params }) => ok(buscarSolicitud(datos, params[0])?.sustentos ?? []);

const eliminarSustento: Manejador = ({ datos, params }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (s) {
    s.sustentos = (s.sustentos ?? []).filter((x) => x.id !== params[1]);
    guardarDatos(datos);
  }
  return ok(null, 204);
};

const TRANSICIONES: Record<'CREADOR' | 'APROBADOR', Partial<Record<EstadoDocumento, EstadoDocumento[]>>> = {
  CREADOR: {
    NUEVO: ['ELABORADO'],
    ELABORADO: ['ELABORADO', 'VERIFICADO', 'ELIMINADO'],
    OBSERVADO: ['ELABORADO', 'VERIFICADO'],
  },
  APROBADOR: {
    VERIFICADO: ['APROBADO', 'OBSERVADO', 'RECHAZADO'],
  },
};

const cambiarEstado: Manejador = ({ req, datos, params, sesion }) => {
  if (!sesion) return error(401, 'Sesión expirada.');
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  const dto = (req.body ?? {}) as { estadoNuevo?: EstadoDocumento; comentario?: string; motivo?: string };
  const nuevo = dto.estadoNuevo;
  const rol = sesion.perfil.rolCodigo as 'CREADOR' | 'APROBADOR';
  const permitidos = TRANSICIONES[rol]?.[s.estado] ?? [];
  if (!nuevo || !permitidos.includes(nuevo)) {
    return error(409, `No se puede pasar de ${s.estado} a ${nuevo ?? '—'} con el perfil ${sesion.perfil.rol}.`);
  }
  const comentario = dto.comentario?.trim() ?? '';
  if ((nuevo === 'OBSERVADO' || nuevo === 'RECHAZADO') && !comentario) return error(400, 'Escriba el comentario.');
  if (nuevo === 'ELIMINADO' && (s.historialEstados ?? []).some((h) => h.estadoNuevo === 'OBSERVADO')) {
    return error(409, 'No se puede eliminar una solicitud que fue observada.');
  }
  const codigoDocumento = s.catDocumento?.codigo;
  if (nuevo === 'ELABORADO') {
    if (codigoDocumento === TIPO_DOCUMENTO_SIL.codigo) {
      if (!s.detalleSaldoInicial) return error(400, 'Registre los datos del saldo inicial.');
    } else if (!s.detalleCuentaBancaria) {
      return error(400, 'Registre los datos de la cuenta bancaria.');
    }
    if (!(s.sustentos ?? []).length) return error(400, 'Adjunte el documento de sustento.');
  }

  const ahora = new Date().toISOString();
  const anterior = s.estado;
  if (nuevo === 'ELABORADO' && !s.numero) {
    if (codigoDocumento === TIPO_DOCUMENTO_SIL.codigo) {
      datos.correlativoDocumentoSaldos += 1;
      s.numero = numeroDocumento(datos.correlativoDocumentoSaldos, new Date(), codigoDocumento);
    } else {
      datos.correlativoDocumento += 1;
      s.numero = numeroDocumento(datos.correlativoDocumento, new Date(), codigoDocumento);
    }
  }
  // Volver a grabar un ELABORADO no deja fila en el historial.
  if (!(anterior === 'ELABORADO' && nuevo === 'ELABORADO')) {
    const texto = nuevo === 'RECHAZADO' && dto.motivo ? `[${dto.motivo}] ${comentario}` : comentario || null;
    s.historialEstados = [...(s.historialEstados ?? []), filaHistorial(datos, anterior, nuevo, ahora, sesion.usuario, rolDe(sesion.perfil), texto)];
  }
  s.estado = nuevo;
  s.updatedAt = ahora;
  if (nuevo === 'VERIFICADO') s.fechaEvaluacion = ahora;
  if (nuevo === 'APROBADO') s.fechaAprobacion = ahora;

  // Al aprobar, la cuenta o el saldo pasa a los registros.
  if (nuevo === 'APROBADO' && s.detalleCuentaBancaria && !datos.registros.some((r) => r.documentoId === s.id)) {
    const { documentoId: _documento, ...cuenta } = s.detalleCuentaBancaria;
    datos.correlativoRegistro += 1;
    datos.registros.push({
      id: nuevoId(datos, 'cb'),
      codigo: `CB-${String(datos.correlativoRegistro).padStart(4, '0')}`,
      estado: 'Activo',
      entidadSiglas: s.entidadCreadora?.siglas ?? '',
      documentoId: s.id,
      numeroDocumento: s.numero ?? '',
      fechaRegistro: ahora,
      ...cuenta,
    });
  }
  if (nuevo === 'APROBADO' && s.detalleSaldoInicial && !datos.registrosSaldos.some((r) => r.documentoId === s.id)) {
    const { documentoId: _documento, ...saldoInicial } = s.detalleSaldoInicial;
    datos.correlativoRegistroSaldos += 1;
    datos.registrosSaldos.push({
      id: nuevoId(datos, 'sil'),
      codigo: `SIL-${String(datos.correlativoRegistroSaldos).padStart(4, '0')}`,
      estado: 'Activo',
      entidadSiglas: s.entidadCreadora?.siglas ?? '',
      documentoId: s.id,
      numeroDocumento: s.numero ?? '',
      fechaRegistro: ahora,
      ...saldoInicial,
    });
  }

  notificar(datos, s, nuevo, comentario || null);
  guardarDatos(datos);
  return ok({ message: 'Estado actualizado', numero: s.numero });
};

// ─── Proceso de ejemplo ────────────────────────────────────────────

const registrosCuentas: Manejador = ({ datos, sesion }) =>
  ok(datos.registros.filter((r) => !sesion || r.entidadSiglas === sesion.perfil.entidadSiglas));

const registrosSaldos: Manejador = ({ datos, sesion }) =>
  ok(datos.registrosSaldos.filter((r) => !sesion || r.entidadSiglas === sesion.perfil.entidadSiglas));

// Proceso de solo consulta: no hay bandeja por rol, cualquier sesión ve los mismos documentos. Al Reporte y la
// Nota de ejemplo (ya «Procesados») se suman el Reporte y la Nota en vivo, calculados contra la hora actual —
// ver «Simulación en vivo» en mock-db.ts.
const ingresosTributariosSunat: Manejador = ({ datos }) => ok([
  ...datos.ingresosTributarios,
  ...documentosIngresosTributariosVivos(datos.demoIngresosTributariosInicio, new Date()),
]);

const ingresosTributariosSunatRegistros: Manejador = ({ datos }) => ok([
  ...datos.registrosIngresosTributarios,
  ...registrosIngresosTributariosVivos(datos.demoIngresosTributariosInicio, new Date()),
]);

const ingresosTributariosSunatDetalle: Manejador = ({ datos, params }) => {
  const detalle = DETALLES_DOCUMENTOS_INGRESOS_TRIBUTARIOS[params[0]]
    ?? detalleIngresoTributarioVivo(params[0], datos.demoIngresosTributariosInicio, new Date());
  return detalle ? ok(detalle) : error(404, 'Este documento todavía no tiene pantalla de detalle.');
};

// Al entrar a la bandeja desde el menú (no al volver con «Regresar» del detalle), el Reporte y la Nota en vivo
// vuelven a arrancar desde Registrado: el taller es para demostrar el flujo una y otra vez.
const ingresosTributariosSunatReiniciarSimulacion: Manejador = ({ datos }) => {
  datos.demoIngresosTributariosInicio = new Date().toISOString();
  guardarDatos(datos);
  return ok({ message: 'Simulación reiniciada' });
};

// Proceso de solo consulta (Planeación financiera > Estimación de ingresos): sin bandeja por rol.
// Las sembradas no guardan quién las elaboró: se completa con el creador demo, igual que en el detalle.
// Siembra las solicitudes aprobadas de ejemplo una sola vez (también en datos ya guardados en el navegador), con el
// siguiente correlativo, así no se pierde lo que el usuario ya creó.
function sembrarAprobadas(datos: DatosTaller): void {
  // Repara las fechas de las ya sembradas (una versión anterior guardó una hora inválida).
  let cambio = false;
  for (const s of ESTIMACION_INGRESOS_APROBADAS_SEMILLA) {
    const d = datos.estimacionIngresos.find((x) => x.id === s.id);
    if (d && Number.isNaN(new Date(d.fecha).getTime())) {
      Object.assign(d, { fecha: s.fecha, fechaVerificado: s.fechaVerificado, fechaAprobado: s.fechaAprobado });
      cambio = true;
    }
  }
  const faltan = ESTIMACION_INGRESOS_APROBADAS_SEMILLA.filter((s) => !datos.estimacionIngresos.some((d) => d.id === s.id));
  if (!faltan.length) {
    if (cambio) guardarDatos(datos);
    return;
  }
  for (const s of faltan) {
    datos.estimacionIngresos.push({ ...s, numero: String(datos.estimacionIngresos.length + 1).padStart(4, '0') });
  }
  guardarDatos(datos);
}

const estimacionIngresos: Manejador = ({ datos }) => {
  sembrarAprobadas(datos);
  return ok(datos.estimacionIngresos.map((d) => ({ ...d, elaboradoPor: d.elaboradoPor ?? nombreCompleto(USUARIOS_DEMO[0]) })));
};

// Bandeja del consolidado pliego: sus documentos y cuántas unidades ejecutoras validaron su solicitud. Si los datos
// guardados son de antes de esta bandeja, la siembra aquí.
const consolidadosPliegoEstimacion: Manejador = ({ datos }) => {
  if (!datos.consolidadosPliegoEstimacion) {
    datos.consolidadosPliegoEstimacion = CONSOLIDADO_PLIEGO_SEMILLA.map((d) => ({ ...d }));
    guardarDatos(datos);
  }
  return ok({
    documentos: datos.consolidadosPliegoEstimacion.map((d) => ({ ...d, elaboradoPor: d.elaboradoPor ?? nombreCompleto(USUARIOS_DEMO[0]) })),
    unidadesValidadas: UNIDADES_EJECUTORAS_PLIEGO,
    unidadesTotal: UNIDADES_EJECUTORAS_PLIEGO,
  });
};

// Consolidado «Nuevo»: cabecera y relación de pliegos, sin número ni estado hasta Grabar.
const consolidadoPliegoPrecarga: Manejador = ({ sesion }) => {
  if (!sesion) return error(401, 'Sesión expirada.');
  return ok({
    fecha: new Date().toISOString(),
    enteRector: 'DIRECCIÓN GENERAL DEL TESORO PÚBLICO',
    entidad: '009 Ministerio de Economía y Finanzas',
    unidadEjecutora: UNIDAD_CREADORA.nombre,
    pliegos: RELACION_PLIEGOS_CONSOLIDADOS,
  });
};

// Grabar un consolidado «Nuevo»: queda «Elaborado» con el siguiente correlativo.
const consolidadoPliegoCrear: Manejador = ({ req, datos, sesion }) => {
  if (!sesion) return error(401, 'Sesión expirada.');
  const registros = ((req.body ?? {}) as { registros?: string[] }).registros ?? [];
  if (!registros.length) return error(400, 'Seleccione al menos un registro para el consolidado.');
  const lista = (datos.consolidadosPliegoEstimacion ??= CONSOLIDADO_PLIEGO_SEMILLA.map((d) => ({ ...d })));
  const nuevo = {
    id: nuevoId(datos, 'cpe'),
    documento: 'Consolidado pliego de estimación de ingresos',
    numero: String(lista.length + 1).padStart(4, '0'),
    tipoAccion: 'Creación',
    estado: 'Elaborado' as const,
    sistema: 'Tesorería',
    fecha: new Date().toISOString(),
    entidad: '009 Ministerio de Economía y Finanzas',
  };
  lista.unshift({ ...nuevo, elaboradoPor: nombreCompleto(sesion.usuario) });
  guardarDatos(datos);
  return ok(nuevo, 201);
};

const consolidadoDe = (datos: { consolidadosPliegoEstimacion?: { id: string }[] }, id: string) =>
  (datos.consolidadosPliegoEstimacion ?? []).find((d) => d.id === id);

// Detalle de un consolidado grabado (Figma node 7606:466323): la relación de pliegos es la misma de la demo.
const consolidadoPliegoDetalle: Manejador = ({ datos, params }) => {
  const doc = (datos.consolidadosPliegoEstimacion ?? []).find((d) => d.id === params[0]);
  if (!doc) return error(404, 'El documento no existe.');
  return ok({
    documentoId: doc.id,
    numero: doc.numero,
    estado: doc.estado,
    tipoAccion: doc.tipoAccion,
    fecha: doc.fecha,
    enteRector: 'DIRECCIÓN GENERAL DEL TESORO PÚBLICO',
    entidad: 'PRESIDENCIA DEL CONSEJO DE MINISTROS',
    pliegos: RELACION_PLIEGOS_CONSOLIDADOS,
    pliegosPorClasificador: RELACION_PLIEGOS_POR_CLASIFICADOR,
    pliegosPorEntidad: RELACION_PLIEGOS_POR_ENTIDAD,
    elaboradoPor: doc.elaboradoPor ?? nombreCompleto(USUARIOS_DEMO[0]),
    fechaElaborado: doc.fecha,
    verificadoPor: doc.verificadoPor ?? (doc.estado === 'Elaborado' ? undefined : nombreCompleto(USUARIOS_DEMO[0])),
    fechaVerificado: doc.fechaVerificado ?? (doc.estado === 'Elaborado' ? undefined : doc.fecha),
    aprobadoPor: doc.aprobadoPor,
    fechaAprobado: doc.fechaAprobado,
    observadoPor: doc.observadoPor,
    fechaObservado: doc.fechaObservado,
    motivoObservacion: doc.motivoObservacion,
  });
};

// Aprobar un consolidado (aprobador): Verificado → Aprobado, estado final.
const consolidadoPliegoAprobar: Manejador = ({ datos, params, sesion }) => {
  const doc = (datos.consolidadosPliegoEstimacion ?? []).find((d) => d.id === params[0]);
  if (!doc) return error(404, 'El documento no existe.');
  if (doc.estado !== 'Verificado') return error(409, `No se puede aprobar un documento en estado ${doc.estado}.`);
  doc.estado = 'Aprobado';
  doc.aprobadoPor = nombreCompleto(sesion?.usuario ?? USUARIOS_DEMO[1] ?? USUARIOS_DEMO[0]);
  doc.fechaAprobado = new Date().toISOString();
  guardarDatos(datos);
  return ok(doc);
};

// Observar un consolidado (aprobador): Verificado → Observado, con el comentario. En este producto no hay Rechazar.
const consolidadoPliegoObservar: Manejador = ({ req, datos, params, sesion }) => {
  const doc = (datos.consolidadosPliegoEstimacion ?? []).find((d) => d.id === params[0]);
  if (!doc) return error(404, 'El documento no existe.');
  if (doc.estado !== 'Verificado') return error(409, `No se puede observar un documento en estado ${doc.estado}.`);
  const motivo = String((req.body as { motivo?: string } | null)?.motivo ?? '').trim();
  if (!motivo) return error(400, 'Ingrese el comentario de la observación.');
  doc.estado = 'Observado';
  doc.observadoPor = nombreCompleto(sesion?.usuario ?? USUARIOS_DEMO[1] ?? USUARIOS_DEMO[0]);
  doc.fechaObservado = new Date().toISOString();
  doc.motivoObservacion = motivo;
  guardarDatos(datos);
  return ok(doc);
};

// Verificar un consolidado: Elaborado → Verificado.
const consolidadoPliegoVerificar: Manejador = ({ datos, params, sesion }) => {
  const doc = (datos.consolidadosPliegoEstimacion ?? []).find((d) => d.id === params[0]);
  if (!doc) return error(404, 'El documento no existe.');
  if (doc.estado !== 'Elaborado') return error(409, `No se puede verificar un documento en estado ${doc.estado}.`);
  doc.estado = 'Verificado';
  doc.verificadoPor = nombreCompleto(sesion?.usuario ?? USUARIOS_DEMO[0]);
  doc.fechaVerificado = new Date().toISOString();
  guardarDatos(datos);
  return ok(doc);
};

// Eliminar un consolidado (solo en Elaborado, como la solicitud).
const consolidadoPliegoEliminar: Manejador = ({ datos, params }) => {
  const lista = datos.consolidadosPliegoEstimacion ?? [];
  const indice = lista.findIndex((d) => d.id === params[0]);
  if (indice === -1 || !consolidadoDe(datos, params[0])) return error(404, 'El documento no existe.');
  lista.splice(indice, 1);
  guardarDatos(datos);
  return ok(null, 204);
};

// Precarga de una solicitud «Nuevo» (aún sin número ni estado): cabecera y clasificadores con los que se abre la
// pantalla al pulsar Aceptar en «Crear documento». No graba nada: el documento recién existe al Grabar.
const estimacionIngresosPrecarga: Manejador = ({ sesion }) => {
  if (!sesion) return error(401, 'Sesión expirada.');
  return ok({
    fecha: new Date().toISOString(),
    enteRector: 'DIRECCIÓN GENERAL DEL TESORO PÚBLICO',
    entidad: '009 Ministerio de Economía y Finanzas',
    unidadEjecutora: UNIDAD_CREADORA.nombre,
    // Una solicitud nueva empieza sin base legal cargada: el monto con asignación específica se completa con doble
    // clic en «Año 2027» y las secuencias con «+», al editar el clasificador. Las solicitudes sembradas sí la traen,
    // para el panel «Detalle base legal de uso específico».
    clasificadores: CLASIFICADORES_ESTIMACION_INGRESOS.map(
      ({ montoAsignacionEspecifica: _monto, secuenciasBaseLegal: _secuencias, ...fila }) => fila,
    ),
  });
};

// Grabar una solicitud «Nuevo» (Creación o Modificación): queda «Elaborado» con el siguiente correlativo, sin
// distinguir tipo de acción, y con los clasificadores que llegaron del formulario.
const estimacionIngresosCrear: Manejador = ({ req, datos, sesion }) => {
  if (!sesion) return error(401, 'Sesión expirada.');
  const dto = (req.body ?? {}) as { tipoAccion?: string; tipoModificacionTexto?: string; clasificadores?: typeof CLASIFICADORES_ESTIMACION_INGRESOS };
  const id = nuevoId(datos, 'esti');
  const nuevo = {
    id,
    documento: 'Solicitud de estimación de ingresos',
    numero: String(datos.estimacionIngresos.length + 1).padStart(4, '0'),
    tipoAccion: dto.tipoAccion === 'Modificación' ? 'Modificación' : 'Creación',
    estado: 'Elaborado' as const,
    sistema: 'Tesorería',
    fecha: new Date().toISOString(),
    entidad: '009 Ministerio de Economía y Finanzas',
    elaboradoPor: nombreCompleto(sesion.usuario),
    ...(dto.tipoModificacionTexto ? { tipoModificacionTexto: dto.tipoModificacionTexto } : {}),
    ...(dto.clasificadores ? { clasificadoresPersonalizados: dto.clasificadores } : {}),
  };
  datos.estimacionIngresos.push(nuevo);
  guardarDatos(datos);
  return ok(nuevo, 201);
};

const estimacionIngresosDetalle: Manejador = ({ datos, params, sesion }) => {
  const doc = datos.estimacionIngresos.find((d) => d.id === params[0]);
  if (!doc) return error(404, 'El documento no existe.');
  return ok({
    documentoId: doc.id,
    documento: doc.documento,
    numero: doc.numero,
    fecha: doc.fecha,
    enteRector: 'DIRECCIÓN GENERAL DEL TESORO PÚBLICO',
    entidad: doc.entidad,
    unidadEjecutora: UNIDAD_CREADORA.nombre,
    estado: doc.estado,
    tipoAccion: doc.tipoAccion,
    tipoModificacion: doc.tipoAccion === 'Modificación' ? (doc.tipoModificacionTexto ?? 'Montos') : undefined,
    clasificadores: doc.clasificadoresPersonalizados ?? CLASIFICADORES_ESTIMACION_INGRESOS,
    elaboradoPor: doc.elaboradoPor ?? nombreCompleto(USUARIOS_DEMO[0]),
    fechaElaborado: doc.fecha,
    verificadoPor: doc.verificadoPor,
    fechaVerificado: doc.fechaVerificado,
    aprobadoPor: doc.aprobadoPor,
    fechaAprobado: doc.fechaAprobado,
    observadoPor: doc.observadoPor,
    fechaObservado: doc.fechaObservado,
    motivoObservacion: doc.motivoObservacion,
  });
};

// Verificar: Elaborado → Verificado.
const estimacionIngresosVerificar: Manejador = ({ datos, params, sesion }) => {
  const doc = datos.estimacionIngresos.find((d) => d.id === params[0]);
  if (!doc) return error(404, 'El documento no existe.');
  if (doc.estado !== 'Elaborado') return error(409, `No se puede verificar un documento en estado ${doc.estado}.`);
  doc.estado = 'Verificado';
  doc.verificadoPor = nombreCompleto(sesion?.usuario ?? USUARIOS_DEMO[0]);
  doc.fechaVerificado = new Date().toISOString();
  guardarDatos(datos);
  return ok(doc);
};

// Aprobar: Verificado → Aprobado, estado final.
const estimacionIngresosAprobar: Manejador = ({ datos, params, sesion }) => {
  const doc = datos.estimacionIngresos.find((d) => d.id === params[0]);
  if (!doc) return error(404, 'El documento no existe.');
  if (doc.estado !== 'Verificado') return error(409, `No se puede aprobar un documento en estado ${doc.estado}.`);
  doc.estado = 'Aprobado';
  doc.aprobadoPor = nombreCompleto(sesion?.usuario ?? USUARIOS_DEMO[1] ?? USUARIOS_DEMO[0]);
  doc.fechaAprobado = new Date().toISOString();
  guardarDatos(datos);
  return ok(doc);
};

// Observar (aprobador): Verificado → Observado, con la descripción de la observación. En este producto no hay
// Rechazar.
// Revisor / Evaluador: valida u observa un registro (clasificador) de una solicitud aprobada. Las solicitudes que usan
// la tabla por defecto la copian antes, para no cambiarla en todas.
const estimacionIngresosEvaluarRegistro: Manejador = ({ req, datos, params, sesion }) => {
  if (sesion?.perfil.rolCodigo !== 'REVISOR') return error(403, 'Solo el Revisor / Evaluador evalúa los registros.');
  const doc = datos.estimacionIngresos.find((d) => d.id === params[0]);
  if (!doc) return error(404, 'El documento no existe.');
  if (doc.estado !== 'Aprobado') return error(409, 'Solo se evalúan los registros de una solicitud aprobada.');
  const dto = (req.body ?? {}) as { estado?: 'Validado' | 'Observado'; comentario?: string };
  if (dto.estado !== 'Validado' && dto.estado !== 'Observado') return error(400, 'Estado de evaluación no válido.');
  if (dto.estado === 'Observado' && !dto.comentario?.trim()) return error(400, 'Escriba el comentario de la observación.');
  const codigo = decodeURIComponent(params[1]);
  const filas = (doc.clasificadoresPersonalizados ??= CLASIFICADORES_ESTIMACION_INGRESOS.map((c) => ({ ...c })));
  const fila = filas.find((c) => c.clasificador.split(' ')[0] === codigo);
  if (!fila) return error(404, 'El registro no existe.');
  fila.estadoEvaluacion = dto.estado;
  fila.comentarioEvaluacion = dto.estado === 'Observado' ? dto.comentario?.trim() : undefined;
  guardarDatos(datos);
  return ok(fila);
};

const estimacionIngresosObservar: Manejador = ({ req, datos, params, sesion }) => {
  const doc = datos.estimacionIngresos.find((d) => d.id === params[0]);
  if (!doc) return error(404, 'El documento no existe.');
  if (doc.estado !== 'Verificado') return error(409, `No se puede observar un documento en estado ${doc.estado}.`);
  const motivo = String((req.body as { motivo?: string } | null)?.motivo ?? '').trim();
  if (!motivo) return error(400, 'Ingrese la descripción de la observación.');
  doc.estado = 'Observado';
  doc.observadoPor = nombreCompleto(sesion?.usuario ?? USUARIOS_DEMO[1] ?? USUARIOS_DEMO[0]);
  doc.fechaObservado = new Date().toISOString();
  doc.motivoObservacion = motivo;
  guardarDatos(datos);
  return ok(doc);
};

// Grabar en edición: solo sobre «Elaborado» (showEdit de la matriz rol/estado solo habilita Editar ahí).
const estimacionIngresosActualizar: Manejador = ({ req, datos, params }) => {
  const doc = datos.estimacionIngresos.find((d) => d.id === params[0]);
  if (!doc) return error(404, 'El documento no existe.');
  if (doc.estado !== 'Elaborado') return error(409, `No se puede editar un documento en estado ${doc.estado}.`);
  const dto = (req.body ?? {}) as { tipoModificacionTexto?: string; clasificadores?: typeof CLASIFICADORES_ESTIMACION_INGRESOS };
  if (dto.tipoModificacionTexto !== undefined) doc.tipoModificacionTexto = dto.tipoModificacionTexto;
  if (dto.clasificadores !== undefined) doc.clasificadoresPersonalizados = dto.clasificadores;
  guardarDatos(datos);
  return ok(doc);
};

const estimacionIngresosEliminar: Manejador = ({ datos, params }) => {
  const indice = datos.estimacionIngresos.findIndex((d) => d.id === params[0]);
  if (indice === -1) return error(404, 'El documento no existe.');
  datos.estimacionIngresos.splice(indice, 1);
  guardarDatos(datos);
  return ok(null, 204);
};

// ─── Enrutador ─────────────────────────────────────────────────────

const RUTAS: [string, RegExp, Manejador][] = [
  ['POST', /^\/auth\/login$/, login],
  ['POST', /^\/auth\/logout$/, () => ok(null, 204)],
  ['POST', /^\/auth\/refresh$/, refresh],
  ['PATCH', /^\/auth\/cambiar-perfil$/, cambiarPerfil],
  ['POST', /^\/auth\/cambiar-password$/, () => ok(null, 204)],
  ['POST', /^\/auth\/solicitar-otp$/, solicitarOtp],
  ['POST', /^\/auth\/verificar-otp$/, verificarOtp],
  ['POST', /^\/auth\/reenviar-otp-whatsapp$/, () => ok(null, 204)],
  ['GET', /^\/tipos-documento$/, tiposDocumento],
  ['GET', /^\/notificaciones$/, notificaciones],
  ['GET', /^\/notificaciones\/historial$/, historialNotificaciones],
  ['GET', /^\/notificaciones\/contador$/, contadorNotificaciones],
  ['PATCH', /^\/notificaciones\/marcar-leidas$/, marcarLeidas],
  ['PATCH', /^\/notificaciones\/marcar-leida-documento\/([^/]+)$/, marcarLeidaDocumento],
  ['GET', /^\/solicitudes\/bandeja-creador$/, bandejaCreador],
  ['GET', /^\/solicitudes\/bandeja-aprobador$/, bandejaAprobador],
  ['POST', /^\/solicitudes$/, crearSolicitud],
  ['PATCH', /^\/solicitudes\/([^/]+)\/estado$/, cambiarEstado],
  ['POST', /^\/solicitudes\/([^/]+)\/cuenta-bancaria$/, guardarCuentaBancaria],
  ['POST', /^\/solicitudes\/([^/]+)\/saldo-inicial$/, guardarSaldoInicial],
  ['POST', /^\/solicitudes\/([^/]+)\/sustentos$/, subirSustento],
  ['GET', /^\/solicitudes\/([^/]+)\/sustentos$/, listarSustentos],
  ['DELETE', /^\/solicitudes\/([^/]+)\/sustentos\/([^/]+)$/, eliminarSustento],
  ['GET', /^\/solicitudes\/([^/]+)$/, detalleSolicitud],
  ['PATCH', /^\/solicitudes\/([^/]+)$/, actualizarSolicitud],
  ['GET', /^\/cuentas-bancarias$/, registrosCuentas],
  ['GET', /^\/saldos-iniciales$/, registrosSaldos],
  ['GET', /^\/ingresos-tributarios-sunat$/, ingresosTributariosSunat],
  ['GET', /^\/ingresos-tributarios-sunat\/registros$/, ingresosTributariosSunatRegistros],
  ['GET', /^\/ingresos-tributarios-sunat\/([^/]+)\/detalle$/, ingresosTributariosSunatDetalle],
  ['POST', /^\/ingresos-tributarios-sunat\/reiniciar-simulacion$/, ingresosTributariosSunatReiniciarSimulacion],
  ['GET', /^\/estimacion-ingresos$/, estimacionIngresos],
  ['GET', /^\/consolidado-pliego-estimacion-ingresos$/, consolidadosPliegoEstimacion],
  ['GET', /^\/consolidado-pliego-estimacion-ingresos\/precarga$/, consolidadoPliegoPrecarga],
  ['POST', /^\/consolidado-pliego-estimacion-ingresos$/, consolidadoPliegoCrear],
  ['GET', /^\/consolidado-pliego-estimacion-ingresos\/([^/]+)\/detalle$/, consolidadoPliegoDetalle],
  ['POST', /^\/consolidado-pliego-estimacion-ingresos\/([^/]+)\/verificar$/, consolidadoPliegoVerificar],
  ['POST', /^\/consolidado-pliego-estimacion-ingresos\/([^/]+)\/aprobar$/, consolidadoPliegoAprobar],
  ['POST', /^\/consolidado-pliego-estimacion-ingresos\/([^/]+)\/observar$/, consolidadoPliegoObservar],
  ['DELETE', /^\/consolidado-pliego-estimacion-ingresos\/([^/]+)$/, consolidadoPliegoEliminar],
  ['GET', /^\/estimacion-ingresos\/precarga$/, estimacionIngresosPrecarga],
  ['POST', /^\/estimacion-ingresos$/, estimacionIngresosCrear],
  ['GET', /^\/estimacion-ingresos\/([^/]+)\/detalle$/, estimacionIngresosDetalle],
  ['POST', /^\/estimacion-ingresos\/([^/]+)\/verificar$/, estimacionIngresosVerificar],
  ['POST', /^\/estimacion-ingresos\/([^/]+)\/aprobar$/, estimacionIngresosAprobar],
  ['POST', /^\/estimacion-ingresos\/([^/]+)\/observar$/, estimacionIngresosObservar],
  ['POST', /^\/estimacion-ingresos\/([^/]+)\/registros\/([^/]+)\/evaluar$/, estimacionIngresosEvaluarRegistro],
  ['DELETE', /^\/estimacion-ingresos\/([^/]+)$/, estimacionIngresosEliminar],
  ['PATCH', /^\/estimacion-ingresos\/([^/]+)$/, estimacionIngresosActualizar],
];

export const mockBackendInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<unknown>> => {
  const base = APP_CONFIG.api.baseUrl;
  const url = new URL(req.url, window.location.origin);
  if (!url.pathname.startsWith(base)) return next(req);

  const ruta = url.pathname.slice(base.length) || '/';
  // Los parámetros pueden venir en la URL o en HttpParams.
  const query = new URLSearchParams(url.search);
  req.params.keys().forEach((clave) => query.set(clave, req.params.get(clave) ?? ''));

  for (const [metodo, patron, manejador] of RUTAS) {
    const coincidencia = req.method === metodo ? patron.exec(ruta) : null;
    if (!coincidencia) continue;
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    const respuesta = manejador({ req, params: coincidencia.slice(1), query, sesion: sesionDelToken(token), datos: leerDatos() });
    return responder(req, respuesta);
  }

  console.warn(`[mock] Endpoint no simulado: ${req.method} ${ruta}`);
  return responder(req, error(404, `El backend simulado no responde ${req.method} ${ruta}.`));
};

function responder(req: HttpRequest<unknown>, respuesta: Respuesta): Observable<HttpEvent<unknown>> {
  if (respuesta.status < 400) {
    return of(new HttpResponse({ status: respuesta.status, body: respuesta.body ?? null, url: req.url })).pipe(delay(LATENCIA_MS));
  }
  return timer(LATENCIA_MS).pipe(
    mergeMap(() => throwError(() => new HttpErrorResponse({ status: respuesta.status, error: respuesta.body, url: req.url }))),
  );
}
