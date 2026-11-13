import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { PermissionService } from '../../../../../core/auth/permission.service';

import { DocumentsRecordsPageComponent } from '../../../../../shared/components/documents-records-page/documents-records-page.component';
import type { DocumentHistoryRow } from '../../../../../shared/components/document-history-panel/document-history-panel.component';
import type { DocumentsRecordsConfig, DocumentsRecordsRow } from '../../../../../shared/types/documents-records.types';
import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { EstimacionIngresosApiService } from '../../api/estimacion-ingresos-api.service';
import { bandejaRevisor } from '../../config/bandeja-revisor.config';
import { consolidadoDocumentsConfig } from '../../config/consolidado-pliego-documents.config';
import { AMBITOS_CONSOLIDADO, AmbitoConsolidado } from '../../config/estimacion-ingresos.rutas';
import { ConsolidadoPliegoRegistro } from '../../models/consolidado-pliego.model';

/** ISO → "dd/mm/aaaa", como lo muestra el Figma. */
function aFechaPe(iso: string): string {
  const fecha = new Date(iso);
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${fecha.getFullYear()}`;
}

/** ISO → `dd/mm/aaaa` y `hh:mm:ss`, para una fila del historial del documento. */
function aFechaYHora(iso: string): { fecha: string; hora: string } {
  return { fecha: aFechaPe(iso), hora: new Date(iso).toLocaleTimeString('es-PE', { hour12: false }) };
}

/**
 * Historial del documento (Figma estándar «HistorialDocumento»): los mismos nombres, fechas y estados que la
 * trazabilidad del consolidado. El panel los ordena del más reciente al más antiguo.
 */
function historialDe(d: ConsolidadoPliegoRegistro): DocumentHistoryRow[] {
  const fila = (usuario: string, rol: string, iso: string, estado: string, comentario = ''): DocumentHistoryRow => ({
    usuario, rol, ...aFechaYHora(iso), estado, comentario,
  });
  const filas = [fila(d.elaboradoPor ?? '', 'Creador', d.fecha, 'ELABORADO')];
  // Las sembradas en Verificado no guardan quién verificó: se toma el elaborador y la fecha de registro.
  if (d.estado !== 'Elaborado') filas.push(fila(d.verificadoPor ?? d.elaboradoPor ?? '', 'Creador', d.fechaVerificado ?? d.fecha, 'VERIFICADO'));
  if (d.aprobadoPor && d.fechaAprobado) filas.push(fila(d.aprobadoPor, 'Aprobador', d.fechaAprobado, 'APROBADO'));
  if (d.observadoPor && d.fechaObservado) filas.push(fila(d.observadoPor, 'Aprobador', d.fechaObservado, 'OBSERVADO', d.motivoObservacion));
  return filas;
}

/**
 * «Documentos de consolidado pliego de estimación de ingresos» (Figma CEL-005.01.01.01.01, node 4938:92579), vista
 * del creador del pliego: la bandeja estándar con el aviso «Consolidado disponible» encima de la tarjeta cuando todas
 * las unidades ejecutoras del pliego validaron su solicitud de estimación de ingresos.
 *
 * Con `data: { ambito: 'dgtp' }` es la bandeja «Documentos de consolidado DGTP de estimación de ingresos» (Figma
 * node 4938:253880): la misma, sin el aviso.
 */
@Component({
  selector: 'siaf-consolidado-pliego-documents',
  standalone: true,
  imports: [AlertComponent, DocumentsRecordsPageComponent],
  template: `
    <siaf-documents-records-page [config]="pageConfig()" [loading]="cargando()">
      @if (ambito === 'pliego' && esCreador() && consolidadoDisponible() && !avisoCerrado()) {
        <siaf-alert
          page-alert
          tone="info"
          title="Consolidado disponible"
          [description]="textoAviso()"
          [showClose]="true"
          (closed)="avisoCerrado.set(true)"
        />
      }
    </siaf-documents-records-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsolidadoPliegoDocumentsComponent implements OnInit {
  private readonly api = inject(EstimacionIngresosApiService);
  private readonly permissions = inject(PermissionService);
  readonly ambito: AmbitoConsolidado = inject(ActivatedRoute).snapshot.data['ambito'] ?? 'pliego';
  private readonly config = consolidadoDocumentsConfig(this.ambito);

  private readonly documentos = signal<ConsolidadoPliegoRegistro[]>([]);
  private readonly unidadesValidadas = signal(0);
  private readonly unidadesTotal = signal(0);
  readonly cargando = signal(true);
  readonly avisoCerrado = signal(false);
  /** «Consolidado disponible» invita a crear el consolidado: solo para el creador. */
  readonly esCreador = computed(() => this.permissions.currentRole() === 'creator');

  /** Todas las unidades ejecutoras del pliego validaron su solicitud: ya se puede crear el consolidado. */
  readonly consolidadoDisponible = computed(() => this.unidadesTotal() > 0 && this.unidadesValidadas() === this.unidadesTotal());
  readonly textoAviso = computed(
    () => `Las ${this.unidadesValidadas()} Unidades Ejecutoras han validado sus Solicitudes de Estimación de Ingresos. Puede crear el Consolidado Pliego.`,
  );

  ngOnInit(): void {
    this.api.listarConsolidadosPliego(this.ambito).subscribe({
      next: (bandeja) => {
        this.documentos.set(bandeja.documentos);
        this.unidadesValidadas.set(bandeja.unidadesValidadas);
        this.unidadesTotal.set(bandeja.unidadesTotal);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  readonly pageConfig = computed((): DocumentsRecordsConfig => {
    const documentRows: DocumentsRecordsRow[] = this.documentos().map((d) => ({
      documentId: d.id,
      document: d.documento,
      linkRoute: AMBITOS_CONSOLIDADO[this.ambito].detalle(d.id),
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
    // Aprobador: modo aprobador de la bandeja (sin «Crear documento», solo Verificado, Aprobado, Observado y
    // Rechazado) con «Aprobar» deshabilitado: se aprueba desde el consolidado, como la solicitud.
    // Revisor / Evaluador, consolidado pliego: la misma bandeja que en las solicitudes de estimación de ingresos
    // (Figma node 14751:191854): solo los Aprobados, con expediente, estado del expediente y evaluador.
    if (this.permissions.currentRole() === 'reviewer' && this.ambito === 'pliego') {
      const documentoDe = (r: DocumentsRecordsRow) => {
        const d = this.documentos().find((x) => x.id === r['documentId']);
        return d && { ...d, registros: d.registrosPersonalizados };
      };
      return { ...bandejaRevisor(this.config, documentRows, documentoDe), buildDocumentHistory };
    }
    // Revisor / Evaluador, consolidado DGTP: modo solo lectura de la bandeja (sin «Crear documento» ni acción principal).
    if (this.permissions.currentRole() === 'reviewer') {
      return { ...this.config, documentRows, buildDocumentHistory, modoConsulta: false };
    }
    if (this.permissions.currentRole() === 'approver') {
      return { ...this.config, documentRows, buildDocumentHistory, modoConsulta: false, accionPrincipalDeshabilitada: true };
    }
    return { ...this.config, documentRows, buildDocumentHistory };
  });
}
