import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, signal } from '@angular/core';

import { FormTableSearchComponent } from '../../../../../../../shared/components/form-table-search/form-table-search.component';
import { ExpansionPanelComponent } from '../../../../../../../shared/ui/expansion-panel/expansion-panel.component';
import { SidePanelComponent } from '../../../../../../../shared/ui/side-panel/side-panel.component';
import { TextFieldComponent } from '../../../../../../../shared/ui/text-field/text-field.component';
import { GENERICAS_GASTO, GenericaGastoSecuencia, SecuenciaBaseLegal } from '../../../../models/estimacion-ingresos.model';

const aNumero = (texto: string): number => Number(texto) || 0;

/** Única genérica cuyo «Año 2027» responde al doble clic del prototipo: 3 BIENES Y SERVICIOS (Figma node 7202:123276). */
const GENERICA_DEMO = '3';

/**
 * «Agregar genérica de gasto» (Figma node 7202:123276): panel lateral (`siaf-side-panel`) que abre el ícono de cada
 * fila de la tabla de secuencias. Arriba, plegado, el monto según base legal de la secuencia; abajo, la tabla de
 * genéricas de gasto con su monto con asignación específica por año y la fila TOTAL.
 *
 * Misma interacción que «Agregar secuencia»: doble clic en el «Año 2027» de «3 BIENES Y SERVICIOS» (solo esa celda)
 * la completa con lo que falta asignar de la secuencia en cada año. Aceptar se habilita con algún monto y sin que el TOTAL de un año pase el monto
 * de la secuencia.
 */
@Component({
  selector: 'siaf-estimacion-ingresos-agregar-generica',
  standalone: true,
  imports: [DecimalPipe, ExpansionPanelComponent, FormTableSearchComponent, SidePanelComponent, TextFieldComponent],
  templateUrl: './estimacion-ingresos-agregar-generica.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimacionIngresosAgregarGenericaComponent implements OnChanges {
  @Input() open = false;
  /** Años de los montos, en orden. */
  @Input() anios: readonly string[] = [];
  /** Secuencia a la que se le agregan genéricas (llega antes de `open`). */
  @Input() set secuencia(valor: SecuenciaBaseLegal | null) { this.secuenciaS.set(valor); }

  /** Al abrirse arranca con las genéricas ya cargadas de la secuencia y el acordeón plegado. */
  ngOnChanges(cambios: SimpleChanges): void {
    if (!cambios['open']) return;
    if (this.open && !this.abierto()) {
      const previas = this.secuenciaS()?.genericas ?? [];
      this.montos.set(
        Object.fromEntries(
          GENERICAS_GASTO.map((g) => {
            const previa = previas.find((p) => p.codigo === g.codigo);
            return [g.codigo, this.anios.map((_, i) => (previa?.montos[i] ? String(previa.montos[i]) : '0'))];
          }),
        ),
      );
      this.busqueda.set('');
      this.montosAbiertos.set(false);
    }
    this.abierto.set(this.open);
  }

  @Output() closed = new EventEmitter<void>();
  @Output() accepted = new EventEmitter<GenericaGastoSecuencia[]>();

  readonly genericaDemo = GENERICA_DEMO;
  readonly abierto = signal(false);
  readonly secuenciaS = signal<SecuenciaBaseLegal | null>(null);
  readonly montosAbiertos = signal(false);
  readonly busqueda = signal('');
  /** Montos por código de genérica, como texto (así los maneja `siaf-input`). */
  readonly montos = signal<Record<string, string[]>>({});

  readonly genericasVisibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return texto ? GENERICAS_GASTO.filter((g) => `${g.codigo} ${g.nombre}`.toLowerCase().includes(texto)) : GENERICAS_GASTO;
  });

  /** Fila TOTAL: suma por año de todas las genéricas (también las que oculta la búsqueda). */
  readonly totales = computed(() =>
    this.anios.map((_, i) => Object.values(this.montos()).reduce((suma, fila) => suma + aNumero(fila[i] ?? ''), 0)),
  );

  /** Años cuyo TOTAL pasa el monto según base legal de la secuencia. */
  readonly excedidos = computed(() => this.totales().map((total, i) => total > (this.secuenciaS()?.montos[i] ?? 0)));

  readonly puedeAceptar = computed(() => this.totales().some((t) => t > 0) && this.excedidos().every((e) => !e));

  actualizarMonto(codigo: string, indiceAnio: number, valor: string): void {
    this.montos.update((m) => ({ ...m, [codigo]: (m[codigo] ?? []).map((v, i) => (i === indiceAnio ? valor : v)) }));
  }

  /**
   * Prototipo: doble clic en el «Año 2027» de «3 BIENES Y SERVICIOS» (`GENERICA_DEMO`) la completa con lo que falta asignar de la secuencia en
   * cada año. Escribe en cada `<input>` de la fila como si lo tecleara el usuario (el campo enfocado no acepta valores
   * del padre).
   */
  completarConSaldo(codigo: string, evento: MouseEvent): void {
    const secuencia = this.secuenciaS();
    const inputs = (evento.target as HTMLElement | null)?.closest('tr')?.querySelectorAll('siaf-input input');
    if (!secuencia || !inputs || inputs.length !== this.anios.length) return;
    const otras = Object.entries(this.montos()).filter(([c]) => c !== codigo);
    inputs.forEach((nodo, i) => {
      const asignadoEnOtras = otras.reduce((suma, [, fila]) => suma + aNumero(fila[i] ?? ''), 0);
      const input = nodo as HTMLInputElement;
      input.value = String(Math.max(0, (secuencia.montos[i] ?? 0) - asignadoEnOtras));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    (inputs[0] as HTMLInputElement).select();
  }

  aceptar(): void {
    if (!this.puedeAceptar()) return;
    const montos = this.montos();
    this.accepted.emit(
      GENERICAS_GASTO.map((g) => ({ ...g, montos: (montos[g.codigo] ?? []).map(aNumero) })).filter((g) => g.montos.some((m) => m > 0)),
    );
  }
}
