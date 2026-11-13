import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../../../../core/config/app.config';
import {
  ActualizarEstimacionIngresosPayload,
  ClasificadorEstimacionIngresos,
  CrearEstimacionIngresosPayload,
  DetalleEstimacionIngresos,
  EstimacionIngresosRegistro,
  PrecargaEstimacionIngresos,
} from '../models/estimacion-ingresos.model';
import {
  BandejaConsolidadoPliego,
  ConsolidadoPliegoRegistro,
  DetalleConsolidadoPliego,
} from '../models/consolidado-pliego.model';
import { AmbitoConsolidado } from '../config/estimacion-ingresos.rutas';

/**
 * Endpoint propio del proceso. En el taller lo responde el backend simulado
 * (`src/app/mock/mock-backend.interceptor.ts`); con un backend real sería la misma URL.
 */
@Injectable({ providedIn: 'root' })
export class EstimacionIngresosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.api.baseUrl;

  /** Documentos de la bandeja «Estimación de ingresos». */
  listarDocumentos(): Observable<EstimacionIngresosRegistro[]> {
    return this.http.get<EstimacionIngresosRegistro[]>(`${this.base}/estimacion-ingresos`);
  }

  /** Bandeja «Documentos de consolidado pliego de estimación de ingresos». */
  listarConsolidadosPliego(ambito: AmbitoConsolidado = 'pliego'): Observable<BandejaConsolidadoPliego> {
    return this.http.get<BandejaConsolidadoPliego>(`${this.base}/consolidado-${ambito}-estimacion-ingresos`);
  }

  /** «Crear documento»: crea el consolidado en «Elaborado» con todos los registros del universo. */
  crearConsolidadoPliego(ambito: AmbitoConsolidado = 'pliego'): Observable<ConsolidadoPliegoRegistro> {
    return this.http.post<ConsolidadoPliegoRegistro>(`${this.base}/consolidado-${ambito}-estimacion-ingresos`, {});
  }

  /** Consolidado grabado: cabecera, relación de pliegos y trazabilidad. */
  obtenerConsolidadoPliego(id: string, ambito: AmbitoConsolidado = 'pliego'): Observable<DetalleConsolidadoPliego> {
    return this.http.get<DetalleConsolidadoPliego>(`${this.base}/consolidado-${ambito}-estimacion-ingresos/${id}/detalle`);
  }

  /** Creador: Elaborado → Verificado. */
  verificarConsolidadoPliego(id: string, ambito: AmbitoConsolidado = 'pliego'): Observable<ConsolidadoPliegoRegistro> {
    return this.http.post<ConsolidadoPliegoRegistro>(`${this.base}/consolidado-${ambito}-estimacion-ingresos/${id}/verificar`, {});
  }

  /** Creador, proyección DGTP observada: la recalcula y la devuelve a Elaborado (sin verificador). */
  recalcularConsolidadoPliego(id: string, ambito: AmbitoConsolidado): Observable<ConsolidadoPliegoRegistro> {
    return this.http.post<ConsolidadoPliegoRegistro>(`${this.base}/consolidado-${ambito}-estimacion-ingresos/${id}/recalcular`, {});
  }

  /** Aprobador: Verificado → Aprobado. */
  aprobarConsolidadoPliego(id: string, ambito: AmbitoConsolidado = 'pliego'): Observable<ConsolidadoPliegoRegistro> {
    return this.http.post<ConsolidadoPliegoRegistro>(`${this.base}/consolidado-${ambito}-estimacion-ingresos/${id}/aprobar`, {});
  }

  /** Aprobador: Verificado → Observado, con el comentario de la observación. */
  observarConsolidadoPliego(id: string, motivo: string, ambito: AmbitoConsolidado = 'pliego'): Observable<ConsolidadoPliegoRegistro> {
    return this.http.post<ConsolidadoPliegoRegistro>(`${this.base}/consolidado-${ambito}-estimacion-ingresos/${id}/observar`, { motivo });
  }

  /** Revisor / Evaluador: valida u observa un registro de un consolidado aprobado. */
  evaluarRegistroConsolidado(
    ambito: AmbitoConsolidado,
    id: string,
    codigo: string,
    estado: 'Validado' | 'Observado',
    comentario?: string,
  ): Observable<ClasificadorEstimacionIngresos> {
    return this.http.post<ClasificadorEstimacionIngresos>(
      `${this.base}/consolidado-${ambito}-estimacion-ingresos/${id}/registros/${encodeURIComponent(codigo)}/evaluar`,
      { estado, comentario },
    );
  }

  eliminarConsolidadoPliego(id: string, ambito: AmbitoConsolidado = 'pliego'): Observable<void> {
    return this.http.delete<void>(`${this.base}/consolidado-${ambito}-estimacion-ingresos/${id}`);
  }

  /** Cabecera y clasificadores con los que se abre una solicitud «Nuevo», antes de Grabar. */
  obtenerPrecarga(): Observable<PrecargaEstimacionIngresos> {
    return this.http.get<PrecargaEstimacionIngresos>(`${this.base}/estimacion-ingresos/precarga`);
  }

  /** Graba una solicitud «Nuevo» (Creación o Modificación): queda «Elaborado» con su número. */
  crear(payload: CrearEstimacionIngresosPayload): Observable<EstimacionIngresosRegistro> {
    return this.http.post<EstimacionIngresosRegistro>(`${this.base}/estimacion-ingresos`, payload);
  }

  /** Detalle de solo lectura de un documento (tabla de clasificadores de ingresos + trazabilidad). */
  obtenerDetalle(id: string): Observable<DetalleEstimacionIngresos> {
    return this.http.get<DetalleEstimacionIngresos>(`${this.base}/estimacion-ingresos/${id}/detalle`);
  }

  /** Verifica un documento «Elaborado»: pasa a «Verificado». */
  verificar(id: string): Observable<EstimacionIngresosRegistro> {
    return this.http.post<EstimacionIngresosRegistro>(`${this.base}/estimacion-ingresos/${id}/verificar`, {});
  }

  /** Aprueba un documento «Verificado»: pasa a «Aprobado» (estado final). */
  aprobar(id: string): Observable<EstimacionIngresosRegistro> {
    return this.http.post<EstimacionIngresosRegistro>(`${this.base}/estimacion-ingresos/${id}/aprobar`, {});
  }

  /** Aprobador: Verificado → Observado, con la descripción de la observación. */
  observar(id: string, motivo: string): Observable<EstimacionIngresosRegistro> {
    return this.http.post<EstimacionIngresosRegistro>(`${this.base}/estimacion-ingresos/${id}/observar`, { motivo });
  }

  /** Revisor / Evaluador: valida u observa (con comentario) un registro de una solicitud aprobada. */
  evaluarRegistro(id: string, codigo: string, estado: 'Validado' | 'Observado', comentario?: string): Observable<ClasificadorEstimacionIngresos> {
    return this.http.post<ClasificadorEstimacionIngresos>(
      `${this.base}/estimacion-ingresos/${id}/registros/${encodeURIComponent(codigo)}/evaluar`,
      { estado, comentario },
    );
  }

  /** Elimina un documento «Elaborado». */
  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/estimacion-ingresos/${id}`);
  }

  /** Graba los cambios de edición (Tipo de modificación y/o clasificadores): solo sobre un documento «Elaborado». */
  actualizar(id: string, payload: ActualizarEstimacionIngresosPayload): Observable<EstimacionIngresosRegistro> {
    return this.http.patch<EstimacionIngresosRegistro>(`${this.base}/estimacion-ingresos/${id}`, payload);
  }
}
