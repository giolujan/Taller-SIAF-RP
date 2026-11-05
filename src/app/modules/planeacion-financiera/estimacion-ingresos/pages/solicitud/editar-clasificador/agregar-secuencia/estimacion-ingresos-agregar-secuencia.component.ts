import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, signal } from '@angular/core';

import { ExpansionPanelComponent } from '../../../../../../../shared/ui/expansion-panel/expansion-panel.component';
import { RadioComponent, RadioOption } from '../../../../../../../shared/ui/radio/radio.component';
import { ReadonlyFieldComponent } from '../../../../../../../shared/ui/readonly-field/readonly-field.component';
import { SidePanelComponent } from '../../../../../../../shared/ui/side-panel/side-panel.component';
import { TextAreaControlComponent } from '../../../../../../../shared/ui/text-area-control/text-area-control.component';
import { crearSnapshotFormulario, hayCambiosRespectoAlSnapshot } from '../../../../../../../shared/utils/form-snapshot.util';
import { TextFieldComponent, TextFieldOption } from '../../../../../../../shared/ui/text-field/text-field.component';
import { SecuenciaBaseLegal, TIPOS_DOCUMENTO_MARCO_LEGAL } from '../../../../models/estimacion-ingresos.model';

interface Formulario {
  montos: string[];
  tipoDocumento: string;
  marcoLegal: string;
  descripcion: string;
  sePresupuesta: '' | 'SI' | 'NO';
}

const FORMULARIO_VACIO: Formulario = { montos: ['', '', ''], tipoDocumento: '', marcoLegal: '', descripcion: '', sePresupuesta: '' };
const aNumero = (texto: string): number => Number(texto) || 0;

/** Datos con los que el doble clic completa la secuencia (Figma «Agregar secuencia» lleno). Solo demo. */
const SECUENCIA_DEMO: Pick<Formulario, 'tipoDocumento' | 'marcoLegal' | 'descripcion' | 'sePresupuesta'> = {
  tipoDocumento: '01 Resolución Directoral',
  marcoLegal: '001-2025-TCF (TUPA)',
  descripcion: 'ORIENTADO A MANTENER EL SERVICIO',
  sePresupuesta: 'SI',
};

/**
 * «Agregar secuencia» (Figma node 7202:123062): panel lateral (`siaf-side-panel`) que se abre con el (+) de
 * «Secuencia» en la base legal de uso específico. Arriba muestra el monto con asignación específica y su saldo; abajo
 * se registra la secuencia: montos según base legal por año, tipo de documento y marco legal, descripción y si se
 * debe presupuestar.
 *
 * Aceptar se habilita con tipo de documento, marco legal, la respuesta a «¿Se debe presupuestar?» y algún monto, sin
 * pasar el saldo de ningún año.
 *
 * Con `secuencia` es «Editar secuencia»: el mismo panel abre con los datos de esa secuencia (lápiz de la tabla con
 * una secuencia marcada), Aceptar pide además algún cambio y la secuencia conserva sus genéricas de gasto.
 */
@Component({
  selector: 'siaf-estimacion-ingresos-agregar-secuencia',
  standalone: true,
  imports: [DecimalPipe, ExpansionPanelComponent, RadioComponent, ReadonlyFieldComponent, SidePanelComponent, TextAreaControlComponent, TextFieldComponent],
  templateUrl: './estimacion-ingresos-agregar-secuencia.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimacionIngresosAgregarSecuenciaComponent implements OnChanges {
  @Input() open = false;
  /** Secuencia a editar; sin ella el panel agrega una nueva. */
  @Input() secuencia: SecuenciaBaseLegal | null = null;
  /** Años del monto con asignación específica, en orden. */
  @Input() anios: readonly string[] = [];
  /** Monto con asignación específica de cada año. */
  @Input() set asignacion(valor: number[]) { this.asignacionS.set(valor); }
  /** Saldo de cada año antes de esta secuencia. */
  @Input() set saldos(valor: number[]) { this.saldosS.set(valor); }
  /** Número que tendrá la secuencia (la siguiente a las ya registradas). */
  @Input() numero = 1;

  @Output() closed = new EventEmitter<void>();
  @Output() accepted = new EventEmitter<SecuenciaBaseLegal>();

  /** Al abrirse arranca vacío (agregar) o con los datos de la secuencia (editar), y con el acordeón plegado. */
  ngOnChanges(cambios: SimpleChanges): void {
    if (!cambios['open']) return;
    if (this.open && !this.abierto()) {
      const s = this.secuencia;
      const inicial: Formulario = s
        ? {
            montos: s.montos.map((m) => String(m)),
            tipoDocumento: s.tipoDocumento,
            marcoLegal: s.marcoLegal,
            descripcion: s.descripcion,
            sePresupuesta: s.sePresupuesta,
          }
        : { ...FORMULARIO_VACIO, montos: [...FORMULARIO_VACIO.montos] };
      this.form.set(inicial);
      this.foto = s ? crearSnapshotFormulario(inicial) : null;
      this.editando.set(!!s);
      this.montosAbiertos.set(false);
    }
    this.abierto.set(this.open);
  }

  readonly abierto = signal(false);
  readonly editando = signal(false);
  private foto: string | null = null;
  readonly asignacionS = signal<number[]>([]);
  readonly saldosS = signal<number[]>([]);
  /** «Monto con asignación específica» arranca plegado. */
  readonly montosAbiertos = signal(false);
  readonly form = signal<Formulario>({ ...FORMULARIO_VACIO });

  readonly tiposDocumento: TextFieldOption[] = TIPOS_DOCUMENTO_MARCO_LEGAL.map((t) => ({ label: t, value: t }));
  readonly opcionesSiNo: RadioOption[] = [{ label: 'SI', value: 'SI' }, { label: 'NO', value: 'NO' }];

  /** Error por año cuando el monto pasa el saldo disponible. */
  readonly erroresMonto = computed(() =>
    this.form().montos.map((m, i) => (aNumero(m) > (this.saldosS()[i] ?? 0) ? 'Supera el saldo del año' : '')),
  );

  readonly puedeAceptar = computed(() => {
    const f = this.form();
    return (
      f.montos.some((m) => aNumero(m) > 0) &&
      this.erroresMonto().every((e) => !e) &&
      f.tipoDocumento !== '' &&
      f.marcoLegal.trim() !== '' &&
      f.sePresupuesta !== '' &&
      (!this.editando() || hayCambiosRespectoAlSnapshot(this.foto, crearSnapshotFormulario(f)))
    );
  });

  actualizar<K extends keyof Formulario>(campo: K, valor: Formulario[K]): void {
    this.form.update((f) => ({ ...f, [campo]: valor }));
  }

  actualizarMonto(indice: number, valor: string): void {
    this.form.update((f) => ({ ...f, montos: f.montos.map((m, i) => (i === indice ? valor : m)) }));
  }

  /**
   * Prototipo: doble clic en «Monto según base legal 2027» completa la secuencia con los datos del Figma: el saldo de
   * cada año como monto, «01 Resolución Directoral», «001-2025-TCF (TUPA)», la descripción y «SI». Los montos se
   * escriben en cada `<input>` como si los tecleara el usuario (el campo enfocado no acepta valores del padre).
   */
  completarDemo(evento: MouseEvent): void {
    const inputs = (evento.target as HTMLElement | null)?.closest('[data-montos-base-legal]')?.querySelectorAll('siaf-input input');
    const saldos = this.saldosS();
    if (!inputs || inputs.length !== saldos.length) return;
    inputs.forEach((nodo, i) => {
      const input = nodo as HTMLInputElement;
      input.value = String(saldos[i]);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    this.form.update((f) => ({ ...f, ...SECUENCIA_DEMO }));
    (inputs[0] as HTMLInputElement).select();
  }

  aceptar(): void {
    const f = this.form();
    if (!this.puedeAceptar() || f.sePresupuesta === '') return;
    this.accepted.emit({
      ...(this.secuencia ?? {}),
      secuencia: this.secuencia?.secuencia ?? this.numero,
      montos: f.montos.map(aNumero),
      tipoDocumento: f.tipoDocumento,
      marcoLegal: f.marcoLegal.trim(),
      descripcion: f.descripcion.trim(),
      sePresupuesta: f.sePresupuesta,
    });
  }
}
