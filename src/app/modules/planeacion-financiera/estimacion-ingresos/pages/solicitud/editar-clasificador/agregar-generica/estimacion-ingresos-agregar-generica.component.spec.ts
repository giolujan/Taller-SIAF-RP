import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenericaGastoSecuencia, SecuenciaBaseLegal } from '../../../../models/estimacion-ingresos.model';
import { EstimacionIngresosAgregarGenericaComponent } from './estimacion-ingresos-agregar-generica.component';

const SECUENCIA: SecuenciaBaseLegal = {
  secuencia: 1, montos: [66582, 66917, 67253], tipoDocumento: '01 Resolución Directoral', marcoLegal: '001-2025-TCF (TUPA)',
  descripcion: 'ORIENTADO A MANTENER EL SERVICIO', sePresupuesta: 'SI',
};

describe('EstimacionIngresosAgregarGenericaComponent', () => {
  let fixture: ComponentFixture<EstimacionIngresosAgregarGenericaComponent>;
  let c: EstimacionIngresosAgregarGenericaComponent;

  const abrir = (secuencia: SecuenciaBaseLegal = SECUENCIA): void => {
    fixture.componentRef.setInput('anios', ['2027', '2028', '2029']);
    fixture.componentRef.setInput('secuencia', secuencia);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EstimacionIngresosAgregarGenericaComponent] });
    fixture = TestBed.createComponent(EstimacionIngresosAgregarGenericaComponent);
    c = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  });

  it('abre con el acordeón plegado, las genéricas en 0 y Aceptar desactivado', () => {
    abrir();
    expect(c.montosAbiertos()).toBeFalse();
    expect(c.totales()).toEqual([0, 0, 0]);
    expect(c.puedeAceptar()).toBeFalse();
  });

  it('doble clic en el «Año 2027» de una genérica la completa con lo que falta asignar y habilita Aceptar', () => {
    abrir();
    c.actualizarMonto('1', 0, '1000');
    fixture.detectChanges();

    const fila = Array.from(document.querySelectorAll('tbody tr')).find((tr) => tr.textContent?.includes('BIENES Y SERVICIOS'))!;
    fila.querySelector('siaf-input input')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();

    expect(c.montos()['3']).toEqual(['65582', '66917', '67253']);
    expect(c.totales()).toEqual([66582, 66917, 67253]);
    expect(c.puedeAceptar()).toBeTrue();
  });

  it('el doble clic solo funciona en «Año 2027» de BIENES Y SERVICIOS: en otra genérica o en otro año no hace nada', () => {
    abrir();
    const filas = Array.from(document.querySelectorAll('tbody tr'));
    const personal = filas.find((tr) => tr.textContent?.includes('PERSONAL Y OBLIGACIONES'))!;
    personal.querySelector('siaf-input input')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const bienes = filas.find((tr) => tr.textContent?.includes('BIENES Y SERVICIOS'))!;
    bienes.querySelectorAll('siaf-input input')[1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();

    expect(c.totales()).toEqual([0, 0, 0]);
    expect(c.puedeAceptar()).toBeFalse();
  });

  it('un TOTAL que pasa el monto de la secuencia bloquea Aceptar', () => {
    abrir();
    c.actualizarMonto('2', 1, '70000');
    expect(c.excedidos()).toEqual([false, true, false]);
    expect(c.puedeAceptar()).toBeFalse();
  });

  it('Aceptar emite solo las genéricas con monto y al reabrir las trae cargadas', () => {
    let emitidas: GenericaGastoSecuencia[] = [];
    c.accepted.subscribe((g) => (emitidas = g));
    abrir();
    c.actualizarMonto('3', 0, '66582');
    c.aceptar();

    expect(emitidas).toEqual([{ codigo: '3', nombre: 'BIENES Y SERVICIOS', montos: [66582, 0, 0] }]);

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    abrir({ ...SECUENCIA, genericas: emitidas });
    expect(c.montos()['3']).toEqual(['66582', '0', '0']);
  });

  it('el buscador filtra las genéricas por código o nombre', () => {
    abrir();
    c.busqueda.set('pensiones');
    expect(c.genericasVisibles().map((g) => g.codigo)).toEqual(['2']);
  });
});
