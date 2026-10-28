import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';

import { BreadcrumbItem } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { TextFieldComponent, TextFieldOption } from '../../../../../shared/ui/text-field/text-field.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { crearSnapshotFormulario, hayCambiosRespectoAlSnapshot } from '../../../../../shared/utils/form-snapshot.util';
import { EstimacionIngresosApiService } from '../../api/estimacion-ingresos-api.service';
import { PROCESS_ID, PROCESS_ROUTE, solicitudRoute } from '../../config/estimacion-ingresos.rutas';
import { ClasificadorEstimacionIngresos } from '../../models/estimacion-ingresos.model';

/** Formulario de la fila de clasificador mientras se edita. */
interface Formulario {
  ff: string;
  clasificador: string;
  promedioAnual: string;
  anio2027: string;
  anio2028: string;
  anio2029: string;
  baseLegal: 'SI' | 'NO';
}

const FORMULARIO_VACIO: Formulario = { ff: '', clasificador: '', promedioAnual: '', anio2027: '', anio2028: '', anio2029: '', baseLegal: 'NO' };

/**
 * Editar una fila de «Clasificadores de ingresos» (Figma node 4021:102921, «Solicitud elaborada»): se llega acá
 * seleccionando una sola fila en la tabla de la solicitud (modo edición) y pulsando el lápiz de
 * `siaf-table-controls`. El backend recalcula la variación (monto y %) a partir de Promedio anual y Año 2027.
 */
@Component({
  selector: 'siaf-estimacion-ingresos-clasificador',
  standalone: true,
  imports: [DecimalPipe, SolicitudeFormCardComponent, SolicitudePageLayoutComponent, TextFieldComponent],
  templateUrl: './estimacion-ingresos-clasificador.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimacionIngresosClasificadorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly estimacionApi = inject(EstimacionIngresosApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE, 'Editar clasificador');
  readonly cargando = signal(true);
  readonly saving = signal(false);
  readonly documentoId = signal('');
  readonly form = signal<Formulario>({ ...FORMULARIO_VACIO });
  private fotoEdicion: string | null = null;

  readonly opcionesBaseLegal: TextFieldOption[] = [{ label: 'SI', value: 'SI' }, { label: 'NO', value: 'NO' }];

  readonly hayCambios = computed(() => hayCambiosRespectoAlSnapshot(this.fotoEdicion, crearSnapshotFormulario(this.form())));

  /** (e) Monto: b − a. */
  readonly variacionMonto = computed(() => this.numero('anio2027') - this.numero('promedioAnual'));
  /** (f) %: (e / a) x 100. */
  readonly variacionPorcentaje = computed(() => {
    const a = this.numero('promedioAnual');
    return a ? ((this.variacionMonto() / a) * 100).toFixed(1) : '0.0';
  });
  readonly variacionCB = computed(() => this.numero('anio2028') - this.numero('anio2027'));
  readonly variacionDC = computed(() => this.numero('anio2029') - this.numero('anio2028'));

  ngOnInit(): void {
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((params) => {
        const id = params.get('id') ?? '';
        const indice = Number(params.get('indice'));
        this.documentoId.set(id);
        this.cargando.set(true);
        return this.estimacionApi.obtenerDetalle(id).pipe(switchMap((detalle) => {
          const fila = detalle.clasificadores[indice];
          return fila ? [fila] : [];
        }));
      }),
    ).subscribe({
      next: (fila) => { this.restaurarFormulario(fila); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  private restaurarFormulario(fila: ClasificadorEstimacionIngresos): void {
    const f: Formulario = {
      ff: fila.ff,
      clasificador: fila.clasificador,
      promedioAnual: String(fila.promedioAnual),
      anio2027: String(fila.anio2027),
      anio2028: String(fila.anio2028),
      anio2029: String(fila.anio2029),
      baseLegal: fila.baseLegal,
    };
    this.form.set(f);
    this.fotoEdicion = crearSnapshotFormulario(f);
  }

  private numero(campo: keyof Pick<Formulario, 'promedioAnual' | 'anio2027' | 'anio2028' | 'anio2029'>): number {
    return Number(this.form()[campo]) || 0;
  }

  actualizar<K extends keyof Formulario>(campo: K, valor: Formulario[K]): void {
    this.form.update((f) => ({ ...f, [campo]: valor }));
  }

  regresar(): void {
    void this.router.navigate([solicitudRoute(this.documentoId())]);
  }

  grabar(): void {
    const id = this.documentoId();
    const indice = Number(this.route.snapshot.paramMap.get('indice'));
    if (!id || !this.hayCambios()) return;
    const f = this.form();
    this.saving.set(true);
    this.estimacionApi.actualizarClasificador(id, indice, {
      ff: f.ff,
      clasificador: f.clasificador,
      promedioAnual: this.numero('promedioAnual'),
      anio2027: this.numero('anio2027'),
      anio2028: this.numero('anio2028'),
      anio2029: this.numero('anio2029'),
      baseLegal: f.baseLegal,
    }).subscribe({
      next: () => this.regresar(),
      error: () => this.saving.set(false),
    });
  }
}
