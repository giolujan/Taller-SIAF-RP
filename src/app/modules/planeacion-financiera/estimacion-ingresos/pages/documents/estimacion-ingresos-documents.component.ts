import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { DocumentsRecordsPageComponent } from '../../../../../shared/components/documents-records-page/documents-records-page.component';
import type { DocumentsRecordsConfig, DocumentsRecordsRow } from '../../../../../shared/types/documents-records.types';
import { EstimacionIngresosApiService } from '../../api/estimacion-ingresos-api.service';
import { ESTIMACION_INGRESOS_DOCUMENTS_CONFIG } from '../../config/estimacion-ingresos-documents.config';
import { EstimacionIngresosRegistro } from '../../models/estimacion-ingresos.model';

/** ISO → "dd/mm/aaaa", como lo muestra el Figma. */
function aFechaPe(iso: string): string {
  const fecha = new Date(iso);
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${fecha.getFullYear()}`;
}

/**
 * «Documentos de estimación de Ingresos»: bandeja de solo consulta (`modoConsulta`), calcada del Figma
 * CEL-005.01.01.01.01 (node 2448:146364). La tab Registros todavía no está implementada.
 */
@Component({
  selector: 'siaf-estimacion-ingresos-documents',
  standalone: true,
  imports: [DocumentsRecordsPageComponent],
  template: `<siaf-documents-records-page [config]="pageConfig()" [loading]="cargando()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstimacionIngresosDocumentsComponent implements OnInit {
  private readonly estimacionApi = inject(EstimacionIngresosApiService);

  private readonly documentos = signal<EstimacionIngresosRegistro[]>([]);
  readonly cargando = signal(true);

  ngOnInit(): void {
    this.estimacionApi.listarDocumentos().subscribe({
      next: (documentos) => { this.documentos.set(documentos); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  readonly pageConfig = computed((): DocumentsRecordsConfig => {
    const documentRows: DocumentsRecordsRow[] = this.documentos().map((d) => ({
      documentId: d.id,
      document: d.documento,
      number: d.numero,
      actionType: d.tipoAccion,
      status: d.estado,
      system: d.sistema,
      date: aFechaPe(d.fecha),
      entity: d.entidad,
    }));

    return { ...ESTIMACION_INGRESOS_DOCUMENTS_CONFIG, documentRows };
  });
}
