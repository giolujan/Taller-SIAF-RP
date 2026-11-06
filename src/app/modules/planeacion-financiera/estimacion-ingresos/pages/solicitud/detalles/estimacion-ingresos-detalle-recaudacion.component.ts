import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, signal } from '@angular/core';

import { FormTableSearchComponent } from '../../../../../../shared/components/form-table-search/form-table-search.component';
import { SidePanelComponent } from '../../../../../../shared/ui/side-panel/side-panel.component';
import { ClasificadorEstimacionIngresos, NOMBRES_FUENTE_FINANCIAMIENTO } from '../../../models/estimacion-ingresos.model';

/** Una fila de «Table Recaudacion_Historica»: lo recaudado de un año. */
interface RecaudacionAnual {
  anio: number;
  totalAnual: number;
  /** Tendencia respecto del año anterior, en %; 0 en el primer año de la serie. */
  tendencia: number;
}

/** Código de clasificación institucional de la entidad (dato de demo: el Figma no trae el catálogo). */
const CODIGO_CLASIFICACION_INSTITUCIONAL = '111110001003';

/** Serie del Figma (registro 3.1.5.1): se escala al promedio anual de cada registro. Solo demo. */
const SERIE_FIGMA = [64520, 64571, 64973, 66570, 66660, 66907, 67415, 66569];
const PRIMER_ANIO_SERIE = 2018;

/**
 * «Detalle recaudación histórica» (Figma node 4674:99530): panel lateral de solo lectura (`siaf-side-panel` sin pie)
 * que abre la opción «Ver detalle recaudación histórica» del menú ⋮ de un registro. Muestra lo recaudado por año
 * del clasificador, con su total anual y la tendencia respecto del año anterior; el buscador filtra por año.
 */
@Component({
  selector: 'siaf-estimacion-ingresos-detalle-recaudacion',
  standalone: true,
  imports: [DecimalPipe, FormTableSearchComponent, SidePanelComponent],
  templateUrl: './estimacion-ingresos-detalle-recaudacion.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimacionIngresosDetalleRecaudacionComponent implements OnChanges {
  /** Registro del que se muestra la recaudación; `null` cierra el panel. */
  @Input() fila: ClasificadorEstimacionIngresos | null = null;
  @Input() entidad = '';
  @Input() unidadEjecutora = '';
  @Output() closed = new EventEmitter<void>();

  readonly codigoInstitucional = CODIGO_CLASIFICACION_INSTITUCIONAL;
  readonly filaS = signal<ClasificadorEstimacionIngresos | null>(null);
  readonly busqueda = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fila']) {
      this.filaS.set(this.fila);
      this.busqueda.set('');
    }
  }

  readonly nombreFuente = computed(() => {
    const f = this.filaS();
    return f ? (f.ffDescripcion ?? NOMBRES_FUENTE_FINANCIAMIENTO[f.ff] ?? '') : '';
  });

  /** Serie anual del registro: la del Figma, llevada a su promedio anual. */
  readonly serie = computed<RecaudacionAnual[]>(() => {
    const f = this.filaS();
    if (!f) return [];
    const promedioFigma = SERIE_FIGMA.reduce((a, b) => a + b, 0) / SERIE_FIGMA.length;
    const totales = SERIE_FIGMA.map((v) => Math.round((v * f.promedioAnual) / promedioFigma));
    return totales.map((totalAnual, i) => ({
      anio: PRIMER_ANIO_SERIE + i,
      totalAnual,
      tendencia: i === 0 ? 0 : Number((((totalAnual - totales[i - 1]) / totales[i - 1]) * 100).toFixed(2)),
    }));
  });

  readonly filasVisibles = computed(() => {
    const texto = this.busqueda().trim();
    return texto ? this.serie().filter((r) => String(r.anio).includes(texto)) : this.serie();
  });
}
