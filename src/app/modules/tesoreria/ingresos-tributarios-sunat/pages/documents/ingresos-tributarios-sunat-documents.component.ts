import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Observable, interval, of } from 'rxjs';

/** Cada cuánto la bandeja vuelve a pedir sola los documentos y registros, sin que el usuario haga nada. */
const REFRESCO_BANDEJA_MS = 10000;

import { DocumentsRecordsPageComponent } from '../../../../../shared/components/documents-records-page/documents-records-page.component';
import type { DocumentsRecordsConfig, DocumentsRecordsRow } from '../../../../../shared/types/documents-records.types';
import { ButtonGroupItem, ButtonsGroupComponent } from '../../../../../shared/ui/buttons-group/buttons-group.component';
import { IngresosTributariosSunatApiService } from '../../api/ingresos-tributarios-sunat-api.service';
import { INGRESOS_TRIBUTARIOS_SUNAT_DOCUMENTS_CONFIG, TIPOS_REGISTRO, recordColumnsFor } from '../../config/ingresos-tributarios-sunat-documents.config';
import { documentoRoute } from '../../config/ingresos-tributarios-sunat.rutas';
import {
  IngresoTributarioRegistro,
  RegistroIngresoTributario,
  TipoRegistroIngresoTributario,
} from '../../models/ingreso-tributario.model';

/** ISO → "dd/mm/aaaa hh:mm:ss", como lo muestra el Figma. */
function aFechaHoraPe(iso: string): string {
  const fecha = new Date(iso);
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const hh = String(fecha.getHours()).padStart(2, '0');
  const mi = String(fecha.getMinutes()).padStart(2, '0');
  const ss = String(fecha.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${fecha.getFullYear()} ${hh}:${mi}:${ss}`;
}

/**
 * «Documentos de Ingresos tributarios SUNAT»: bandeja de solo consulta (`modoConsulta`). La pantalla entera la arma
 * `siaf-documents-records-page`; esta página solo carga los documentos y los registros que generó el motor de
 * integración con SUNAT.
 *
 * La tab Registros tiene, además, un selector («Buttons group» del Figma) entre «Reporte de recaudación» y
 * «Nota de débito»: cada opción pinta su propia tabla con las mismas columnas y una cabecera agrupada «Documento»
 * (Número/Nombre). Se proyecta en el slot `[records-header]` de `siaf-documents-records-page`.
 */
@Component({
  selector: 'siaf-ingresos-tributarios-sunat-documents',
  standalone: true,
  imports: [ButtonsGroupComponent, DocumentsRecordsPageComponent],
  template: `
    <siaf-documents-records-page [config]="pageConfig()" [loading]="cargando()">
      <div records-header class="flex">
        <siaf-buttons-group ariaLabel="Tipo de registro" [items]="tiposRegistro" [value]="tipoRegistro()" (valueChange)="tipoRegistro.set($any($event))" />
      </div>
    </siaf-documents-records-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IngresosTributariosSunatDocumentsComponent implements OnInit {
  private readonly ingresosApi = inject(IngresosTributariosSunatApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly documentos = signal<IngresoTributarioRegistro[]>([]);
  private readonly registros = signal<RegistroIngresoTributario[]>([]);
  readonly cargando = signal(true);

  readonly tiposRegistro: ButtonGroupItem[] = TIPOS_REGISTRO;
  readonly tipoRegistro = signal<TipoRegistroIngresoTributario>('reporte-recaudacion');

  ngOnInit(): void {
    // Si se entra con «Regresar» desde el detalle (?origen=detalle en la URL), no se reinicia la simulación en
    // vivo (se ve el avance real); por cualquier otro camino (menú de Procesos, migas de pan, URL directa) arranca
    // de nuevo desde Registrado.
    const fromDetail = this.route.snapshot.queryParamMap.get('origen') === 'detalle';
    const listo: Observable<unknown> = fromDetail ? of(null) : this.ingresosApi.reiniciarSimulacion();
    listo.subscribe({
      next: () => this.cargarDatos(true),
      error: () => this.cargarDatos(true),
    });

    // La bandeja se actualiza sola cada 10 s (aunque no se entre a ningún documento), para que el avance de estado
    // del Reporte y la Nota en vivo se vea sin recargar ni navegar.
    interval(REFRESCO_BANDEJA_MS).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cargarDatos(false));
  }

  private cargarDatos(mostrarCarga: boolean): void {
    if (mostrarCarga) { this.cargasPendientes = 2; this.cargando.set(true); }
    this.ingresosApi.listarDocumentos().subscribe({
      next: (documentos) => { this.documentos.set(documentos); if (mostrarCarga) this.actualizarCarga(); },
      error: () => { if (mostrarCarga) this.actualizarCarga(); },
    });
    this.ingresosApi.listarRegistros().subscribe({
      next: (registros) => { this.registros.set(registros); if (mostrarCarga) this.actualizarCarga(); },
      error: () => { if (mostrarCarga) this.actualizarCarga(); },
    });
  }

  private cargasPendientes = 2;
  private actualizarCarga(): void {
    this.cargasPendientes -= 1;
    if (this.cargasPendientes <= 0) this.cargando.set(false);
  }

  readonly pageConfig = computed((): DocumentsRecordsConfig => {
    const documentRows: DocumentsRecordsRow[] = this.documentos().map((d) => ({
      documentId: d.id,
      document: d.documento,
      number: d.numero,
      actionType: d.tipoAccion,
      status: d.estado,
      date: aFechaHoraPe(d.fecha),
      entity: d.entidad,
      // Cada documento lleva a su propia pantalla de detalle (de solo lectura); los que no la tienen diseñada
      // todavía muestran ahí mismo el aviso "No se encontró el detalle de este documento."
      linkRoute: documentoRoute(d.id),
    }));

    const tipo = this.tipoRegistro();
    const recordRows: DocumentsRecordsRow[] = this.registros()
      .filter((r) => r.tipo === tipo)
      .map((r) => ({
        id: r.id,
        // Para el encabezado del panel «Historial del documento» (lo arma `openHistory()` desde estas claves).
        document: r.documentoNombre,
        number: r.documentoNumero,
        nro: String(r.nro),
        numeroOrigen: r.numeroOrigen,
        entidadFinanciera: r.entidadFinanciera,
        moneda: r.moneda,
        montoTotal: r.montoTotal,
        status: r.estado,
        documentoNumero: r.documentoNumero,
        documentoNombre: r.documentoNombre,
      }));

    return {
      ...INGRESOS_TRIBUTARIOS_SUNAT_DOCUMENTS_CONFIG,
      documentRows,
      recordRows,
      recordColumns: recordColumnsFor(tipo),
      // Documentos fuera del flujo de solicitudes: el historial no consulta la API, viene resuelto acá.
      buildDocumentHistory: (row) => {
        if (row['id'] && !row['documentId']) {
          const registro = this.registros().find((r) => r.id === row['id']);
          if (!registro) return null;
          const origen = this.documentos().find((d) => d.numero === registro.documentoNumero);
          const [dia, hora] = origen ? aFechaHoraPe(origen.fecha).split(' ') : ['—', ''];
          return {
            attributesTitle: 'Atributos del registro',
            attributes: [
              { label: 'Entidad financiera', value: registro.entidadFinanciera },
              { label: 'Moneda', value: registro.moneda },
              { label: 'Monto total', value: registro.montoTotal },
            ],
            staticRows: [
              {
                usuario: 'Motor de integración SUNAT',
                rol: 'Sistema',
                fecha: dia,
                hora,
                estado: registro.estado === 'Activo' ? 'Procesado' : 'Anulado',
                comentario: 'Registro generado automáticamente desde el padrón de SUNAT.',
              },
            ],
          };
        }

        const documento = this.documentos().find((d) => d.id === row['documentId']);
        if (!documento) return null;
        const fecha = aFechaHoraPe(documento.fecha);
        const [dia, hora] = fecha.split(' ');
        return {
          attributesTitle: 'Atributos del ingreso tributario',
          attributes: [
            { label: 'Entidad', value: documento.entidad },
            { label: 'Tipo de acción', value: documento.tipoAccion },
          ],
          staticRows: [
            {
              usuario: 'Motor de integración SUNAT',
              rol: 'Sistema',
              fecha: dia,
              hora,
              estado: 'Procesado',
              comentario: 'Generado automáticamente desde el padrón de SUNAT.',
            },
          ],
        };
      },
    };
  });
}
