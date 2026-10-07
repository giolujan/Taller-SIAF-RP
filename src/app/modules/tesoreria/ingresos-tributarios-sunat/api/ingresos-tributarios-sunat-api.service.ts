import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../../../../core/config/app.config';
import { DetalleDocumentoIngresoTributario, IngresoTributarioRegistro, RegistroIngresoTributario } from '../models/ingreso-tributario.model';

/**
 * Endpoint propio del proceso. En el taller lo responde el backend simulado
 * (`src/app/mock/mock-backend.interceptor.ts`); con un backend real sería la misma URL.
 */
@Injectable({ providedIn: 'root' })
export class IngresosTributariosSunatApiService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.api.baseUrl;

  /** Documentos de ingresos tributarios generados por el motor de integración con SUNAT. */
  listarDocumentos(): Observable<IngresoTributarioRegistro[]> {
    return this.http.get<IngresoTributarioRegistro[]>(`${this.base}/ingresos-tributarios-sunat`);
  }

  /** Registros de la tab Registros (reportes de recaudación y notas de débito ya consolidados). */
  listarRegistros(): Observable<RegistroIngresoTributario[]> {
    return this.http.get<RegistroIngresoTributario[]>(`${this.base}/ingresos-tributarios-sunat/registros`);
  }

  /** Detalle clave-valor de un documento (solo lectura; no todos los documentos lo tienen todavía). */
  obtenerDetalle(id: string): Observable<DetalleDocumentoIngresoTributario> {
    return this.http.get<DetalleDocumentoIngresoTributario>(`${this.base}/ingresos-tributarios-sunat/${id}/detalle`);
  }

  /** Reinicia la simulación en vivo (el Reporte y la Nota vuelven a Registrado desde cero). */
  reiniciarSimulacion(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/ingresos-tributarios-sunat/reiniciar-simulacion`, {});
  }
}
