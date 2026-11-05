import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SecuenciaBaseLegal } from '../../../../models/estimacion-ingresos.model';
import { EstimacionIngresosAgregarSecuenciaComponent } from './estimacion-ingresos-agregar-secuencia.component';

const SECUENCIA: SecuenciaBaseLegal = {
  secuencia: 1, montos: [66582, 66917, 67253], tipoDocumento: '01 Resolución Directoral', marcoLegal: '001-2025-TCF (TUPA)',
  descripcion: 'ORIENTADO A MANTENER EL SERVICIO', sePresupuesta: 'SI',
  genericas: [{ codigo: '3', nombre: 'BIENES Y SERVICIOS', montos: [66582, 66917, 67253] }],
};

describe('EstimacionIngresosAgregarSecuenciaComponent', () => {
  let fixture: ComponentFixture<EstimacionIngresosAgregarSecuenciaComponent>;
  let componente: EstimacionIngresosAgregarSecuenciaComponent;

  const abrir = (secuencia: SecuenciaBaseLegal | null = null): void => {
    fixture.componentRef.setInput('secuencia', secuencia);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  };
  const cerrar = (): void => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EstimacionIngresosAgregarSecuenciaComponent] });
    fixture = TestBed.createComponent(EstimacionIngresosAgregarSecuenciaComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('anios', ['2027', '2028', '2029']);
    fixture.componentRef.setInput('asignacion', [66582, 66917, 67253]);
    fixture.componentRef.setInput('saldos', [66582, 66917, 67253]);
  });

  afterEach(() => cerrar());

  it('Aceptar pide monto, tipo de documento, marco legal y «¿Se debe presupuestar?»', () => {
    abrir();
    expect(componente.puedeAceptar()).toBeFalse();

    componente.actualizarMonto(0, '10000');
    componente.actualizar('tipoDocumento', 'Ley');
    componente.actualizar('marcoLegal', 'Ley 31953');
    expect(componente.puedeAceptar()).toBeFalse();

    componente.actualizar('sePresupuesta', 'SI');
    expect(componente.puedeAceptar()).toBeTrue();
  });

  it('un monto que pasa el saldo del año marca error y bloquea Aceptar', () => {
    abrir();
    componente.actualizarMonto(1, '70000');
    componente.actualizar('tipoDocumento', 'Ley');
    componente.actualizar('marcoLegal', 'Ley 31953');
    componente.actualizar('sePresupuesta', 'NO');

    expect(componente.erroresMonto()[1]).toBe('Supera el saldo del año');
    expect(componente.puedeAceptar()).toBeFalse();
  });

  it('Aceptar emite la secuencia con su número y montos', () => {
    let emitida: SecuenciaBaseLegal | undefined;
    componente.accepted.subscribe((s) => (emitida = s));
    fixture.componentRef.setInput('numero', 2);
    abrir();
    componente.actualizarMonto(2, '2253');
    componente.actualizar('tipoDocumento', 'Decreto Supremo');
    componente.actualizar('marcoLegal', ' DS 001-2026-EF ');
    componente.actualizar('sePresupuesta', 'NO');
    componente.aceptar();

    expect(emitida).toEqual({
      secuencia: 2, montos: [0, 0, 2253], tipoDocumento: 'Decreto Supremo', marcoLegal: 'DS 001-2026-EF', descripcion: '', sePresupuesta: 'NO',
    });
  });

  it('el acordeón «Monto con asignación específica» arranca plegado', () => {
    abrir();
    expect(componente.montosAbiertos()).toBeFalse();
  });

  it('doble clic en «Monto según base legal 2027» completa la secuencia de demo y habilita Aceptar', () => {
    abrir();
    const grupo = document.querySelector('[data-montos-base-legal]')!;
    grupo.querySelector('siaf-input input')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();

    expect(componente.form()).toEqual({
      montos: ['66582', '66917', '67253'],
      tipoDocumento: '01 Resolución Directoral',
      marcoLegal: '001-2025-TCF (TUPA)',
      descripcion: 'ORIENTADO A MANTENER EL SERVICIO',
      sePresupuesta: 'SI',
    });
    expect(componente.puedeAceptar()).toBeTrue();
  });

  it('al volver a abrirse arranca vacío', () => {
    abrir();
    componente.actualizar('marcoLegal', 'Ley 31953');
    cerrar();
    abrir();

    expect(componente.form().marcoLegal).toBe('');
  });

  describe('editar (lápiz de la tabla)', () => {
    it('abre «Editar secuencia» con los datos de la secuencia y Aceptar desactivado hasta que haya cambios', () => {
      abrir(SECUENCIA);

      expect(componente.editando()).toBeTrue();
      expect(componente.form()).toEqual({
        montos: ['66582', '66917', '67253'],
        tipoDocumento: '01 Resolución Directoral',
        marcoLegal: '001-2025-TCF (TUPA)',
        descripcion: 'ORIENTADO A MANTENER EL SERVICIO',
        sePresupuesta: 'SI',
      });
      expect(document.querySelector('aside h2')?.textContent?.trim()).toBe('Editar secuencia');
      expect(componente.puedeAceptar()).toBeFalse();

      componente.actualizar('sePresupuesta', 'NO');
      expect(componente.puedeAceptar()).toBeTrue();
    });

    it('Aceptar conserva el número y las genéricas de la secuencia', () => {
      let emitida: SecuenciaBaseLegal | undefined;
      componente.accepted.subscribe((s) => (emitida = s));
      fixture.componentRef.setInput('numero', 5);
      abrir(SECUENCIA);
      componente.actualizar('descripcion', 'NUEVA DESCRIPCIÓN');
      componente.aceptar();

      expect(emitida).toEqual({ ...SECUENCIA, descripcion: 'NUEVA DESCRIPCIÓN' });
    });
  });
});
