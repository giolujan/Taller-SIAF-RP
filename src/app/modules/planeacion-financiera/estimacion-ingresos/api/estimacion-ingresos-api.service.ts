import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../../../../core/config/app.config';
import {
  ActualizarEstimacionIngresosPayload,
  CrearEstimacionIngresosPayload,
  DetalleEstimacionIngresos,
  EstimacionIngresosRegistro,
  PrecargaEstimacionIngresos,
} from '../models/estimacion-ingresos.model';

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

  /** Elimina un documento «Elaborado». */
  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/estimacion-ingresos/${id}`);
  }

  /** Graba los cambios de edición (Tipo de modificación y/o clasificadores): solo sobre un documento «Elaborado». */
  actualizar(id: string, payload: ActualizarEstimacionIngresosPayload): Observable<EstimacionIngresosRegistro> {
    return this.http.patch<EstimacionIngresosRegistro>(`${this.base}/estimacion-ingresos/${id}`, payload);
  }
}
