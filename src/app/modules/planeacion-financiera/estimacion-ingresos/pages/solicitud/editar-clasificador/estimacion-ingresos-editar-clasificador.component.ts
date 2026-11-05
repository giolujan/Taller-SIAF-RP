import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import { FormTableSearchComponent } from '../../../../../../shared/components/form-table-search/form-table-search.component';
import { TableControlsComponent } from '../../../../../../shared/components/table-controls/table-controls.component';
import { TooltipDirective } from '../../../../../../shared/ui/tooltip/tooltip.directive';
import { SolicitudeFormCardComponent } from '../../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { ButtonComponent } from '../../../../../../shared/ui/button/button.component';
import { ExpansionPanelComponent } from '../../../../../../shared/ui/expansion-panel/expansion-panel.component';
import { IconComponent } from '../../../../../../shared/ui/icon/icon.component';
import { MessageBoxComponent } from '../../../../../../shared/ui/message-box/message-box.component';
import { ReadonlyFieldComponent } from '../../../../../../shared/ui/readonly-field/readonly-field.component';
import { SummaryCardComponent, SummaryCardField } from '../../../../../../shared/ui/summary-card/summary-card.component';
import { TextAreaControlComponent } from '../../../../../../shared/ui/text-area-control/text-area-control.component';
import { TextFieldComponent } from '../../../../../../shared/ui/text-field/text-field.component';
import { EstimacionIngresosAgregarGenericaComponent } from './agregar-generica/estimacion-ingresos-agregar-generica.component';
import { EstimacionIngresosAgregarSecuenciaComponent } from './agregar-secuencia/estimacion-ingresos-agregar-secuencia.component';
import { crearSnapshotFormulario, hayCambiosRespectoAlSnapshot } from '../../../../../../shared/utils/form-snapshot.util';
import {
  ClasificadorEstimacionIngresos,
  MESES_ESTIMACION_INGRESOS,
  GenericaGastoSecuencia,
  SecuenciaBaseLegal,
  calcularVariacionEstimacion,
} from '../../../models/estimacion-ingresos.model';

/** Lo editable de la fila: los montos como texto (así los maneja `siaf-input`). */
interface Formulario {
  anio2027: string;
  anio2028: string;
  anio2029: string;
  meses: string[];
  /** Monto con asignación específica (base legal) de 2027, 2028 y 2029. */
  asignacion: string[];
  /** Secuencias del documento del marco legal («Agregar secuencia»). */
  secuencias: SecuenciaBaseLegal[];
}

/** Variación de un año contra otro: monto y porcentaje con signo, como las tarjetas del Figma. */
interface Variacion {
  titulo: string;
  monto: number;
  porcentaje: string;
}

const aNumero = (texto: string): number => Number(texto) || 0;

/** Años del «Monto con asignación específica» de la base legal. */
const ANIOS_BASE_LEGAL = ['2027', '2028', '2029'] as const;

/**
 * «Editar estimación de ingresos» (Figma node 4145:309441): edita una fila de la tabla de clasificadores dentro de
 * la misma solicitud. Fuente de financiamiento, clasificador, clasificador anterior y promedio anual son de solo
 * lectura; se editan los años estimados, la distribución mensual del 2027 y el monto con asignación específica de la
 * base legal (Figma node 4304:68021). El documento de sustento y la descripción cualitativa van desactivados en esta
 * etapa, como en el Figma.
 *
 * Aceptar devuelve la fila con la variación (e, f) recalculada; recién se graba con «Grabar» de la solicitud.
 * Se habilita con cambios y, si hay distribución mensual, con el saldo por distribuir en 0.
 */
@Component({
  selector: 'siaf-estimacion-ingresos-editar-clasificador',
  standalone: true,
  imports: [
    ButtonComponent,
    DecimalPipe,
    EstimacionIngresosAgregarGenericaComponent,
    EstimacionIngresosAgregarSecuenciaComponent,
    ExpansionPanelComponent,
    FormTableSearchComponent,
    IconComponent,
    MessageBoxComponent,
    ReadonlyFieldComponent,
    SolicitudeFormCardComponent,
    SummaryCardComponent,
    TextAreaControlComponent,
    TableControlsComponent,
    TextFieldComponent,
    TooltipDirective,
  ],
  templateUrl: './estimacion-ingresos-editar-clasificador.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimacionIngresosEditarClasificadorComponent {
  @Input({ required: true }) set fila(valor: ClasificadorEstimacionIngresos) {
    this.original.set(valor);
    const f: Formulario = {
      anio2027: String(valor.anio2027),
      anio2028: String(valor.anio2028),
      anio2029: String(valor.anio2029),
      meses: MESES_ESTIMACION_INGRESOS.map((_, i) => (valor.distribucionMensual?.[i] !== undefined ? String(valor.distribucionMensual[i]) : '')),
      asignacion: ANIOS_BASE_LEGAL.map((_, i) => (valor.montoAsignacionEspecifica?.[i] !== undefined ? String(valor.montoAsignacionEspecifica[i]) : '')),
      secuencias: valor.secuenciasBaseLegal ?? [],
    };
    this.form.set(f);
    this.foto = crearSnapshotFormulario(f);
  }

  @Output() canceled = new EventEmitter<void>();
  @Output() accepted = new EventEmitter<ClasificadorEstimacionIngresos>();

  readonly meses = MESES_ESTIMACION_INGRESOS;
  readonly aniosBaseLegal = ANIOS_BASE_LEGAL;
  readonly original = signal<ClasificadorEstimacionIngresos | null>(null);
  readonly form = signal<Formulario>({ anio2027: '', anio2028: '', anio2029: '', meses: [], asignacion: [], secuencias: [] });
  readonly panelSecuenciaAbierto = signal(false);
  readonly baseLegalAbierta = signal(false);
  private foto: string | null = null;

  /** «3.1.5.1 Venta de Publicaciones» → código y nombre. */
  private readonly partesClasificador = computed(() => {
    const texto = this.original()?.clasificador ?? '';
    const espacio = texto.indexOf(' ');
    return espacio === -1 ? { codigo: texto, nombre: '' } : { codigo: texto.slice(0, espacio), nombre: texto.slice(espacio + 1) };
  });

  readonly camposFuente = computed<SummaryCardField[]>(() => {
    const f = this.original();
    return [
      { label: 'Código', value: f?.ff ?? '', icon: 'info', iconLabel: 'Fuente de financiamiento precargada' },
      { label: 'Descripción / Nombre', value: f?.ffDescripcion ?? '—' },
      { label: 'Sigla', value: f?.ffSigla ?? '—' },
    ];
  });

  readonly camposClasificador = computed<SummaryCardField[]>(() => [
    { label: 'Código', value: this.partesClasificador().codigo, icon: 'info', iconLabel: 'Clasificador precargado' },
    { label: 'Nombre', value: this.partesClasificador().nombre },
  ]);

  readonly variaciones = computed<Variacion[]>(() => {
    const a = this.original()?.promedioAnual ?? 0;
    const b = aNumero(this.form().anio2027);
    const c = aNumero(this.form().anio2028);
    const d = aNumero(this.form().anio2029);
    return [
      this.variacion('2027 (b) vs promedio anual (a)', b, a),
      this.variacion('2028 (c) vs 2027 (b)', c, b),
      this.variacion('2029 (d) vs 2028 (c)', d, c),
    ];
  });

  readonly hayDistribucion = computed(() => this.form().meses.some((m) => m.trim() !== ''));
  readonly totalMeses = computed(() => this.form().meses.reduce((suma, m) => suma + aNumero(m), 0));
  readonly saldoPorDistribuir = computed(() => aNumero(this.form().anio2027) - this.totalMeses());

  readonly hayAsignacion = computed(() => this.form().asignacion.some((m) => m.trim() !== ''));
  readonly montosAsignacion = computed(() => this.form().asignacion.map(aNumero));
  /** Saldo de cada año de la base legal: el monto con asignación específica menos lo ya repartido en las secuencias
   *  (vacío = 0, como en el Figma). */
  readonly saldosBaseLegal = computed(() =>
    this.montosAsignacion().map((monto, i) => monto - this.form().secuencias.reduce((suma, s) => suma + (s.montos[i] ?? 0), 0)),
  );

  readonly hayCambios = computed(() => hayCambiosRespectoAlSnapshot(this.foto, crearSnapshotFormulario(this.form())));
  /** Con cambios, la distribución mensual cuadrada (si la hay), ningún saldo de la base legal en negativo y ninguna
   *  secuencia con genéricas que pasen su monto según base legal. */
  readonly puedeAceptar = computed(
    () =>
      this.hayCambios() &&
      (!this.hayDistribucion() || this.saldoPorDistribuir() === 0) &&
      this.saldosBaseLegal().every((saldo) => saldo >= 0) &&
      this.form().secuencias.every((s) => this.totalesGenericas(s).every((total, i) => total <= (s.montos[i] ?? 0))),
  );

  private variacion(titulo: string, actual: number, anterior: number): Variacion {
    const monto = actual - anterior;
    const porcentaje = anterior ? (monto / anterior) * 100 : 0;
    return { titulo, monto, porcentaje: `${porcentaje > 0 ? '+' : ''}${porcentaje.toFixed(1)}%` };
  }

  actualizar<K extends keyof Formulario>(campo: K, valor: Formulario[K]): void {
    this.form.update((f) => ({ ...f, [campo]: valor }));
  }

  /**
   * Año 2027 (b) arrastra la distribución mensual (Figma node 4304:67918): la diferencia con lo ya distribuido la
   * absorbe enero, así el total iguala al año y el saldo por distribuir queda en 0. Si enero no alcanza (bajaría de
   * 0), queda en 0 y el saldo muestra lo que falta repartir.
   */
  actualizarAnio2027(valor: string): void {
    this.form.update((f) => {
      if (!f.meses.some((m) => m.trim() !== '')) return { ...f, anio2027: valor };
      const restoDelAnio = f.meses.slice(1).reduce((suma, m) => suma + aNumero(m), 0);
      const enero = Math.max(0, aNumero(valor) - restoDelAnio);
      return { ...f, anio2027: valor, meses: [String(enero), ...f.meses.slice(1)] };
    });
  }

  /**
   * Prototipo: doble clic en «Año 2027 (b)» carga `anio2027Propuesto` de la fila (Figma node 4304:67918). Se escribe
   * en el `<input>` como si lo tecleara el usuario, así el campo y el formulario quedan en sintonía y se dispara la
   * misma regla de `actualizarAnio2027` (enero absorbe la diferencia).
   */
  aplicarAnio2027Propuesto(evento: MouseEvent): void {
    const propuesto = this.original()?.anio2027Propuesto;
    const input = (evento.target as HTMLElement | null)?.closest('siaf-input')?.querySelector('input');
    if (propuesto === undefined || !input) return;
    input.value = String(propuesto);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.select();
  }

  /**
   * Prototipo: doble clic en «Año 2027» del documento del marco legal copia la recaudación estimada de 2027, 2028 y
   * 2029 al monto con asignación específica (los saldos quedan iguales). Escribe en cada `<input>` como si lo
   * tecleara el usuario, por el mismo motivo que `aplicarAnio2027Propuesto`.
   */
  completarAsignacionConEstimada(evento: MouseEvent): void {
    const f = this.form();
    const montos = [f.anio2027, f.anio2028, f.anio2029].map((m) => String(aNumero(m)));
    const inputs = (evento.target as HTMLElement | null)?.closest('[data-asignacion-especifica]')?.querySelectorAll('siaf-input input');
    if (!inputs || inputs.length !== montos.length) return;
    inputs.forEach((nodo, i) => {
      const input = nodo as HTMLInputElement;
      input.value = montos[i];
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    (inputs[0] as HTMLInputElement).select();
  }

  /** Número de la secuencia abierta en «Editar secuencia» (lápiz de la tabla); null al agregar una nueva. */
  readonly numeroSecuenciaEnEdicion = signal<number | null>(null);
  readonly secuenciaEnEdicion = computed(
    () => this.form().secuencias.find((s) => s.secuencia === this.numeroSecuenciaEnEdicion()) ?? null,
  );

  /** Saldos que ve el panel: al editar, el saldo de cada año más lo que ya tiene esa misma secuencia. */
  readonly saldosParaPanelSecuencia = computed(() => {
    const editada = this.secuenciaEnEdicion();
    return this.saldosBaseLegal().map((saldo, i) => saldo + (editada?.montos[i] ?? 0));
  });

  /** Lápiz de `siaf-table-controls` (con una sola secuencia marcada): abre el panel con los datos de esa secuencia. */
  editarSecuenciaSeleccionada(): void {
    const [numero] = this.secuenciasSeleccionadas();
    if (this.secuenciasSeleccionadas().size !== 1 || numero === undefined) return;
    this.numeroSecuenciaEnEdicion.set(numero);
    this.panelSecuenciaAbierto.set(true);
  }

  cerrarPanelSecuencia(): void {
    this.panelSecuenciaAbierto.set(false);
    this.numeroSecuenciaEnEdicion.set(null);
  }

  /** Aceptar del panel: agrega la secuencia nueva o reemplaza la editada; sus montos descuentan el saldo de cada año. */
  onSecuenciaAgregada(secuencia: SecuenciaBaseLegal): void {
    const editada = this.numeroSecuenciaEnEdicion();
    this.form.update((f) => ({
      ...f,
      secuencias: editada === null ? [...f.secuencias, secuencia] : f.secuencias.map((s) => (s.secuencia === editada ? secuencia : s)),
    }));
    if (editada !== null) this.secuenciasSeleccionadas.set(new Set());
    this.cerrarPanelSecuencia();
  }

  readonly busquedaSecuencias = signal('');
  readonly secuenciasSeleccionadas = signal<Set<number>>(new Set());
  readonly secuenciasExpandidas = signal<Set<number>>(new Set());

  /** Secuencias que muestra la tabla, filtradas por el buscador (número, documento, marco legal o descripción). */
  readonly secuenciasVisibles = computed(() => {
    const texto = this.busquedaSecuencias().trim().toLowerCase();
    const todas = this.form().secuencias;
    if (!texto) return todas;
    return todas.filter((s) => `${s.secuencia} ${s.tipoDocumento} ${s.marcoLegal} ${s.descripcion}`.toLowerCase().includes(texto));
  });

  /** Fila TOTAL de la tabla: suma por año del monto según base legal de todas las secuencias. */
  readonly totalesSecuencias = computed(() =>
    ANIOS_BASE_LEGAL.map((_, i) => this.form().secuencias.reduce((suma, s) => suma + (s.montos[i] ?? 0), 0)),
  );

  /** Editar un monto en la tabla de secuencias: el saldo del año se recalcula al instante. */
  actualizarMontoSecuencia(numero: number, indiceAnio: number, valor: string): void {
    this.form.update((f) => ({
      ...f,
      secuencias: f.secuencias.map((s) =>
        s.secuencia === numero ? { ...s, montos: s.montos.map((m, i) => (i === indiceAnio ? aNumero(valor) : m)) } : s,
      ),
    }));
  }

  toggleTodasSecuencias(marcar: boolean): void {
    this.secuenciasSeleccionadas.set(marcar ? new Set(this.secuenciasVisibles().map((s) => s.secuencia)) : new Set());
  }

  toggleSeleccionSecuencia(numero: number, marcar: boolean): void {
    this.secuenciasSeleccionadas.update((actual) => {
      const nuevo = new Set(actual);
      marcar ? nuevo.add(numero) : nuevo.delete(numero);
      return nuevo;
    });
  }

  toggleExpandirSecuencia(numero: number): void {
    this.secuenciasExpandidas.update((actual) => {
      const nuevo = new Set(actual);
      nuevo.has(numero) ? nuevo.delete(numero) : nuevo.add(numero);
      return nuevo;
    });
  }

  /** Secuencia cuyo «Agregar genérica de gasto» está abierto (por número). */
  readonly secuenciaConGenericaAbierta = signal<number | null>(null);
  readonly secuenciaConGenerica = computed(
    () => this.form().secuencias.find((s) => s.secuencia === this.secuenciaConGenericaAbierta()) ?? null,
  );

  /** Aceptar de «Agregar genérica de gasto»: las genéricas quedan en la secuencia y su fila se despliega para verlas. */
  onGenericasAceptadas(genericas: GenericaGastoSecuencia[]): void {
    const numero = this.secuenciaConGenericaAbierta();
    if (numero === null) return;
    this.form.update((f) => ({
      ...f,
      secuencias: f.secuencias.map((s) => (s.secuencia === numero ? { ...s, genericas } : s)),
    }));
    this.secuenciasExpandidas.update((actual) => new Set(actual).add(numero));
    this.secuenciaConGenericaAbierta.set(null);
  }

  /** TOTAL de las genéricas de una secuencia, por año. */
  totalesGenericas(s: SecuenciaBaseLegal): number[] {
    return ANIOS_BASE_LEGAL.map((_, i) => (s.genericas ?? []).reduce((suma, g) => suma + (g.montos[i] ?? 0), 0));
  }

  /** Editar el monto de una genérica en la fila desplegada de su secuencia. */
  actualizarMontoGenerica(numero: number, codigo: string, indiceAnio: number, valor: string): void {
    this.actualizarGenericas(numero, (genericas) =>
      genericas.map((g) => (g.codigo === codigo ? { ...g, montos: g.montos.map((m, i) => (i === indiceAnio ? aNumero(valor) : m)) } : g)),
    );
  }

  /** Papelera de una genérica en la fila desplegada de su secuencia. */
  quitarGenerica(numero: number, codigo: string): void {
    this.actualizarGenericas(numero, (genericas) => genericas.filter((g) => g.codigo !== codigo));
  }

  private actualizarGenericas(numero: number, cambio: (genericas: GenericaGastoSecuencia[]) => GenericaGastoSecuencia[]): void {
    this.form.update((f) => ({
      ...f,
      secuencias: f.secuencias.map((s) => (s.secuencia === numero ? { ...s, genericas: cambio(s.genericas ?? []) } : s)),
    }));
  }

  /** Papelera de `siaf-table-controls`: quita las secuencias marcadas y renumera las que quedan. */
  quitarSecuenciasSeleccionadas(): void {
    const quitar = this.secuenciasSeleccionadas();
    this.form.update((f) => ({
      ...f,
      secuencias: f.secuencias.filter((s) => !quitar.has(s.secuencia)).map((s, i) => ({ ...s, secuencia: i + 1 })),
    }));
    this.secuenciasSeleccionadas.set(new Set());
    this.secuenciasExpandidas.set(new Set());
  }

  actualizarMes(indice: number, valor: string): void {
    this.form.update((f) => ({ ...f, meses: f.meses.map((m, i) => (i === indice ? valor : m)) }));
  }

  actualizarAsignacion(indice: number, valor: string): void {
    this.form.update((f) => ({ ...f, asignacion: f.asignacion.map((m, i) => (i === indice ? valor : m)) }));
  }

  aceptar(): void {
    const original = this.original();
    if (!original || !this.puedeAceptar()) return;
    const f = this.form();
    const anio2027 = aNumero(f.anio2027);
    this.accepted.emit({
      ...original,
      anio2027,
      anio2028: aNumero(f.anio2028),
      anio2029: aNumero(f.anio2029),
      montoAsignacionEspecifica: this.hayAsignacion() ? f.asignacion.map(aNumero) : undefined,
      secuenciasBaseLegal: f.secuencias.length ? f.secuencias : undefined,
      distribucionMensual: this.hayDistribucion() ? f.meses.map(aNumero) : undefined,
      ...calcularVariacionEstimacion(original.promedioAnual, anio2027),
    });
  }
}
