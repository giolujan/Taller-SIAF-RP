import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { EstimacionIngresosApiService } from '../../api/estimacion-ingresos-api.service';
import { ClasificadorEstimacionIngresos, DetalleEstimacionIngresos } from '../../models/estimacion-ingresos.model';
import { EstimacionIngresosSolicitudComponent } from './estimacion-ingresos-solicitud.component';

const MENSUAL_VENTA = [2471, 3222, 4869, 6449, 7389, 5196, 5674, 8506, 8096, 6668, 4616, 3426];

/** Las cuatro filas del Figma «Solicitud elaborada» (node 10813:71699), con Venta de Publicaciones en 66,582. */
const CLASIFICADORES: ClasificadorEstimacionIngresos[] = [
  { ff: '2.09', clasificador: '3.1.5.1 Venta de Publicaciones', promedioAnual: 66249, anio2027: 66582, anio2028: 66917, anio2029: 67253, baseLegal: 'SI', variacionMonto: 333, variacionPorcentaje: 0.5, distribucionMensual: MENSUAL_VENTA },
  { ff: '2.09', clasificador: '3.2.1.1 Tasas Registrales', promedioAnual: 9999, anio2027: 11549, anio2028: 10309, anio2029: 10618, baseLegal: 'NO', variacionMonto: 1550, variacionPorcentaje: 15.5, distribucionMensual: [911, 886, 894, 914, 954, 968, 977, 1015, 1006, 1003, 998, 1023] },
  { ff: '2.09', clasificador: '3.2.5.2 Licencia de Construcción', promedioAnual: 212500, anio2027: 223468, anio2028: 230172, anio2029: 237077, baseLegal: 'NO', variacionMonto: 10968, variacionPorcentaje: 5.2, distribucionMensual: [14640, 17115, 16187, 17156, 18764, 18000, 19000, 20000, 21000, 20000, 20000, 21606] },
  { ff: '4.13', clasificador: '9.1.1.1 Saldos de balance', promedioAnual: 48350, anio2027: 49317, anio2028: 50303, anio2029: 51309, baseLegal: 'NO', variacionMonto: 967, variacionPorcentaje: 2.0, distribucionMensual: [4089, 4165, 4199, 4294, 4164, 4100, 4100, 4100, 4100, 4000, 4000, 4006] },
];

const DETALLE: DetalleEstimacionIngresos = {
  documentoId: 'esti-1', documento: 'Solicitud de estimación de ingresos', numero: '0003', fecha: '2026-08-19T08:00:59',
  enteRector: 'DIRECCIÓN GENERAL DEL TESORO PÚBLICO', entidad: 'MINISTERIO DE ECONOMÍA Y FINANZAS', unidadEjecutora: 'ADMINISTRACIÓN GENERAL',
  estado: 'Elaborado', tipoAccion: 'Creación', clasificadores: CLASIFICADORES, elaboradoPor: 'RICARDO JOHN DOE BUSTAMANTE', fechaElaborado: '2026-08-19T08:00:59',
};

describe('EstimacionIngresosSolicitudComponent · vistas de solo lectura', () => {
  let fixture: ComponentFixture<EstimacionIngresosSolicitudComponent>;
  let c: EstimacionIngresosSolicitudComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EstimacionIngresosSolicitudComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'esti-1' })), snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: EstimacionIngresosApiService, useValue: { obtenerDetalle: () => of(DETALLE) } },
      ],
    });
    fixture = TestBed.createComponent(EstimacionIngresosSolicitudComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
  });

  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

  it('Elaborado muestra el grupo Estimación | Distribución mensual | Total por FF, con Estimación elegido', () => {
    const grupo = (fixture.nativeElement as HTMLElement).querySelector('siaf-buttons-group');
    expect(grupo).withContext('grupo de botones').not.toBeNull();
    expect(grupo!.textContent).toContain('Distribución mensual');
    expect(c.vista()).toBe('estimacion');
  });

  it('en edición no hay grupo y la vista vuelve a Estimación', () => {
    c.vistaElegida.set('mensual');
    c.iniciarEdicion();
    fixture.detectChanges();

    expect(c.vista()).toBe('estimacion');
    expect((fixture.nativeElement as HTMLElement).querySelector('siaf-buttons-group')).toBeNull();
  });

  it('Distribución mensual: meses por clasificador y TOTAL de enero como el Figma (S/ 22,111)', () => {
    c.vistaElegida.set('mensual');
    fixture.detectChanges();

    expect(c.totalesMensuales().slice(0, 5)).toEqual([22111, 25388, 26149, 28813, 31271]);
    expect(texto()).toContain('Total 2027');
    expect(texto()).toContain('S/ 350,916');
  });

  it('Total por FF · Mensualizado agrupa por fuente con su nombre', () => {
    c.vistaElegida.set('ff');
    fixture.detectChanges();

    const [rdr, dyt] = c.filasPorFF();
    expect(rdr.nombre).toBe('2.09 Recursos Directamente Recaudados');
    expect(rdr.meses.slice(0, 5)).toEqual([18022, 21223, 21950, 24519, 27107]);
    expect(rdr.anio2027).toBe(301599);
    expect(dyt.nombre).toBe('4.13 Donaciones y Transferencias');
    expect(texto()).toContain('Mensualizado');
    expect(texto()).toContain('Proyección multianual');
  });

  it('Total por FF · Proyección multianual: años y variación (b) vs (a) por fuente', () => {
    c.vistaElegida.set('ff');
    c.pestanaFF.set('multianual');
    fixture.detectChanges();

    const [rdr] = c.filasPorFF();
    expect([rdr.anio2027, rdr.anio2028, rdr.anio2029]).toEqual([301599, 307398, 314948]);
    expect([rdr.variacionMonto, rdr.variacionPorcentaje]).toEqual([12851, 4.5]);
    expect(c.totalFF()).toEqual(jasmine.objectContaining({ anio2027: 350916, anio2028: 357701, anio2029: 366257, variacionMonto: 13818, variacionPorcentaje: 4.1 }));
    expect(texto()).toContain('S/ 13,818');
  });
});
