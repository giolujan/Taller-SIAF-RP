import type { DocumentHistoryRow, DocumentHistorySummary } from '../../../../../../shared/components/document-history-panel/document-history-panel.component';
import type { IconDropdownMenuItem } from '../../../../../../shared/ui/icon-dropdown-menu/icon-dropdown-menu.component';
import type { ClasificadorEstimacionIngresos } from '../../../models/estimacion-ingresos.model';

/** Por ahora `false`: la creación de la solicitud aún no adjunta el documento de sustento. */
export const DESCARGA_SUSTENTO_HABILITADA = false;

/**
 * Menú «Más acciones» (⋮) de un registro de estimación de ingresos en solo lectura: el mismo en la solicitud y en el
 * consolidado (pliego y DGTP). El detalle de base legal se apaga si el registro no la tiene.
 *
 * «Descargar documento de sustento» va deshabilitada por ahora: la creación de la solicitud todavía no adjunta el
 * sustento. Al habilitarla (`DESCARGA_SUSTENTO_HABILITADA`), se apaga solo si el registro no tiene sustento.
 */
export function accionesRegistroEstimacion(fila: ClasificadorEstimacionIngresos): IconDropdownMenuItem[] {
  return [
    { label: 'Ver detalle recaudación histórica', value: 'recaudacion-historica', icon: 'calculate' },
    { label: 'Ver detalle base legal de uso específico', value: 'base-legal', icon: 'balance', disabled: fila.baseLegal !== 'SI' },
    { label: 'Descargar documento de sustento', value: 'descargar-sustento', icon: 'download', disabled: !DESCARGA_SUSTENTO_HABILITADA || !fila.sustento },
  ];
}

/**
 * Menú ⋮ del Revisor / Evaluador (solicitud y consolidado pliego): Validar y Observar solo con el registro pendiente;
 * los detalles de recaudación y base legal (esta, si el registro la tiene); la descarga del sustento (deshabilitada por
 * ahora); y el historial, siempre.
 */
export function accionesRevisorRegistro(fila: ClasificadorEstimacionIngresos): IconDropdownMenuItem[] {
  const pendiente = (fila.estadoEvaluacion ?? 'Pendiente') === 'Pendiente';
  return [
    { label: 'Validar registro', value: 'validar', icon: 'assignment', disabled: !pendiente },
    { label: 'Observar registro', value: 'observar', icon: 'assignment_late', disabled: !pendiente, divider: true },
    { label: 'Ver detalle recaudación histórica', value: 'recaudacion-historica', icon: 'calculate' },
    { label: 'Ver detalle base legal de uso específico', value: 'base-legal', icon: 'balance', disabled: fila.baseLegal !== 'SI' },
    { label: 'Descargar documento de sustento', value: 'descargar-sustento', icon: 'download', disabled: !DESCARGA_SUSTENTO_HABILITADA || !fila.sustento },
    { label: 'Ver historial del registro', value: 'historial', icon: 'history' },
  ];
}

/** Lo que el historial del registro necesita del documento (solicitud o consolidado). */
export interface DocumentoHistorialRegistro {
  numero: string;
  tipoAccion: string;
  elaboradoPor: string;
  fechaElaborado: string;
  verificadoPor?: string;
  fechaVerificado?: string;
  aprobadoPor?: string;
  fechaAprobado?: string;
}

/** «Ver historial del registro»: los pasos del documento y la evaluación del registro, para el panel estándar. */
export function historialRegistro(d: DocumentoHistorialRegistro, fila: ClasificadorEstimacionIngresos): DocumentHistorySummary {
  const paso = (usuario: string, rol: string, iso: string, estado: string, comentario = ''): DocumentHistoryRow => {
    const f = new Date(iso);
    return {
      usuario, rol, estado, comentario,
      fecha: `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`,
      hora: f.toLocaleTimeString('es-PE', { hour12: false }),
    };
  };
  const filas: DocumentHistoryRow[] = [paso(d.elaboradoPor, 'Creador', d.fechaElaborado, 'ELABORADO')];
  if (d.verificadoPor && d.fechaVerificado) filas.push(paso(d.verificadoPor, 'Creador', d.fechaVerificado, 'VERIFICADO'));
  if (d.aprobadoPor && d.fechaAprobado) filas.push(paso(d.aprobadoPor, 'Aprobador', d.fechaAprobado, 'APROBADO'));
  if (fila.estadoEvaluacion && fila.estadoEvaluacion !== 'Pendiente' && fila.fechaEvaluacion) {
    filas.push(paso(fila.evaluadoPor ?? '', 'Revisor / Evaluador', fila.fechaEvaluacion, fila.estadoEvaluacion === 'Validado' ? 'Validado' : 'OBSERVADO', fila.comentarioEvaluacion));
  }
  return { solicitudId: '', document: fila.clasificador, number: d.numero, actionType: d.tipoAccion, staticRows: filas };
}

/**
 * «Estado de la estimación» del revisor (Figma node 14733:117688): cuántos registros faltan evaluar, cuántos validó y
 * cuántos observó, y cuántos pasan el umbral.
 */
export function textoEstadoEvaluacion(registros: ClasificadorEstimacionIngresos[], fueraDelUmbral: number, umbral: number): string {
  const contar = (estado: string) => registros.filter((r) => (r.estadoEvaluacion ?? 'Pendiente') === estado).length;
  const supera = fueraDelUmbral === 1 ? '1 registro supera' : `${fueraDelUmbral} registros superan`;
  return `Tiene ${contar('Pendiente')} registros pendientes de evaluación, ${contar('Validado')} validados y ${contar('Observado')} observados. Además, ${supera} el umbral de variación (±${umbral} %). Revise cada registro desde su detalle o desde Más acciones (⋮).`;
}

/** Descarga el documento de sustento del registro (en la demo, un texto con su nombre). */
export function descargarSustentoRegistro(fila: ClasificadorEstimacionIngresos): void {
  if (!fila.sustento) return;
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([`Documento de sustento: ${fila.sustento.name}`], { type: 'text/plain' }));
  enlace.download = fila.sustento.name;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}
