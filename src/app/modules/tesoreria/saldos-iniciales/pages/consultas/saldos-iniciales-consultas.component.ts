import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { QueryReportExportEvent, QueryReportPageComponent } from '../../../../../shared/components/query-report-page/query-report-page.component';
import type { QueryReportConfig, QueryReportParameters, QueryReportResult, QueryReportRow } from '../../../../../shared/types/query-report.types';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { SaldosInicialesApiService } from '../../api/saldos-iniciales-api.service';
import { CONSULTAS_PROCESS_ID, CONSULTAS_ROUTE, REQUEST_ROUTE } from '../../config/saldos-iniciales.rutas';
import { BANCOS, MONEDAS, SaldoInicialRegistro, nombreBanco, nombreMoneda } from '../../models/saldo-inicial.model';
import { exportarSaldosIniciales } from '../../utils/saldos-iniciales-export.util';

/** yyyy-mm-dd → dd/mm/aaaa (el formato que agrupa por mes la vista de gráficas). */
const aFechaPe = (iso: string): string => iso.split('-').reverse().join('/');

/**
 * «Consultas y reportes» del proceso. La pantalla entera la arma `siaf-query-report-page` desde esta
 * configuración: panel de parámetros, resultado, tabla, filtros, vista de gráficas y Exportar. Esta página solo
 * responde la consulta (filtra los saldos aprobados con los parámetros) y genera el archivo al exportar.
 */
@Component({
  selector: 'siaf-saldos-iniciales-consultas',
  standalone: true,
  imports: [QueryReportPageComponent],
  template: `
    <siaf-query-report-page
      [config]="config"
      [result]="resultado()"
      [loading]="cargando()"
      (queried)="consultar($event)"
      (exported)="exportar($event)"
      (linkClicked)="abrirDocumento($event.row)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaldosInicialesConsultasComponent {
  private readonly saldosApi = inject(SaldosInicialesApiService);
  private readonly router = inject(Router);

  readonly resultado = signal<QueryReportResult | null>(null);
  readonly cargando = signal(false);

  readonly config: QueryReportConfig = {
    title: 'Consulta de saldos iniciales',
    breadcrumbs: buildProcessBreadcrumbs(CONSULTAS_PROCESS_ID, CONSULTAS_ROUTE, 'Consulta de saldos iniciales'),
    parameterFields: [
      { key: 'desde', label: 'Saldo desde', type: 'date', required: true, icon: 'calendar_today' },
      { key: 'hasta', label: 'Saldo hasta', type: 'date', required: true, icon: 'event' },
      { key: 'bancos', label: 'Bancos', type: 'select-multiple', icon: 'account_balance', options: BANCOS },
      { key: 'moneda', label: 'Moneda', type: 'select', icon: 'payments', options: MONEDAS },
    ],
    columns: [
      { key: 'codigo', label: 'Código', group: 'Saldo', width: 100 },
      { key: 'banco', label: 'Banco', group: 'Saldo', width: 220 },
      { key: 'numeroCuenta', label: 'Número de cuenta', group: 'Saldo', width: 190 },
      { key: 'numeroLibreta', label: 'Número de libreta', width: 180 },
      { key: 'moneda', label: 'Moneda', width: 110 },
      { key: 'saldoInicial', label: 'Saldo inicial', width: 140 },
      { key: 'fechaSaldo', label: 'Fecha del saldo', width: 150 },
      { key: 'documento', label: 'Documento', width: 280, kind: 'link' },
      { key: 'estado', label: 'Estado', width: 110, fixed: true },
    ],
    rowKey: 'codigo',
    resultTitle: 'Saldos iniciales de la entidad',
    tableLabel: 'Saldos iniciales consultados',
    presetFilters: [
      { key: 'moneda', label: 'Moneda', options: MONEDAS.map((m) => ({ label: m.label, value: m.label })) },
      { key: 'estado', label: 'Estado', options: [{ label: 'Activo', value: 'Activo' }, { label: 'Inactivo', value: 'Inactivo' }] },
    ],
    charts: {
      kpis: [
        { title: 'Saldos iniciales', icon: 'account_balance', tone: 'informative', aggregate: 'count' },
        { title: 'En soles', icon: 'payments', tone: 'success', aggregate: 'count', where: { column: 'moneda', value: 'Soles' } },
        { title: 'En dólares', icon: 'attach_money', tone: 'warning', aggregate: 'count', where: { column: 'moneda', value: 'Dólares' } },
      ],
      charts: [
        { title: 'Saldos por banco', description: 'Cantidad de saldos aprobados en cada banco.', type: 'bar', groupBy: 'banco', aggregate: 'count', seriesName: 'Saldos', categoryLabel: 'Banco', width: 'wide' },
        { title: 'Saldos por moneda', type: 'donut', groupBy: 'moneda', aggregate: 'count', seriesName: 'Saldos' },
        { title: 'Registros por mes', description: 'Saldos registrados en cada mes del periodo consultado.', type: 'line', groupBy: 'fechaSaldo', byMonth: true, aggregate: 'count', seriesName: 'Registros' },
      ],
    },
    emptyTitle: 'Realice una consulta',
    emptyDescription: 'Elija el rango de fechas del saldo y, si quiere, los bancos y la moneda.',
  };

  consultar(parametros: QueryReportParameters): void {
    const desde = String(parametros['desde'] ?? '');
    const hasta = String(parametros['hasta'] ?? '');
    const bancos = (parametros['bancos'] as string[] | undefined) ?? [];
    const moneda = String(parametros['moneda'] ?? '');

    this.cargando.set(true);
    this.saldosApi.listarRegistros().subscribe({
      next: (registros) => {
        const filtrados = registros.filter((r) =>
          (!desde || r.fechaSaldo >= desde)
          && (!hasta || r.fechaSaldo <= hasta)
          && (bancos.length === 0 || bancos.includes(r.bancoCodigo))
          && (!moneda || r.moneda === moneda),
        );
        const filas = filtrados.map((r) => this.aFila(r));
        this.resultado.set({
          rows: filas,
          summary: {
            label: 'Resultado de la consulta',
            icon: 'account_balance',
            title: `${filas.length} ${filas.length === 1 ? 'saldo inicial' : 'saldos iniciales'}`,
            description: desde && hasta ? `Registrados entre el ${aFechaPe(desde)} y el ${aFechaPe(hasta)}.` : undefined,
            fields: [
              { label: 'Bancos', value: bancos.length ? bancos.map(nombreBanco).join(', ') : 'Todos' },
              { label: 'Moneda', value: moneda ? nombreMoneda(moneda) : 'Todas' },
            ],
          },
        });
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  exportar(evento: QueryReportExportEvent): void {
    void exportarSaldosIniciales(evento.format, this.config.columns, evento.rows);
  }

  abrirDocumento(fila: QueryReportRow): void {
    if (fila['documentoId']) void this.router.navigate([REQUEST_ROUTE, fila['documentoId']]);
  }

  private aFila(r: SaldoInicialRegistro): QueryReportRow {
    return {
      codigo: r.codigo,
      banco: nombreBanco(r.bancoCodigo),
      numeroCuenta: r.numeroCuenta,
      numeroLibreta: r.numeroLibreta,
      moneda: nombreMoneda(r.moneda),
      saldoInicial: r.saldoInicial.toLocaleString('es-PE', { minimumFractionDigits: 2 }),
      fechaSaldo: aFechaPe(r.fechaSaldo),
      documento: r.numeroDocumento,
      documentoId: r.documentoId,
      estado: r.estado,
    };
  }
}
