import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, computed, signal } from '@angular/core';

import { FormTableSearchComponent } from '../../../../../../shared/components/form-table-search/form-table-search.component';
import { IconComponent } from '../../../../../../shared/ui/icon/icon.component';
import { MessageBoxComponent } from '../../../../../../shared/ui/message-box/message-box.component';
import { ReadonlyFieldComponent } from '../../../../../../shared/ui/readonly-field/readonly-field.component';
import { SummaryCardComponent, SummaryCardField } from '../../../../../../shared/ui/summary-card/summary-card.component';
import { ClasificadorEstimacionIngresos, NOMBRES_FUENTE_FINANCIAMIENTO, SecuenciaBaseLegal } from '../../../models/estimacion-ingresos.model';

/**
 * Base legal de uso específico de un registro, en solo lectura (Figma node 4107:282169 y el panel «Base legal de uso
 * específico» de node 4524:194826): fuente de financiamiento y clasificador, monto con asignación específica y su
 * saldo por año, y las secuencias del documento del marco legal, cada una desplegable con sus genéricas de gasto.
 * La usan el panel lateral «Detalle base legal de uso específico» y la página «Detalle de estimación de ingresos».
 */
@Component({
  selector: 'siaf-estimacion-ingresos-base-legal-lectura',
  standalone: true,
  imports: [DecimalPipe, FormTableSearchComponent, IconComponent, MessageBoxComponent, ReadonlyFieldComponent, SummaryCardComponent],
  templateUrl: './estimacion-ingresos-base-legal-lectura.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimacionIngresosBaseLegalLecturaComponent implements OnChanges {
  /** Registro del que se muestra la base legal. */
  @Input({ required: true }) fila!: ClasificadorEstimacionIngresos;
  /** Columnas de los montos por año: 4 en el panel lateral (node 4107:282169), 3 a ancho de página (node 4524:194826). */
  @Input() columnas: 3 | 4 = 4;

  readonly anios = [2027, 2028, 2029] as const;
  private readonly filaS = signal<ClasificadorEstimacionIngresos | null>(null);
  readonly busqueda = signal('');
  readonly expandidas = signal<Set<number>>(new Set());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fila']) {
      this.filaS.set(this.fila);
      this.busqueda.set('');
      this.expandidas.set(new Set());
    }
  }

  readonly camposFuente = computed<SummaryCardField[]>(() => {
    const f = this.filaS();
    return [
      { label: 'Código', value: f?.ff ?? '', icon: 'info', iconLabel: 'Fuente de financiamiento' },
      { label: 'Descripción / Nombre', value: f?.ffDescripcion ?? (f ? NOMBRES_FUENTE_FINANCIAMIENTO[f.ff] ?? '—' : '—') },
      { label: 'Sigla', value: f?.ffSigla ?? '—' },
    ];
  });

  readonly camposClasificador = computed<SummaryCardField[]>(() => {
    const texto = this.filaS()?.clasificador ?? '';
    const corte = texto.indexOf(' ');
    return [
      { label: 'Código', value: corte === -1 ? texto : texto.slice(0, corte), icon: 'info', iconLabel: 'Clasificador de ingresos' },
      { label: 'Nombre', value: corte === -1 ? '' : texto.slice(corte + 1) },
    ];
  });

  readonly asignacion = computed(() => this.filaS()?.montoAsignacionEspecifica ?? [0, 0, 0]);
  readonly secuencias = computed<SecuenciaBaseLegal[]>(() => this.filaS()?.secuenciasBaseLegal ?? []);

  /** «Saldo Año X» en solo lectura: el monto con asignación específica completo, tal como se grabó (Figma nodes
   *  4107:282169 y 4524:194826). Lo que queda sin repartir en las secuencias solo se controla al editar. */
  readonly saldos = computed(() => this.anios.map((_, i) => this.asignacion()[i] ?? 0));

  readonly secuenciasVisibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    if (!texto) return this.secuencias();
    return this.secuencias().filter((s) =>
      `${s.secuencia} ${s.tipoDocumento} ${s.marcoLegal} ${s.descripcion}`.toLowerCase().includes(texto),
    );
  });

  readonly totalesSecuencias = computed(() => this.anios.map((_, i) => this.secuenciasVisibles().reduce((suma, s) => suma + (s.montos[i] ?? 0), 0)));

  toggleExpandir(secuencia: number): void {
    this.expandidas.update((actual) => {
      const nuevo = new Set(actual);
      nuevo.has(secuencia) ? nuevo.delete(secuencia) : nuevo.add(secuencia);
      return nuevo;
    });
  }
}
