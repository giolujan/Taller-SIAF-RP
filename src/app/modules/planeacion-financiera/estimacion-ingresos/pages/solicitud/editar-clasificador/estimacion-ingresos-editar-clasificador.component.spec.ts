import { TestBed } from '@angular/core/testing';

import { ClasificadorEstimacionIngresos } from '../../../models/estimacion-ingresos.model';
import { EstimacionIngresosEditarClasificadorComponent } from './estimacion-ingresos-editar-clasificador.component';

/** Fila «3.1.5.1 Venta de Publicaciones» del Figma (node 4145:309441). */
const FILA: ClasificadorEstimacionIngresos = {
  ff: '2.09', clasificador: '3.1.5.1 Venta de Publicaciones', promedioAnual: 66249, anio2027: 65500, anio2028: 66917, anio2029: 67253,
  baseLegal: 'SI', variacionMonto: -749, variacionPorcentaje: -1.1,
  distribucionMensual: [1389, 3222, 4869, 6449, 7389, 5196, 5674, 8506, 8096, 6668, 4616, 3426],
};

describe('EstimacionIngresosEditarClasificadorComponent', () => {
  let componente: EstimacionIngresosEditarClasificadorComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EstimacionIngresosEditarClasificadorComponent] });
    componente = TestBed.createComponent(EstimacionIngresosEditarClasificadorComponent).componentInstance;
    componente.fila = FILA;
  });

  it('abre sin cambios: Aceptar desactivado', () => {
    expect(componente.puedeAceptar()).toBeFalse();
  });

  it('al cambiar el año 2027, enero absorbe la diferencia y Aceptar se activa (Figma node 4304:67918)', () => {
    componente.actualizarAnio2027('66582');

    expect(componente.form().meses[0]).toBe('2471');
    expect(componente.totalMeses()).toBe(66582);
    expect(componente.saldoPorDistribuir()).toBe(0);
    expect(componente.variaciones()[0]).toEqual(jasmine.objectContaining({ monto: 333, porcentaje: '+0.5%' }));
    expect(componente.puedeAceptar()).toBeTrue();
  });

  it('doble clic en «Año 2027 (b)» carga el monto propuesto y actualiza la distribución', () => {
    const fixture = TestBed.createComponent(EstimacionIngresosEditarClasificadorComponent);
    fixture.componentRef.setInput('fila', { ...FILA, anio2027Propuesto: 66582 });
    fixture.detectChanges();

    const campo = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('siaf-input')).find((el) => el.textContent?.includes('Año 2027 (b)'))!;
    campo.querySelector('input')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();

    const c = fixture.componentInstance;
    expect(c.form().anio2027).toBe('66582');
    expect(c.form().meses[0]).toBe('2471');
    expect(c.puedeAceptar()).toBeTrue();
  });

  it('doble clic en «Año 2027» del marco legal copia la recaudación estimada a los tres años y sus saldos', () => {
    const fixture = TestBed.createComponent(EstimacionIngresosEditarClasificadorComponent);
    fixture.componentRef.setInput('fila', FILA);
    fixture.componentInstance.baseLegalAbierta.set(true);
    fixture.detectChanges();

    const grupo = (fixture.nativeElement as HTMLElement).querySelector('[data-asignacion-especifica]')!;
    grupo.querySelector('siaf-input input')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();

    const c = fixture.componentInstance;
    expect(c.form().asignacion).toEqual(['65500', '66917', '67253']);
    expect(c.saldosBaseLegal()).toEqual([65500, 66917, 67253]);
    expect(c.puedeAceptar()).toBeTrue();
  });

  it('una secuencia agregada descuenta sus montos del saldo de cada año y se puede quitar', () => {
    componente.actualizarAsignacion(0, '66582');
    componente.actualizarAsignacion(1, '66917');
    componente.actualizarAsignacion(2, '67253');
    componente.onSecuenciaAgregada({
      secuencia: 1, montos: [10000, 0, 2253], tipoDocumento: 'Ley', marcoLegal: 'Ley 31953', descripcion: '', sePresupuesta: 'SI',
    });

    expect(componente.saldosBaseLegal()).toEqual([56582, 66917, 65000]);
    expect(componente.form().secuencias.length).toBe(1);

    componente.toggleSeleccionSecuencia(1, true);
    componente.quitarSecuenciasSeleccionadas();
    expect(componente.saldosBaseLegal()).toEqual([66582, 66917, 67253]);
  });

  it('la tabla de secuencias filtra, suma el TOTAL y un monto editado recalcula el saldo', () => {
    componente.actualizarAsignacion(0, '66582');
    componente.actualizarAsignacion(1, '66917');
    componente.actualizarAsignacion(2, '67253');
    componente.onSecuenciaAgregada({
      secuencia: 1, montos: [66582, 66917, 67253], tipoDocumento: '01 Resolución Directoral', marcoLegal: '001-2025-TCF (TUPA)',
      descripcion: 'ORIENTADO A MANTENER EL SERVICIO', sePresupuesta: 'SI',
    });

    expect(componente.totalesSecuencias()).toEqual([66582, 66917, 67253]);
    expect(componente.saldosBaseLegal()).toEqual([0, 0, 0]);

    componente.busquedaSecuencias.set('tupa');
    expect(componente.secuenciasVisibles().length).toBe(1);
    componente.busquedaSecuencias.set('ordenanza');
    expect(componente.secuenciasVisibles().length).toBe(0);

    componente.actualizarMontoSecuencia(1, 0, '60000');
    expect(componente.saldosBaseLegal()[0]).toBe(6582);

    componente.actualizarMontoSecuencia(1, 0, '70000');
    expect(componente.saldosBaseLegal()[0]).toBe(-3418);
    expect(componente.puedeAceptar()).withContext('saldo negativo').toBeFalse();
  });

  it('genéricas de una secuencia: se editan, suman su TOTAL, se quitan y un exceso bloquea Aceptar', () => {
    componente.actualizarAsignacion(0, '66582');
    componente.onSecuenciaAgregada({
      secuencia: 1, montos: [66582, 0, 0], tipoDocumento: '01 Resolución Directoral', marcoLegal: '001-2025-TCF (TUPA)',
      descripcion: '', sePresupuesta: 'SI',
    });
    componente.secuenciaConGenericaAbierta.set(1);
    componente.onGenericasAceptadas([{ codigo: '3', nombre: 'BIENES Y SERVICIOS', montos: [66582, 0, 0] }]);

    const secuencia = () => componente.form().secuencias[0];
    expect(componente.secuenciasExpandidas().has(1)).toBeTrue();
    expect(componente.totalesGenericas(secuencia())).toEqual([66582, 0, 0]);
    expect(componente.puedeAceptar()).toBeTrue();

    componente.actualizarMontoGenerica(1, '3', 0, '70000');
    expect(componente.totalesGenericas(secuencia())).toEqual([70000, 0, 0]);
    expect(componente.puedeAceptar()).withContext('genéricas pasan el monto de la secuencia').toBeFalse();

    componente.quitarGenerica(1, '3');
    expect(secuencia().genericas).toEqual([]);
  });

  it('lápiz con una secuencia marcada: abre el panel con sus datos y Aceptar la reemplaza en su lugar', () => {
    componente.actualizarAsignacion(0, '66582');
    componente.onSecuenciaAgregada({
      secuencia: 1, montos: [60000, 0, 0], tipoDocumento: '01 Resolución Directoral', marcoLegal: '001-2025-TCF (TUPA)',
      descripcion: '', sePresupuesta: 'SI', genericas: [{ codigo: '3', nombre: 'BIENES Y SERVICIOS', montos: [60000, 0, 0] }],
    });

    componente.editarSecuenciaSeleccionada();
    expect(componente.panelSecuenciaAbierto()).withContext('sin marcar no abre').toBeFalse();

    componente.toggleSeleccionSecuencia(1, true);
    componente.editarSecuenciaSeleccionada();
    expect(componente.panelSecuenciaAbierto()).toBeTrue();
    expect(componente.secuenciaEnEdicion()?.secuencia).toBe(1);
    expect(componente.saldosParaPanelSecuencia()[0]).withContext('saldo + lo de la propia secuencia').toBe(66582);

    componente.onSecuenciaAgregada({ ...componente.secuenciaEnEdicion()!, montos: [66582, 0, 0] });
    expect(componente.form().secuencias.length).toBe(1);
    expect(componente.form().secuencias[0].montos).toEqual([66582, 0, 0]);
    expect(componente.form().secuencias[0].genericas?.length).toBe(1);
    expect(componente.panelSecuenciaAbierto()).toBeFalse();
    expect(componente.secuenciaEnEdicion()).toBeNull();
  });

  it('si enero no alcanza queda en 0 y el saldo muestra lo que falta', () => {
    componente.actualizarAnio2027('60000');

    expect(componente.form().meses[0]).toBe('0');
    expect(componente.saldoPorDistribuir()).toBe(60000 - (65500 - 1389));
    expect(componente.puedeAceptar()).toBeFalse();
  });
});
