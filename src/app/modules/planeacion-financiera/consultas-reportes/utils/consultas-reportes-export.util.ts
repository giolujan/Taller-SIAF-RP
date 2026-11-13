import type { QueryReportColumn, QueryReportExportFormat, QueryReportRow } from '../../../../shared/types/query-report.types';

/** Descarga un Blob como archivo. */
function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/**
 * «Exportar» de la consulta de planeación financiera: Excel, CSV o PDF con las columnas visibles y las filas que quedan
 * tras buscar, filtrar y aplicar los filtros avanzados. Las librerías se cargan recién al exportar.
 */
export async function exportarConsultaPlaneacion(
  formato: QueryReportExportFormat,
  titulo: string,
  columnas: QueryReportColumn[],
  filas: QueryReportRow[],
): Promise<void> {
  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = `consultas-planeacion-financiera-${fecha}`;
  const encabezado = (c: QueryReportColumn) => (c.group ? `${c.group} - ${c.label}` : c.label);
  const valores = filas.map((fila) => columnas.map((c) => fila[c.key] ?? ''));

  if (formato === 'csv') {
    const escapar = (valor: string) => (/[",\n;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor);
    const contenido = [columnas.map(encabezado), ...valores].map((linea) => linea.map(escapar).join(',')).join('\n');
    // BOM para que Excel abra bien las tildes.
    descargar(new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' }), `${nombre}.csv`);
    return;
  }

  if (formato === 'excel') {
    const { Workbook } = await import('exceljs');
    const libro = new Workbook();
    const hoja = libro.addWorksheet('Resultado');
    hoja.columns = columnas.map((c) => ({ header: encabezado(c), key: c.key, width: Math.max(14, Math.round((c.width ?? 140) / 7)) }));
    hoja.getRow(1).font = { bold: true };
    filas.forEach((fila) => hoja.addRow(fila));
    const buffer = await libro.xlsx.writeBuffer();
    descargar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${nombre}.xlsx`);
    return;
  }

  if (formato === 'pdf') {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(12);
    doc.text(titulo, 40, 40);
    autoTable(doc, {
      startY: 56,
      head: [columnas.map(encabezado)],
      body: valores,
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [226, 226, 226], textColor: 32 },
    });
    doc.save(`${nombre}.pdf`);
  }
}
