import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';

import { SidePanelComponent } from '../../../../../../shared/ui/side-panel/side-panel.component';
import { ClasificadorEstimacionIngresos } from '../../../models/estimacion-ingresos.model';
import { EstimacionIngresosBaseLegalLecturaComponent } from './estimacion-ingresos-base-legal-lectura.component';

/**
 * «Detalle base legal de uso específico» (Figma node 4107:282169): panel lateral de solo lectura (`siaf-side-panel`
 * sin pie) que abre la opción «Ver detalle base legal de uso específico» del menú ⋮ de un registro. El contenido es
 * `siaf-estimacion-ingresos-base-legal-lectura`, el mismo de «Detalle de estimación de ingresos».
 */
@Component({
  selector: 'siaf-estimacion-ingresos-detalle-base-legal',
  standalone: true,
  imports: [EstimacionIngresosBaseLegalLecturaComponent, SidePanelComponent],
  templateUrl: './estimacion-ingresos-detalle-base-legal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimacionIngresosDetalleBaseLegalComponent implements OnChanges {
  /** Registro del que se muestra la base legal; `null` cierra el panel. */
  @Input() fila: ClasificadorEstimacionIngresos | null = null;
  @Output() closed = new EventEmitter<void>();

  readonly filaS = signal<ClasificadorEstimacionIngresos | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fila']) this.filaS.set(this.fila);
  }
}
