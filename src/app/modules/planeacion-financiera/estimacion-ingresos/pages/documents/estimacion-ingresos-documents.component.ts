import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { PermissionService } from '../../../../../core/auth/permission.service';

import { DocumentsRecordsPageComponent } from '../../../../../shared/components/documents-records-page/documents-records-page.component';
import type { DocumentHistoryRow } from '../../../../../shared/components/document-history-panel/document-history-panel.component';
import type { DocumentsRecordsConfig, DocumentsRecordsRow } from '../../../../../shared/types/documents-records.types';
import { EstimacionIngresosApiService } from '../../api/estimacion-ingresos-api.service';
import { ESTIMACION_INGRESOS_DOCUMENTS_CONFIG } from '../../config/estimacion-ingresos-documents.config';
import { solicitudRoute } from '../../config/estimacion-ingresos.rutas';
import { EstimacionIngresosRegistro } from '../../models/estimacion-ingresos.model';
import { bandejaRevisor } from '../../config/bandeja-revisor.config';

/** ISO → "dd/mm/aaaa", como lo muestra el Figma. */
function aFechaPe(iso: string): string {
  const fecha = new Date(iso);
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${fecha.getFullYear()}`;
}

/** ISO → `dd/mm/aaaa` y `hh:mm:ss`, para una fila del historial del documento. */
function aFechaYHora(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  return { fecha: aFechaPe(iso), hora: d.toLocaleTimeString('es-PE', { hour12: false }) };
}

/**
 * Historial del documento (Figma estándar «HistorialDocumento», node 24084:128063): los mismos nombres, fechas y
 * estados que la trazabilidad de la solicitud. El panel los ordena del más reciente al más antiguo.
 */
function historialDe(d: EstimacionIngresosRegistro): DocumentHistoryRow[] {
  const fila = (usuario: string, rol: string, iso: string, estado: string, comentario = ''): DocumentHistoryRow => ({
    usuario, rol, ...aFechaYHora(iso), estado, comentario,
  });
  const filas = [fila(d.elaboradoPor ?? '', 'Creador', d.fecha, 'ELABORADO')];
  if (d.verificadoPor && d.fechaVerificado) filas.push(fila(d.verificadoPor, 'Creador', d.fechaVerificado, 'VERIFICADO'));
  if (d.aprobadoPor && d.fechaAprobado) filas.push(fila(d.aprobadoPor, 'Aprobador', d.fechaAprobado, 'APROBADO'));
  if (d.observadoPor && d.fechaObservado) filas.push(fila(d.observadoPor, 'Aprobador', d.fechaObservado, 'OBSERVADO', d.motivoObservacion));
  return filas;
}

/**
 * «Documentos de estimación de Ingresos», calcada del Figma CEL-005.01.01.01.01 (node 2448:146364). La tab Registros
 * todavía no está implementada.
 *
 * - Creador: bandeja de consulta (`modoConsulta`) con «Crear documento» y todos los estados.
 * - Aprobador: modo aprobador de `siaf-documents-records-page`: sin «Crear documento», solo Verificado, Aprobado,
 *   Observado y Rechazado, y «Aprobar» deshabilitado (se aprueba desde la solicitud).
 * - El historial del documento sale de los datos del documento (`buildDocumentHistory`), no de la API genérica de
 *   solicitudes, que no conoce este proceso.
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
  private readonly permissions = inject(PermissionService);

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
      // «Documento» es el enlace a la solicitud (creador y aprobador).
      linkRoute: solicitudRoute(d.id),
      number: d.numero,
      actionType: d.tipoAccion,
      status: d.estado,
      system: d.sistema,
      date: aFechaPe(d.fecha),
      entity: d.entidad,
    }));

    const buildDocumentHistory = (row: DocumentsRecordsRow) => {
      const documento = this.documentos().find((d) => d.id === row['documentId']);
      return documento ? { staticRows: historialDe(documento) } : null;
    };
    // Revisor / Evaluador (Figma node 14751:191854): solo las Aprobadas, con expediente y evaluación.
    if (this.permissions.currentRole() === 'reviewer') {
      const documentoDe = (r: DocumentsRecordsRow) => {
        const d = this.documentos().find((x) => x.id === r['documentId']);
        return d && { ...d, registros: d.clasificadoresPersonalizados };
      };
      return { ...bandejaRevisor(ESTIMACION_INGRESOS_DOCUMENTS_CONFIG, documentRows, documentoDe), buildDocumentHistory };
    }
    if (this.permissions.currentRole() === 'approver') {
      return { ...ESTIMACION_INGRESOS_DOCUMENTS_CONFIG, documentRows, buildDocumentHistory, modoConsulta: false, accionPrincipalDeshabilitada: true };
    }
    return { ...ESTIMACION_INGRESOS_DOCUMENTS_CONFIG, documentRows, buildDocumentHistory };
  });
}
