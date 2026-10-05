import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../../../../core/config/app.config';
import { SaldoInicialDatos, SaldoInicialRegistro } from '../models/saldo-inicial.model';

/**
 * Endpoints propios del proceso. En el taller los responde el backend simulado
 * (`src/app/mock/mock-backend.interceptor.ts`); con un backend real serían las mismas URLs.
 */
@Injectable({ providedIn: 'root' })
export class SaldosInicialesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.api.baseUrl;

  /** Guarda (o reemplaza) el saldo inicial propuesto en la solicitud. */
  guardarDetalle(solicitudId: string, datos: SaldoInicialDatos): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/solicitudes/${solicitudId}/saldo-inicial`, datos);
  }

  /** Saldos iniciales aprobados: pestaña Registros y consulta. */
  listarRegistros(): Observable<SaldoInicialRegistro[]> {
    return this.http.get<SaldoInicialRegistro[]>(`${this.base}/saldos-iniciales`);
  }
}
